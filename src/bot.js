// ─── Phoenix Trading Bot v2 ──────────────────────────────
// Architecture: Multi-strategy swarm → Synthesizer → Risk → Execution → Position Management

import "dotenv/config";
import { initPhoenix, getCandles, getCurrentPrice, getFundingRate } from "./market/phoenix.js";
import { TrendFollowing, MeanReversion, Momentum, SRBounce, VolumeBreakout, synthesizeSignals } from "./analysis/signals.js";
import { analyzeFunding, analyzeLiquidationRisk, analyzeCarryOpportunity } from "./analysis/funding.js";
import { RiskManager } from "./risk/manager.js";
import { PositionManager } from "./risk/position-manager.js";
import { Executor } from "./execution/executor.js";

// ─── Config ────────────────────────────────────────────────

const SYMBOLS = (process.env.SYMBOLS || "SOL,ETH,BTC").split(",").map(s => s.trim());
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || "60") * 1000;
const IS_PAPER = (process.env.TRADING_MODE || "paper") === "paper";
const MIN_CONFIDENCE = parseFloat(process.env.MIN_CONFIDENCE || "0.55");

// ─── Helpers ───────────────────────────────────────────────

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const emoji = (v) => v > 0 ? "🟢" : v < 0 ? "🔴" : "⚪";
const pct = (v) => (v * 100).toFixed(1) + "%";
const usd = (v) => "$" + v.toFixed(2);

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════╗
║           🔥 Phoenix Bot v2 — Swarm AI          ║
╠══════════════════════════════════════════════════╣
║  Mode:      ${(IS_PAPER ? "PAPER" : "LIVE").padEnd(35)}║
║  Markets:   ${SYMBOLS.join(", ").padEnd(35)}║
║  Interval:  ${(SCAN_INTERVAL / 1000 + "s").padEnd(35)}║
║  Min Conf:  ${(MIN_CONFIDENCE * 100 + "%").padEnd(35)}║
║  Strategies: 5 (Trend, MeanRev, Mom, SR, Vol)   ║
╚══════════════════════════════════════════════════╝
`);

  // Init Phoenix
  let phoenix = null;
  try {
    phoenix = await initPhoenix();
  } catch (err) {
    log(`⚠ Phoenix init failed: ${err.message}`);
    log("  Running with rule-based analysis only.\n");
  }

  // Init components
  const risk = new RiskManager({
    maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || "5"),
    maxDailyLossPct: parseFloat(process.env.MAX_DAILY_LOSS_PCT || "10"),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || "3"),
    portfolioValue: parseFloat(process.env.INITIAL_PORTFOLIO || "1000"),
  });

  const posManager = new PositionManager({
    trailingStopPct: parseFloat(process.env.TRAILING_STOP_PCT || "1.5"),
    partialProfitPct: parseFloat(process.env.PARTIAL_PROFIT_PCT || "2.0"),
    breakEvenTrigger: parseFloat(process.env.BREAK_EVEN_TRIGGER || "1.0"),
    maxHoldBars: parseInt(process.env.MAX_HOLD_BARS || "48"),
  });

  const executor = new Executor(IS_PAPER ? "paper" : "live", phoenix);

  log(`Portfolio: ${usd(risk.portfolioValue)} | Positions: ${risk.openPositions.length}`);
  log("─".repeat(55));

  // ─── Main Loop ─────────────────────────────────────────
  
  let cycle = 0;
  let barIndex = 0;

  while (true) {
    cycle++;
    barIndex++;
    log(`\n🔄 Cycle #${cycle}`);

    // ─── 1. Manage Existing Positions ────────────────────
    
    const currentPrices = {};
    for (const symbol of SYMBOLS) {
      try { currentPrices[symbol] = await getCurrentPrice(symbol); } catch {}
    }

    const posActions = posManager.checkPositions(risk.openPositions, currentPrices, barIndex);
    for (const action of posActions) {
      const pos = action.position;
      if (action.type === "close_full") {
        const result = risk.closePosition(pos.id, action.price, action.reason);
        if (result) {
          log(`  ${result.pnl >= 0 ? "💰" : "💸"} CLOSED ${pos.symbol} ${pos.side} | ${action.reason} | ${usd(result.pnl)} (${pct(result.pnlPct / 100)})`);
        }
      } else if (action.type === "close_partial") {
        // Partial exit — reduce position size
        const pnlPerUnit = (action.price - pos.entryPrice) * (pos.side === "long" ? 1 : -1);
        const partialPnl = pnlPerUnit * action.exitSize;
        pos.size -= action.exitSize;
        risk.portfolioValue += partialPnl;
        log(`  🎯 PARTIAL ${pos.symbol} | ${pct(action.exitSize / (pos.size + action.exitSize))} exited | ${usd(partialPnl)}`);
      }
    }

    // ─── 2. Scan Each Market ─────────────────────────────
    
    for (const symbol of SYMBOLS) {
      try {
        const candles = await getCandles(symbol, "1h", 100);
        if (!candles || candles.length < 50) {
          log(`  ${symbol}: insufficient data (${candles?.length || 0})`);
          continue;
        }

        const price = currentPrices[symbol] || candles[candles.length - 1].close;

        // ─── Run 5 Strategies in Parallel (Swarm) ────────
        const strategies = [
          TrendFollowing(candles),
          MeanReversion(candles),
          Momentum(candles),
          SRBounce(candles),
          VolumeBreakout(candles),
        ];

        // ─── Funding Analysis ────────────────────────────
        let fundingSignal = { signal: 0, confidence: 0 };
        try {
          const fundingData = await getFundingRate(symbol);
          if (fundingData) {
            fundingSignal = analyzeFunding([fundingData], price);
          }
        } catch {}

        // ─── Liquidation Risk ────────────────────────────
        const liqRisk = analyzeLiquidationRisk(candles, price);

        // ─── Synthesize ──────────────────────────────────
        const combined = synthesizeSignals(strategies, price);

        // Blend funding signal
        if (fundingSignal.signal !== 0) {
          combined.signal = combined.signal * 0.8 + fundingSignal.signal * 0.2;
          combined.confidence = Math.min(1, combined.confidence + fundingSignal.confidence * 0.1);
        }

        // ─── Log Analysis ────────────────────────────────
        const stratLog = strategies.map(s => `${s.name.slice(0, 6)}:${emoji(s.signal)}${s.signal.toFixed(1)}`).join(" ");
        log(`  ${symbol}: ${usd(price)} ${emoji(combined.signal)} sig:${combined.signal.toFixed(2)} conf:${pct(combined.confidence)} | ${stratLog}`);

        if (fundingSignal.signal !== 0) {
          log(`    Funding: ${fundingSignal.regime} ${emoji(fundingSignal.signal)} ${fundingSignal.signal.toFixed(2)}`);
        }

        // ─── Execute if Signal Strong Enough ─────────────
        if (combined.action === "hold" || combined.confidence < MIN_CONFIDENCE) {
          if (combined.action !== "hold") {
            log(`    ⏸ Below threshold (${pct(combined.confidence)} < ${pct(MIN_CONFIDENCE)})`);
          }
          continue;
        }

        // Check if already have position in this direction
        const existing = risk.openPositions.find(p => p.symbol === symbol);
        if (existing) {
          log(`    ⏸ Already have ${existing.side} on ${symbol}`);
          continue;
        }

        // Risk check
        const validation = risk.canTrade(combined);
        if (!validation.allowed) {
          log(`    ⛔ ${validation.reasons.join(", ")}`);
          continue;
        }

        // Execute
        combined.leverage = validation.leverage;
        const order = await executor.execute(combined, symbol, validation.positionSize);

        if (order.status !== "failed") {
          const pos = risk.openPosition({
            symbol,
            side: combined.action,
            entryPrice: price,
            size: validation.positionSize,
            leverage: combined.leverage,
            stopLoss: combined.stopLoss,
            takeProfit: combined.takeProfit,
            source: "swarm_v2",
          });
          pos.openedAtBar = barIndex;
          log(`    ✅ OPENED ${combined.action.toUpperCase()} ${symbol} | ${pct(validation.positionSize / risk.portfolioValue)} of portfolio | ${combined.leverage}x`);
          log(`       SL: ${usd(combined.stopLoss)} | TP: ${usd(combined.takeProfit)} | Votes: L${combined.longVotes} S${combined.shortVotes}`);
        }

      } catch (err) {
        log(`  ${symbol}: Error — ${err.message}`);
      }
    }

    // ─── 3. Print Summary ────────────────────────────────
    
    const s = risk.getStats();
    log(`\n📊 ${usd(s.portfolioValue)} | PnL: ${usd(s.totalPnl)} | Win: ${s.winRate} | DD: ${s.currentDrawdown} | Pos: ${s.openPositions}`);

    // ─── 4. Wait ─────────────────────────────────────────
    
    log(`⏳ Next in ${SCAN_INTERVAL / 1000}s...`);
    await new Promise(r => setTimeout(r, SCAN_INTERVAL));
  }
}

// ─── Run ────────────────────────────────────────────────────

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
