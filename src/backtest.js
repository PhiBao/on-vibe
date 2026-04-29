// Backtest runner — test strategies on historical data

import "dotenv/config";
import { initPhoenix, getCandles } from "./market/phoenix.js";
import { Backtester } from "./backtest/engine.js";

const SYMBOL = process.argv[2] || "SOL";
const LEVERAGE = parseInt(process.argv[3] || "2");

async function main() {
  console.log(`\n📊 Backtesting ${SYMBOL} with ${LEVERAGE}x leverage\n`);

  try {
    await initPhoenix();
  } catch (err) {
    console.error("Phoenix init failed:", err.message);
    process.exit(1);
  }

  // Fetch historical candles
  console.log("Fetching candles...");
  const candles = await getCandles(SYMBOL, "1h", 1000);
  console.log(`Got ${candles?.length || 0} candles`);

  if (!candles || candles.length < 100) {
    console.error("Not enough data for backtest");
    process.exit(1);
  }

  // Run backtest
  const bt = new Backtester({
    initialCapital: 10000,
    leverage: LEVERAGE,
    takerFee: 0.0005,
    makerFee: 0.0002,
    slippage: 0.0003,
    fundingRate: 0.0001,
    maxPositionPct: 0.3,
    commission: 0.001,
  });

  const result = bt.run(candles);

  // Print results
  console.log("\n" + "═".repeat(50));
  console.log("  BACKTEST RESULTS");
  console.log("═".repeat(50));
  console.log(`  Total Return:     ${result.totalReturn}`);
  console.log(`  Annual Return:    ${result.annualReturn}`);
  console.log(`  Sharpe Ratio:     ${result.sharpe}`);
  console.log(`  Sortino Ratio:    ${result.sortino}`);
  console.log(`  Max Drawdown:     ${result.maxDrawdown}`);
  console.log(`  Win Rate:         ${result.winRate}`);
  console.log(`  Profit Factor:    ${result.profitFactor}`);
  console.log(`  Total Trades:     ${result.totalTrades}`);
  console.log(`  Avg Win:          ${result.avgWin}`);
  console.log(`  Avg Loss:         ${result.avgLoss}`);
  console.log(`  Max Consec Losses: ${result.maxConsecutiveLosses}`);
  console.log(`  Final Capital:    ${result.finalCapital}`);
  console.log("═".repeat(50));

  // Trade breakdown
  const byReason = {};
  for (const t of result.trades) {
    byReason[t.reason] = (byReason[t.reason] || 0) + 1;
  }
  console.log("\nExit Reasons:");
  for (const [reason, count] of Object.entries(byReason)) {
    const pnl = result.trades.filter(t => t.reason === reason).reduce((s, t) => s + t.pnl, 0);
    console.log(`  ${reason}: ${count} trades, ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);
  }
  console.log();
}

main().catch(console.error);
