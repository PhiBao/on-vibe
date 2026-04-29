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

  if (loading) return <div className="flex items-center justify-center h-[80vh] text-[var(--text-tertiary)]">Loading...</div>;

  const stats = (data as { stats?: Record<string, unknown> })?.stats || {};
  const portfolio = (data as { portfolio?: Record<string, unknown> })?.portfolio || {};
  const allOrders = (data as { allOrders?: Array<Record<string, unknown>> })?.allOrders || [];
  const recentTrades = (data as { recentTrades?: Array<Record<string, unknown>> })?.recentTrades || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-bold">Trade Journal</h1>
        <p className="text-[12px] text-[var(--text-tertiary)]">Performance analytics and trade history</p>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Portfolio</div>
          <div className="text-lg font-bold text-[var(--green)]">${(portfolio.value as number || 0).toFixed(2)}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Total PnL</div>
          <div className={`text-lg font-bold ${(portfolio.totalPnl as number || 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
            ${(portfolio.totalPnl as number || 0).toFixed(2)}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Win Rate</div>
          <div className="text-lg font-bold">{stats.winRate as string || "0"}%</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Profit Factor</div>
          <div className="text-lg font-bold">{stats.profitFactor as string || "0"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Total Trades</div>
          <div className="text-lg font-bold">{stats.totalTrades as number || 0}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Wins</div>
          <div className="text-lg font-bold text-[var(--green)]">{stats.wins as number || 0}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Losses</div>
          <div className="text-lg font-bold text-[var(--red)]">{stats.losses as number || 0}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Drawdown</div>
          <div className="text-lg font-bold text-[var(--orange)]">{portfolio.drawdown as string || "0"}%</div>
        </div>
      </div>

      {/* Closed Trades */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">Closed Trades</h2>
        {recentTrades.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">No closed trades yet. Start trading to see results.</div>
        ) : (
          <div className="space-y-1">
            {recentTrades.map((t: Record<string, unknown>, i: number) => {
              const pnl = t.pnl as number || 0;
              const pnlPct = t.pnlPct as number || 0;
              const duration = t.duration as number || 0;
              return (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{pnl >= 0 ? "💰" : "💸"}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${(t.side as string) === "long" ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--red)]/10 text-[var(--red)]"}`}>
                      {(t.side as string).toUpperCase()}
                    </span>
                    <span className="text-[13px] font-medium">{t.symbol as string}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{t.reason as string} · {(duration / 60000).toFixed(0)}m</div>
                  <div className="text-right">
                    <div className={`text-[13px] font-medium ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Orders */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">All Orders</h2>
        {allOrders.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">No orders yet</div>
        ) : (
          <div className="space-y-1">
            {allOrders.map((o: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${(o.side as string) === "buy" ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--red)]/10 text-[var(--red)]"}`}>
                    {(o.side as string).toUpperCase()}
                  </span>
                  <span className="text-[13px]">{o.symbol as string}</span>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">{(o.size as number || 0).toFixed(4)} @ ${(o.price as number || 0).toFixed(2)}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{o.mode as string} · {new Date(o.timestamp as number || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
