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

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
      <span className="text-[var(--cyan)]">&gt;</span> loading positions...<span className="animate-blink">_</span>
    </div>
  );

  const positions = (data as { positions?: Array<Record<string, unknown>> })?.positions || [];
  const recentTrades = (data as { recentTrades?: Array<Record<string, unknown>> })?.recentTrades || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">POSITION_MONITOR</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Open positions and recent exits</p>
      </div>

      {/* Open Positions */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">OPEN_POSITIONS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{positions.length} active</span>
        </div>
        <div className="p-4">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)] text-[12px] font-mono">No open positions</div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos: Record<string, unknown>, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 border border-[var(--border)] bg-white/[0.02] hover:border-[var(--cyan)]/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-bold px-2 py-1 border ${(pos.side as string) === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                      {(pos.side as string).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-[13px] font-mono font-semibold text-[var(--cyan)]">{pos.symbol as string}</div>
                      <div className="text-[10px] text-[var(--text-dim)] font-mono">{pos.source as string}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-mono font-medium">${(pos.entryPrice as number || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">{(pos.leverage as number || 1)}x · {(pos.size as number || 0).toFixed(4)} units</div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <div>SL: <span className="text-[var(--red)]">${(pos.stopLoss as number || 0).toFixed(2)}</span></div>
                    <div>TP: <span className="text-[var(--green)]">${(pos.takeProfit as number || 0).toFixed(2)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Exits */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">RECENT_EXITS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">last 20 trades</span>
        </div>
        <div className="p-4">
          {recentTrades.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)] text-[12px] font-mono">No trades yet</div>
          ) : (
            <div className="space-y-1">
              {recentTrades.map((t: Record<string, unknown>, i: number) => {
                const pnl = t.pnl as number || 0;
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 hover:bg-white/[0.02] border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-dim)]">{pnl >= 0 ? "▲" : "▼"}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border ${(t.side as string) === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                        {(t.side as string).toUpperCase()}
                      </span>
                      <span className="text-[12px] font-mono font-medium">{t.symbol as string}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] font-mono">{t.reason as string}</div>
                    <div className={`text-[12px] font-mono font-bold ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
