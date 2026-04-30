"use client";
import { useState, useEffect } from "react";

interface TradeRecord {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  reason: string;
  duration: number;
  confidence: number;
  executedAt?: number;
  txSignature?: string;
}

interface JournalData {
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: string;
    profitFactor: string;
    pending: number;
    expired: number;
    rejected: number;
  };
  recentTrades: TradeRecord[];
  logs: string[];
}

export default function JournalPage() {
  const [data, setData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/journal");
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetch_();
    const interval = setInterval(fetch_, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
      <span className="text-[var(--cyan)]">&gt;</span> loading journal...<span className="animate-blink">_</span>
    </div>
  );

  const stats = data?.stats || { totalTrades: 0, wins: 0, losses: 0, winRate: "0", profitFactor: "0", pending: 0, expired: 0, rejected: 0 };
  const recentTrades = data?.recentTrades || [];
  const logs = data?.logs || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">TRADE_JOURNAL</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Performance analytics and trade history</p>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Total Trades</div>
          <div className="text-lg font-bold font-mono text-[var(--cyan)]">{stats.totalTrades}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Win Rate</div>
          <div className="text-lg font-bold font-mono text-[var(--green)]">{stats.winRate}%</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Profit Factor</div>
          <div className="text-lg font-bold font-mono">{stats.profitFactor}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Pending</div>
          <div className="text-lg font-bold font-mono text-[var(--yellow)]">{stats.pending}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Wins</div>
          <div className="text-lg font-bold font-mono text-[var(--green)]">{stats.wins}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Losses</div>
          <div className="text-lg font-bold font-mono text-[var(--red)]">{stats.losses}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Expired</div>
          <div className="text-lg font-bold font-mono text-[var(--text-dim)]">{stats.expired}</div>
        </div>
        <div className="terminal-card text-center p-3">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Rejected</div>
          <div className="text-lg font-bold font-mono text-[var(--text-dim)]">{stats.rejected}</div>
        </div>
      </div>

      {/* Closed Trades */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">EXECUTED_SIGNALS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{recentTrades.length} records</span>
        </div>
        <div className="p-4">
          {recentTrades.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)] text-[12px] font-mono">No executed trades yet. Start the bot and execute signals to see results.</div>
          ) : (
            <div className="space-y-1">
              {recentTrades.map((t: TradeRecord, i: number) => {
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 hover:bg-white/[0.02] border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 border ${t.side === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                        {t.side.toUpperCase()}
                      </span>
                      <span className="text-[12px] font-mono font-medium text-[var(--cyan)]">{t.symbol}</span>
                      <span className="text-[10px] text-[var(--text-dim)] font-mono">@{t.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">
                      {t.leverage}x · {t.size.toFixed(4)} units · conf: {(t.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                        {t.txSignature ? `${t.txSignature.slice(0, 6)}...${t.txSignature.slice(-4)}` : "pending tx"}
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-dim)]">
                        {t.executedAt ? new Date(t.executedAt).toLocaleTimeString() : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Logs */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">RECENT_LOGS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{logs.length} entries</span>
        </div>
        <div className="p-4 font-mono text-[11px] space-y-1 bg-black/30 max-h-[300px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-[var(--text-dim)] py-4">No logs yet.</div>
          ) : (
            logs.map((line, i) => {
              const isError = line.includes("ERR") || line.includes("error") || line.includes("failed");
              const isSuccess = line.includes("OK") || line.includes("success") || line.includes("SIGNAL QUEUED");
              const isWarn = line.includes("WARN");
              return (
                <div key={i} className={`log-entry ${isError ? "log-error" : isSuccess ? "log-success" : isWarn ? "log-warn" : "log-info"}`}>{line}</div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
