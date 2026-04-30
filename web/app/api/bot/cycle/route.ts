import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const BOT_STATE_FILE = path.join(DATA_DIR, "bot-state.json");
const BOT_LOG_FILE = path.join(DATA_DIR, "bot-log.jsonl");
const SIGNAL_QUEUE_FILE = path.join(DATA_DIR, "signal-queue.jsonl");
const BOT_CONFIG_FILE = path.join(DATA_DIR, "bot-config.json");

function readState() {
  try { if (fs.existsSync(BOT_STATE_FILE)) return JSON.parse(fs.readFileSync(BOT_STATE_FILE, "utf8")); } catch {}
  return { running: false, cycle: 0, config: null };
}

function writeState(state: Record<string, unknown>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2));
}

function log(line: string) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(BOT_LOG_FILE, JSON.stringify({ line, time: Date.now() }) + "\n");
}

function readConfig() {
  try { if (fs.existsSync(BOT_CONFIG_FILE)) return JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, "utf8")); } catch {}
  return { symbols: ["SOL", "ETH", "BTC"], minConfidence: 0.55, maxPositionPct: 20, maxLeverage: 20, interval: 60, enabled: true, portfolioValue: 1000, walletAddress: "" };
}

function pushSignal(signal: Record<string, unknown>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(SIGNAL_QUEUE_FILE, JSON.stringify({ ...signal, queuedAt: Date.now(), status: "pending" }) + "\n");
}

function readPendingSignals(): Array<Record<string, unknown>> {
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return [];
    return fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)).filter((s: {status: string}) => s.status === "pending");
  } catch { return []; }
}

export async function POST() {
  const state = readState();
  if (!state.running) {
    return NextResponse.json({ ran: false, reason: "bot_stopped" });
  }

  const config = readConfig();
  const symbols: string[] = config.symbols || ["SOL", "ETH", "BTC"];
  const minConfidence = config.minConfidence || 0.55;

  const cycle = ((state.cycle as number) || 0) + 1;
  writeState({ ...state, cycle });
  log(`🔄 Cycle #${cycle}`);

  // Import engine modules dynamically
  const { initPhoenix, getCandles, getCurrentPrice, getFundingRate } = await import("@/lib/engine/market.js");
  const { TrendFollowing, MeanReversion, Momentum, SRBounce, VolumeBreakout, synthesizeSignals } = await import("@/lib/engine/signals.js");
  const { analyzeFunding } = await import("@/lib/engine/funding.js");
  const { RiskManager } = await import("@/lib/engine/risk.js");

  let phoenix = null;
  try {
    phoenix = await initPhoenix();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`⚠ Phoenix init failed: ${msg}`);
  }

  const portfolioValue = config.portfolioValue || 1000;
  const risk = new RiskManager({
    maxPositionPct: config.maxPositionPct || 20,
    maxDailyLossPct: 10,
    maxLeverage: config.maxLeverage || 20,
    portfolioValue,
  });

  const signalsGenerated: Array<Record<string, unknown>> = [];

  for (const symbol of symbols) {
    try {
      const candles = await getCandles(symbol, "1h", 100);
      if (!candles || candles.length < 50) {
        log(`  ${symbol}: insufficient data (${candles?.length || 0})`);
        continue;
      }

      const price = await getCurrentPrice(symbol) || candles[candles.length - 1].close;

      const strategies = [
        TrendFollowing(candles),
        MeanReversion(candles),
        Momentum(candles),
        SRBounce(candles),
        VolumeBreakout(candles),
      ];

      let fundingSignal: { signal: number; confidence: number } = { signal: 0, confidence: 0 };
      try {
        const fundingData = await getFundingRate(symbol);
        if (fundingData) {
          const fa = analyzeFunding([fundingData], price) as { signal: number; confidence: number };
          fundingSignal = { signal: fa.signal || 0, confidence: fa.confidence || 0 };
        }
      } catch {}

      const combined = synthesizeSignals(strategies, price, { maxLeverage: config.maxLeverage || 20 });
      if (fundingSignal.signal !== 0) {
        combined.signal = combined.signal * 0.8 + fundingSignal.signal * 0.2;
        combined.confidence = Math.min(1, combined.confidence + fundingSignal.confidence * 0.1);
      }

      const stratLog = strategies.map((s: {name: string; signal: number}) => `${s.name.slice(0,6)}:${s.signal > 0 ? "▲" : s.signal < 0 ? "▼" : "◆"}${s.signal.toFixed(1)}`).join(" ");
      log(`  ${symbol}: $${price.toFixed(2)} ${combined.signal > 0 ? "▲" : combined.signal < 0 ? "▼" : "◆"} sig:${combined.signal.toFixed(2)} conf:${(combined.confidence * 100).toFixed(1)}% | ${stratLog}`);

      if (combined.action === "hold" || combined.confidence < minConfidence) {
        if (combined.action !== "hold") log(`    ⏸ Below threshold (${(combined.confidence * 100).toFixed(1)}% < ${(minConfidence * 100).toFixed(1)}%)`);
        continue;
      }

      const existing = risk.openPositions.find((p: {symbol: string}) => p.symbol === symbol);
      if (existing) {
        log(`    ⏸ Already have position on ${symbol}`);
        continue;
      }

      const validation = risk.canTrade(combined);
      if (!validation.allowed) {
        log(`    ⛔ ${validation.reasons.join(", ")}`);
        continue;
      }

      combined.leverage = validation.leverage;
      const pending = readPendingSignals();
      const dup = pending.find((s: Record<string, unknown>) => s.symbol === symbol && s.side === combined.action);
      if (!dup) {
        const signal = {
          id: `sig_${Date.now()}_${symbol}`,
          cycle,
          symbol,
          side: combined.action,
          entryPrice: price,
          size: validation.positionSize,
          leverage: combined.leverage,
          stopLoss: combined.stopLoss,
          takeProfit: combined.takeProfit,
          confidence: combined.confidence,
          longVotes: combined.longVotes,
          shortVotes: combined.shortVotes,
          details: combined.details,
        };
        pushSignal(signal);
        signalsGenerated.push(signal);
        log(`    🔔 SIGNAL QUEUED: ${combined.action.toUpperCase()} ${symbol} | $${price.toFixed(2)} | ${combined.leverage}x`);
      } else {
        log(`    ⏸ Signal already pending for ${symbol}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ${symbol}: Error — ${msg}`);
    }
  }

  const stats = risk.getStats();
  log(`📊 $${stats.portfolioValue.toFixed(2)} | PnL: $${stats.totalPnl.toFixed(2)} | Win: ${stats.winRate} | DD: ${stats.currentDrawdown} | Pos: ${stats.openPositions} | Pending: ${readPendingSignals().length}`);

  return NextResponse.json({
    ran: true,
    cycle,
    signalsGenerated: signalsGenerated.length,
    signals: signalsGenerated,
  });
}
