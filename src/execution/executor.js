// Execution Engine — paper trading + live trading via Rise SDK

import fs from "fs";
import path from "path";

const TRADE_LOG = path.join(process.cwd(), "data", "trades.jsonl");

export class Executor {
  constructor(mode = "paper", phoenixClient = null) {
    this.mode = mode; // "paper" or "live"
    this.phoenix = phoenixClient;
    this.paperOrders = [];
  }

  async execute(signal, symbol, positionSize) {
    if (this.mode === "paper") {
      return this.paperExecute(signal, symbol, positionSize);
    }
    return this.liveExecute(signal, symbol, positionSize);
  }

  // ─── Paper Trading ───────────────────────────────────────
  
  paperExecute(signal, symbol, positionSize) {
    const order = {
      id: `paper_${Date.now()}`,
      symbol,
      side: signal.action === "long" ? "buy" : "sell",
      type: "market",
      size: positionSize,
      price: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      leverage: signal.leverage,
      timestamp: Date.now(),
      mode: "paper",
      status: "filled",
    };
    
    this.paperOrders.push(order);
    this.logTrade(order);
    
    console.log(`📝 PAPER ${order.side.toUpperCase()} ${symbol} | Size: ${positionSize.toFixed(4)} @ $${signal.entryPrice?.toFixed(2)} | SL: $${signal.stopLoss?.toFixed(2)} | TP: $${signal.takeProfit?.toFixed(2)}`);
    
    return order;
  }

  // ─── Live Trading ────────────────────────────────────────
  
  async liveExecute(signal, symbol, positionSize) {
    if (!this.phoenix) throw new Error("Phoenix client not initialized for live trading");
    
    try {
      const side = signal.action === "long" ? "buy" : "sell";
      
      // Build market order via Rise SDK
      const { buildMarketOrder } = await import("../market/phoenix.js");
      const orderPacket = await buildMarketOrder(symbol, side, positionSize);
      
      // Build instruction
      const ix = await this.phoenix.ixs.placeMarketOrder({
        authority: process.env.SOLANA_PUBLIC_KEY,
        symbol: `${symbol}-PERP`,
        orderPacket,
      });
      
      // TODO: Send transaction via Solana wallet
      // This requires signing with the user's private key
      // For now, log the instruction
      
      const order = {
        id: `live_${Date.now()}`,
        symbol,
        side,
        type: "market",
        size: positionSize,
        price: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        leverage: signal.leverage,
        timestamp: Date.now(),
        mode: "live",
        status: "submitted",
        instruction: ix ? "built" : "failed",
      };
      
      this.logTrade(order);
      console.log(`🔴 LIVE ${side.toUpperCase()} ${symbol} | Size: ${positionSize.toFixed(4)} @ $${signal.entryPrice?.toFixed(2)}`);
      
      return order;
    } catch (err) {
      console.error(`❌ Execution failed for ${symbol}:`, err.message);
      return { status: "failed", error: err.message };
    }
  }

  // ─── Trade Logging ───────────────────────────────────────
  
  logTrade(order) {
    const dir = path.dirname(TRADE_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(TRADE_LOG, JSON.stringify(order) + "\n");
  }

  getTradeLog() {
    try {
      if (!fs.existsSync(TRADE_LOG)) return [];
      return fs.readFileSync(TRADE_LOG, "utf8")
        .trim().split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }
}
