"use client";
import { useState, useEffect } from "react";

const SYMBOLS = ["SOL", "ETH", "BTC"];

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card animate-in">
      <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-tertiary)] mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [markets, setMarkets] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const statusRes = await fetch("/api/status");
        const statusData = await statusRes.json();
        setStatus(statusData);

        const marketData: Record<string, Record<string, unknown>> = {};
        for (const sym of SYMBOLS) {
          try {
            const res = await fetch(`/api/market?symbol=${sym}`);
            marketData[sym] = await res.json();
          } catch {}
        }
        setMarkets(marketData);
      } catch {}
      setLoading(false);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[var(--text-tertiary)]">Loading dashboard...</div>
      </div>
    );
  }

  const portfolio = (status as { portfolio?: Record<string, unknown> })?.portfolio || {};
  const stats = (status as { stats?: Record<string, unknown> })?.stats || {};
  const positions = (status as { positions?: Array<Record<string, unknown>> })?.positions || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-[12px] text-[var(--text-tertiary)]">Multi-strategy swarm trading on Phoenix perps</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse" />
          Live · {SYMBOLS.length} markets
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Portfolio" value={`$${(portfolio.value as number || 0).toFixed(2)}`} sub={`Peak: $${(portfolio.peak as number || 0).toFixed(2)}`} color="var(--green)" />
        <StatCard label="Total PnL" value={`$${(portfolio.totalPnl as number || 0).toFixed(2)}`} color={(portfolio.totalPnl as number || 0) >= 0 ? "var(--green)" : "var(--red)"} />
        <StatCard label="Win Rate" value={`${stats.winRate as string || "0"}%`} sub={`${stats.totalTrades as number || 0} trades`} />
        <StatCard label="Drawdown" value={`${portfolio.drawdown as string || "0"}%`} sub={`PF: ${stats.profitFactor as string || "0"}`} color="var(--orange)" />
      </div>

      {/* Markets */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">Markets</h2>
        <div className="space-y-3">
          {SYMBOLS.map((sym) => {
            const m = markets[sym] || {};
            const price = m.price as number || 0;
            const change = parseFloat(m.change24h as string || "0");
            const rsi = parseFloat(m.rsi as string || "50");
            const trend = m.trend as string || "unknown";
            const trendColor = trend === "bullish" ? "var(--green)" : trend === "bearish" ? "var(--red)" : "var(--text-tertiary)";
            const trendLabel = trend === "bullish" ? "▲ Bullish" : trend === "bearish" ? "▼ Bearish" : "● Neutral";

            return (
              <div key={sym} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-base font-bold">{sym}</div>
                  <div>
                    <div className="text-[14px] font-semibold">{sym}-PERP</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">Phoenix Perpetuals</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold">${price.toFixed(2)}</div>
                  <div className={`text-[11px] ${change >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                    {change >= 0 ? "+" : ""}{change}% 24h
                  </div>
                </div>
                <div className="text-right ml-6">
                  <div className="text-[12px] font-medium" style={{ color: trendColor }}>{trendLabel}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">RSI {rsi}</div>
                </div>
                <a href={`/trade?symbol=${sym}`} className="ml-4 px-3 py-1.5 bg-[var(--green)]/10 text-[var(--green)] text-[12px] font-medium rounded-lg border border-[var(--green)]/20 hover:bg-[var(--green)]/20 transition-all">
                  Trade →
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Open Positions */}
      {positions.length > 0 && (
        <div className="card">
          <h2 className="text-[14px] font-semibold mb-4">Open Positions</h2>
          <div className="space-y-2">
            {positions.map((pos: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded ${(pos.side as string) === "long" ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--red)]/15 text-[var(--red)]"}`}>
                    {(pos.side as string).toUpperCase()}
                  </span>
                  <span className="text-[13px] font-medium">{pos.symbol as string}</span>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Entry: ${(pos.entryPrice as number || 0).toFixed(2)} · {(pos.leverage as number || 1)}x
                </div>
                <div className="text-[12px] text-[var(--text-tertiary)]">
                  SL: ${(pos.stopLoss as number || 0).toFixed(2)} · TP: ${(pos.takeProfit as number || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Status */}
      <div className="card">
        <h2 className="text-[14px] font-semibold mb-4">Swarm Strategies</h2>
        <div className="grid grid-cols-5 gap-2">
          {["Trend Following", "Mean Reversion", "Momentum", "S/R Bounce", "Volume Breakout"].map((s) => (
            <div key={s} className="text-center p-3 rounded-lg bg-white/[0.02]">
              <div className="text-[12px] font-medium mb-1">{s}</div>
              <div className="w-2 h-2 rounded-full bg-[var(--green)] mx-auto pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
