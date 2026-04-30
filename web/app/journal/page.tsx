"use client";
import { useState, useEffect } from "react";

export default function JournalPage() {
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
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
      <span className="text-[var(--cyan)]">&gt;</span> loading journal...<span className="animate-blink">_</span>
    </div>
  );

  const stats = (data as { stats?: Record<string, unknown> })?.stats || {};
  const portfolio = (data as { portfolio?: Record<string, unknown> })?.portfolio || {};
  const recentTrades = (data as { recentTrades?: Array<Record<string, unknown>> })?.recentTrades || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">TRADE_JOURNAL</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Performance analytics and trade history</p>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Portfolio</div>
          <div className="text-lg font-bold font-mono text-[var(--cyan)]">${(portfolio.value as number || 0).toFixed(2)}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Total PnL</div>
          <div className={`text-lg font-bold font-mono ${(portfolio.totalPnl as number || 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
            ${(portfolio.totalPnl as number || 0).toFixed(2)}
          </div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Win Rate</div>
          <div className="text-lg font-bold font-mono">{stats.winRate as string || "0"}%</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Profit Factor</div>
          <div className="text-lg font-bold font-mono">{stats.profitFactor as string || "0"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Total Trades</div>
          <div className="text-lg font-bold font-mono">{stats.totalTrades as number || 0}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Wins</div>
          <div className="text-lg font-bold font-mono text-[var(--green)]">{stats.wins as number || 0}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Losses</div>
          <div className="text-lg font-bold font-mono text-[var(--red)]">{stats.losses as number || 0}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Drawdown</div>
          <div className="text-lg font-bold font-mono text-[var(--yellow)]">{portfolio.drawdown as string || "0"}%</div>
        </div>
      </div>

      {/* Closed Trades */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">CLOSED_TRADES</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{recentTrades.length} records</span>
        </div>
        <div className="p-4">
          {recentTrades.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)] text-[12px] font-mono">No closed trades yet. Start trading to see results.</div>
          ) : (
            <div className="space-y-1">
              {recentTrades.map((t: Record<string, unknown>, i: number) => {
                const pnl = t.pnl as number || 0;
                const pnlPct = t.pnlPct as number || 0;
                const duration = t.duration as number || 0;
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 hover:bg-white/[0.02] border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-dim)]">{pnl >= 0 ? "▲" : "▼"}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border ${(t.side as string) === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                        {(t.side as string).toUpperCase()}
                      </span>
                      <span className="text-[12px] font-mono font-medium">{t.symbol as string}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">{t.reason as string} · {(duration / 60000).toFixed(0)}m</div>
                    <div className="text-right">
                      <div className={`text-[12px] font-mono font-bold ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </div>
                      <div className={`text-[9px] font-mono ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                        {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                      </div>
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
