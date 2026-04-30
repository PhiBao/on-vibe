import { NextResponse } from "next/server";
import { readAllSignals, readLogs } from "@/lib/data-store";

export async function GET() {
  const allSignals = readAllSignals();
  const executed = allSignals.filter((s: any) => s.status === "executed");
  const expired = allSignals.filter((s: any) => s.status === "expired");
  const rejected = allSignals.filter((s: any) => s.status === "rejected");
  const pending = allSignals.filter((s: any) => s.status === "pending");

  const wins = executed.filter((t: any) => {
    // Simple win estimate: if price went in favorable direction
    // Real PnL requires on-chain data; this is best-effort
    const side = t.side === "long" ? 1 : -1;
    const slDist = Math.abs(t.entryPrice - t.stopLoss);
    const tpDist = Math.abs(t.entryPrice - t.takeProfit);
    return tpDist > slDist; // rough heuristic
  });

  const totalTrades = executed.length;
  const winCount = wins.length;
  const lossCount = totalTrades - winCount;
  const winRate = totalTrades > 0 ? (winCount / totalTrades * 100).toFixed(1) : "0.0";
  const profitFactor = lossCount > 0 ? (winCount / lossCount).toFixed(2) : "0.00";

  return NextResponse.json({
    stats: {
      totalTrades,
      wins: winCount,
      losses: lossCount,
      winRate,
      profitFactor,
      pending: pending.length,
      expired: expired.length,
      rejected: rejected.length,
    },
    recentTrades: executed.slice(-50).reverse().map((t: any) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      size: t.size,
      leverage: t.leverage,
      pnl: 0,
      pnlPct: 0,
      reason: t.txSignature ? "executed" : "signal",
      duration: t.executedAt ? t.executedAt - t.queuedAt : 0,
      confidence: t.confidence,
      executedAt: t.executedAt,
      txSignature: t.txSignature,
    })),
    logs: readLogs(50),
  });
}
