// Trade Journal — view trade history, stats, and performance

import fs from "fs";
import path from "path";

const TRADE_LOG = path.join(process.cwd(), "data", "trades.jsonl");
const RISK_STATE = path.join(process.cwd(), "data", "risk-state.json");

function loadTrades() {
  try {
    if (!fs.existsSync(TRADE_LOG)) return [];
    return fs.readFileSync(TRADE_LOG, "utf8")
      .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

function loadState() {
  try {
    if (!fs.existsSync(RISK_STATE)) return {};
    return JSON.parse(fs.readFileSync(RISK_STATE, "utf8"));
  } catch { return {}; }
}

function printJournal() {
  const trades = loadTrades();
  const state = loadState();
  const history = state.tradeHistory || [];
  
  console.log(`
╔══════════════════════════════════════════════╗
║           📒 Trade Journal                   ║
╚══════════════════════════════════════════════╝
`);

  // Portfolio Stats
  const wins = history.filter(t => t.pnl > 0);
  const losses = history.filter(t => t.pnl <= 0);
  const totalPnl = history.reduce((s, t) => s + t.pnl, 0);
  const winRate = history.length > 0 ? (wins.length / history.length * 100).toFixed(1) : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.pnl), 0) / losses.length : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const drawdown = state.peakValue 
    ? ((state.peakValue - (state.portfolioValue || 0)) / state.peakValue * 100).toFixed(1)
    : 0;

  console.log("📊 Performance Summary");
  console.log("─".repeat(50));
  console.log(`  Portfolio:    $${(state.portfolioValue || 0).toFixed(2)}`);
  console.log(`  Peak:         $${(state.peakValue || 0).toFixed(2)}`);
  console.log(`  Total PnL:    $${totalPnl.toFixed(2)}`);
  console.log(`  Drawdown:     ${drawdown}%`);
  console.log(`  Total Trades: ${history.length}`);
  console.log(`  Win Rate:     ${winRate}%`);
  console.log(`  Avg Win:      $${avgWin.toFixed(2)}`);
  console.log(`  Avg Loss:     $${avgLoss.toFixed(2)}`);
  console.log(`  Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`  Open Pos:     ${(state.openPositions || []).length}`);
  console.log();

  // Open Positions
  const positions = state.openPositions || [];
  if (positions.length > 0) {
    console.log("📌 Open Positions");
    console.log("─".repeat(50));
    for (const p of positions) {
      const emoji = p.side === "long" ? "🟢" : "🔴";
      console.log(`  ${emoji} ${p.symbol} ${p.side.toUpperCase()} | Entry: $${p.entryPrice?.toFixed(2)} | SL: $${p.stopLoss?.toFixed(2)} | TP: $${p.takeProfit?.toFixed(2)} | ${p.leverage}x`);
    }
    console.log();
  }

  // Recent Closed Trades
  if (history.length > 0) {
    console.log("📜 Recent Trades (last 20)");
    console.log("─".repeat(50));
    const recent = history.slice(-20).reverse();
    for (const t of recent) {
      const emoji = t.pnl > 0 ? "💰" : "💸";
      const date = new Date(t.closedAt).toLocaleString();
      const dur = t.duration ? `${(t.duration / 60000).toFixed(0)}m` : "?";
      console.log(`  ${emoji} ${t.symbol} ${t.side} | $${t.pnl.toFixed(2)} (${t.pnlPct?.toFixed(1)}%) | ${t.reason} | ${dur} | ${date}`);
    }
    console.log();
  }

  // All Orders
  if (trades.length > 0) {
    console.log("📋 All Orders");
    console.log("─".repeat(50));
    for (const t of trades.slice(-10)) {
      const date = new Date(t.timestamp).toLocaleTimeString();
      console.log(`  [${date}] ${t.mode} ${t.side} ${t.symbol} | ${t.size?.toFixed(4)} @ $${t.price?.toFixed(2)} | ${t.status}`);
    }
  }
}

printJournal();
