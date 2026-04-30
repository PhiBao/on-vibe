"use client";
import { useState, useEffect } from "react";

function loadLogs(): string[] {
  try {
    const raw = localStorage.getItem("bot-logs");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export default function JournalPage() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setLogs(loadLogs());
    const interval = setInterval(() => setLogs(loadLogs()), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">TRADE_JOURNAL</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Bot logs and signal history</p>
      </div>

      {/* Logs */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">BOT_LOGS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{logs.length} entries (last 30 stored)</span>
        </div>
        <div className="p-4 font-mono text-[11px] space-y-1 bg-black/30 max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-[var(--text-dim)] py-4">No logs yet. Start the bot to see activity.</div>
          ) : (
            logs.map((line, i) => {
              const isError = line.includes("ERR") || line.includes("error") || line.includes("failed");
              const isSuccess = line.includes("OK") || line.includes("success") || line.includes("SIGNAL");
              const isWarn = line.includes("WARN") || line.includes("⚠") || line.includes("⏸");
              return (
                <div key={i} className={`log-entry ${isError ? "log-error" : isSuccess ? "log-success" : isWarn ? "log-warn" : "log-info"}`}>{line}</div>
              );
            })
          )}
        </div>
      </div>

      {/* Note */}
      <div className="terminal-card p-4 text-[11px] text-[var(--text-dim)] font-mono">
        <span className="text-[var(--yellow)]">⚠</span> Signals are session-only and not persisted. Execute them immediately when they appear. For full trade history, check your wallet activity on <a href="https://solscan.io" target="_blank" rel="noopener noreferrer" className="text-[var(--cyan)] hover:underline">Solscan</a>.
      </div>
    </div>
  );
}
