"use client";
import { useState, useEffect } from "react";

export default function PositionsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/status");
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetch_();
    const interval = setInterval(fetch_, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[80vh] text-[var(--text-tertiary)]">Loading...</div>;

  const positions = (data as { positions?: Array<Record<string, unknown>> })?.positions || [];
  const recentTrades = (data as { recentTrades?: Array<Record<string, unknown>> })?.recentTrades || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-bold">Positions</h1>
        <p className="text-[12px] text-[var(--text-tertiary)]">Open positions and recent exits</p>
      </div>

      {/* Open Positions */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">Open Positions ({positions.length})</h2>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">No open positions</div>
        ) : (
          <div className="space-y-2">
            {positions.map((pos: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <span className={`text-[12px] font-medium px-2 py-1 rounded ${(pos.side as string) === "long" ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--red)]/15 text-[var(--red)]"}`}>
                    {(pos.side as string).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold">{pos.symbol as string}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">{pos.source as string}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium">${(pos.entryPrice as number || 0).toFixed(2)}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{(pos.leverage as number || 1)}x · {(pos.size as number || 0).toFixed(4)} units</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[var(--red)]">SL: ${(pos.stopLoss as number || 0).toFixed(2)}</div>
                  <div className="text-[12px] text-[var(--green)]">TP: ${(pos.takeProfit as number || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Exits */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">Recent Exits</h2>
        {recentTrades.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">No trades yet</div>
        ) : (
          <div className="space-y-1">
            {recentTrades.map((t: Record<string, unknown>, i: number) => {
              const pnl = t.pnl as number || 0;
              return (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{pnl >= 0 ? "💰" : "💸"}</span>
                    <span className={`text-[12px] font-medium px-2 py-0.5 rounded ${(t.side as string) === "long" ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--red)]/10 text-[var(--red)]"}`}>
                      {(t.side as string).toUpperCase()}
                    </span>
                    <span className="text-[13px] font-medium">{t.symbol as string}</span>
                  </div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">{t.reason as string}</div>
                  <div className={`text-[13px] font-medium ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
