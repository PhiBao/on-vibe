import { NextResponse } from "next/server";
import { readBotState, writeBotState, readBotConfig, pushSignal, logLine, readPendingSignals } from "@/lib/data-store";

export async function POST() {
  const state = readBotState();
  if (!state.running) {
    return NextResponse.json({ ran: false, reason: "bot_stopped" });
  }

  const config = readBotConfig();
  const symbols: string[] = config.symbols || ["SOL", "ETH", "BTC"];
  const minConfidence = config.minConfidence || 0.55;

  const cycle = (state.cycle || 0) + 1;
  writeBotState({ ...state, cycle });
  logLine(`🔄 Cycle #${cycle}`);

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
    logLine(`⚠ Phoenix init failed: ${msg}`);
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
        logLine(`  ${symbol}: insufficient data (${candles?.length || 0})`);
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
      logLine(`  ${symbol}: $${price.toFixed(2)} ${combined.signal > 0 ? "▲" : combined.signal < 0 ? "▼" : "◆"} sig:${combined.signal.toFixed(2)} conf:${(combined.confidence * 100).toFixed(1)}% | ${stratLog}`);

      if (combined.action === "hold" || combined.confidence < minConfidence) {
        if (combined.action !== "hold") logLine(`    ⏸ Below threshold (${(combined.confidence * 100).toFixed(1)}% < ${(minConfidence * 100).toFixed(1)}%)`);
        continue;
      }

      const existing = risk.openPositions.find((p: any) => p.symbol === symbol);
      if (existing) {
        logLine(`    ⏸ Already have position on ${symbol}`);
        continue;
      }

      const validation = risk.canTrade(combined);
      if (!validation.allowed) {
        logLine(`    ⛔ ${validation.reasons.join(", ")}`);
        continue;
      }

      combined.leverage = validation.leverage;
      const pending = readPendingSignals();
      const dup = pending.find((s) => s.symbol === symbol && s.side === combined.action);
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
        logLine(`    🔔 SIGNAL QUEUED: ${combined.action.toUpperCase()} ${symbol} | $${price.toFixed(2)} | ${combined.leverage}x`);
      } else {
        logLine(`    ⏸ Signal already pending for ${symbol}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`  ${symbol}: Error — ${msg}`);
    }
  }

  const stats = risk.getStats();
  logLine(`📊 $${stats.portfolioValue.toFixed(2)} | PnL: $${stats.totalPnl.toFixed(2)} | Win: ${stats.winRate} | DD: ${stats.currentDrawdown} | Pos: ${stats.openPositions} | Pending: ${readPendingSignals().length}`);

  return NextResponse.json({
    ran: true,
    cycle,
    signalsGenerated: signalsGenerated.length,
    signals: signalsGenerated,
  });
}
