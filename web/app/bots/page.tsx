"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePhoenixTx } from "@/lib/use-phoenix-tx";

interface TradeSignal {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  longVotes: number;
  shortVotes: number;
  queuedAt: number;
}

interface BotConfig {
  minConfidence: number;
  maxMarginPct: number;
  symbols: string[];
  interval: number;
}

interface MarketLimit {
  maxLeverage: number;
  takerFee: number;
  makerFee: number;
  isolatedOnly: boolean;
}

const DEFAULT_CONFIG: BotConfig = {
  minConfidence: 0.55,
  maxMarginPct: 20,
  symbols: ["SOL", "ETH", "BTC"],
  interval: 60,
};

const ALL_MARKETS = ["SOL", "ETH", "BTC", "XRP", "HYPE", "DOGE", "SUI", "NEAR", "AAVE", "ENA"];

function loadLogs(): string[] {
  try {
    const raw = localStorage.getItem("bot-logs");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLogs(logs: string[]) {
  try { localStorage.setItem("bot-logs", JSON.stringify(logs.slice(-30))); } catch {}
}

export default function BotsPage() {
  const { publicKey, connected } = useWallet();
  const { sendInstructions, getSolBalance } = usePhoenixTx();

  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [running, setRunning] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bot-running") || "false"); } catch { return false; }
  });

  const [logs, setLogs] = useState<string[]>(loadLogs);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoExecute, setAutoExecute] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [marketLimits, setMarketLimits] = useState<Record<string, MarketLimit>>({});
  const [portfolioValue, setPortfolioValue] = useState(0);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist running state
  useEffect(() => {
    try { localStorage.setItem("bot-running", JSON.stringify(running)); } catch {}
  }, [running]);

  // Persist logs (last 5 only)
  useEffect(() => { saveLogs(logs); }, [logs]);

  // Fetch config once on mount
  useEffect(() => {
    fetch("/api/bot/config")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          const mapped: Partial<BotConfig> = {};
          if (typeof data.minConfidence === "number") mapped.minConfidence = data.minConfidence;
          if (typeof data.maxMarginPct === "number") mapped.maxMarginPct = data.maxMarginPct;
          else if (typeof data.maxPositionPct === "number") mapped.maxMarginPct = data.maxPositionPct;
          if (Array.isArray(data.symbols)) mapped.symbols = data.symbols;
          if (typeof data.interval === "number") mapped.interval = data.interval;
          setConfig((prev) => ({ ...prev, ...mapped }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch market limits
  const fetchMarketLimits = useCallback(async () => {
    try {
      const res = await fetch("/api/markets");
      const data = await res.json();
      if (data.markets) setMarketLimits(data.markets);
    } catch {}
  }, []);

  useEffect(() => {
    fetchMarketLimits();
    const interval = setInterval(fetchMarketLimits, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketLimits]);

  // Balance sync
  useEffect(() => {
    if (!connected || !publicKey) return;
    const addr = publicKey.toBase58();

    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/wallet/balance?address=${addr}`);
        const data = await res.json();
        if (typeof data.usdc === "number") {
          setPortfolioValue(data.usdc);
        }
      } catch {}
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  // Run cycle — sends config in body so server doesn't need state
  const runCycle = useCallback(async () => {
    try {
      const body = {
        symbols: config.symbols,
        minConfidence: config.minConfidence,
        maxMarginPct: config.maxMarginPct,
        walletAddress: publicKey?.toBase58() || "",
        portfolioValue,
      };
      const res = await fetch("/api/bot/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ran) return;

      // Append logs from this cycle
      if (data.logs && Array.isArray(data.logs)) {
        setLogs((prev) => [...prev, ...data.logs].slice(-50));
      }

      // Replace signals with fresh ones from this cycle
      if (data.signals && Array.isArray(data.signals)) {
        setSignals(data.signals.map((s: any) => ({ ...s, status: undefined })));
      } else {
        setSignals([]);
      }
    } catch {}
  }, [config.symbols, config.minConfidence, config.maxMarginPct, publicKey, portfolioValue]);

  // Cycle timer
  useEffect(() => {
    if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    if (running) {
      runCycle();
      cycleTimerRef.current = setInterval(runCycle, (config.interval || 60) * 1000);
    }
    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [running, config.interval, runCycle]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-execute
  useEffect(() => {
    if (!autoExecute || !connected || signals.length === 0) return;
    const exec = async () => {
      for (const sig of signals) {
        if (!publicKey) continue;
        await handleExecute(sig);
      }
    };
    exec();
  }, [autoExecute, signals, connected, publicKey]);

  const toggleBot = async () => {
    const nextRunning = !running;
    setRunning(nextRunning);
    try {
      await fetch("/api/bot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
    } catch {}
  };

  const handleExecute = async (sig: TradeSignal) => {
    if (!connected || !publicKey) return;
    setExecutingId(sig.id);
    setExecuteError(null);
    try {
      // Phase 1: Execute market order
      const res = await fetch("/api/bot/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalId: sig.id,
          symbol: sig.symbol,
          side: sig.side,
          size: sig.size,
          price: sig.entryPrice,
          leverage: sig.leverage,
          wallet: publicKey.toBase58(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExecuteError(data.error || `Server error ${res.status}`);
        return;
      }
      if (!data.success || !data.instructions) {
        setExecuteError(data.error || "Failed to build order");
        return;
      }

      const { signature, error } = await sendInstructions(data.instructions);
      if (!signature) {
        setExecuteError(error || "Transaction failed");
        return;
      }

      // Phase 2: Auto-set SL/TP after position is open
      const hasSlTp = sig.stopLoss || sig.takeProfit;
      if (hasSlTp && publicKey) {
        try {
          await new Promise((r) => setTimeout(r, 2000));
          const solBalance = await getSolBalance();
          const minSolNeeded = 0.003;
          if (solBalance >= minSolNeeded) {
            await new Promise((r) => setTimeout(r, 3000));
            const sltpRes = await fetch("/api/positions/sl-tp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                symbol: sig.symbol,
                side: sig.side,
                stopLoss: sig.stopLoss,
                takeProfit: sig.takeProfit,
                wallet: publicKey.toBase58(),
              }),
            });
            const sltpData = await sltpRes.json();
            if (sltpData.success && sltpData.instructions) {
              await sendInstructions(sltpData.instructions);
            }
          }
        } catch {
          // SL/TP failed silently — market order succeeded
        }
      }

      setSignals((prev) => prev.filter((s) => s.id !== sig.id));
    } catch (err: unknown) {
      setExecuteError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setExecutingId(null);
    }
  };

  const updateConfig = (patch: Partial<BotConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  const saveConfig = async () => {
    try {
      await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setHasUnsavedChanges(false);
    } catch {}
  };

  const clearLogs = () => setLogs([]);

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
      <span className="text-[var(--cyan)]">&gt;</span> initializing bot module...<span className="animate-blink">_</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">BOT_CONTROL</h1>
          <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Strategy swarm automation — server-side analysis, client-side execution</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoExecute(!autoExecute)}
            className={`btn-terminal text-[11px] py-2 px-4 ${autoExecute ? "btn-terminal-green" : ""}`}
            disabled={!connected}
            title={connected ? "Auto-sign signals with wallet" : "Connect wallet to enable"}
          >
            {autoExecute ? "[ AUTO: ON ]" : "[ AUTO: OFF ]"}
          </button>
          <button
            onClick={toggleBot}
            className={`btn-terminal text-[12px] py-2 px-6 font-bold ${running ? "btn-terminal-red" : "btn-terminal-green"}`}
          >
            {running ? "[ STOP BOT ]" : "[ START BOT ]"}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`terminal-card p-4 border-l-2 ${running ? "border-l-[var(--green)]" : "border-l-[var(--red)]"}`}>
        <div className="flex items-center gap-3">
          <span className={`status-dot ${running ? "online" : "offline"}`} />
          <span className={`text-[12px] font-mono font-bold ${running ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
            SWARM_BOT {running ? "RUNNING" : "OFFLINE"}
          </span>
          {running && (
            <>
              <span className="text-[var(--text-dim)]">|</span>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                Scanning: {config.symbols.join(", ")} · Interval: {config.interval}s
              </span>
            </>
          )}
          {!connected && (
            <span className="text-[10px] text-[var(--yellow)] font-mono ml-4">⚠ Connect wallet to execute trades</span>
          )}
        </div>
      </div>

      {/* Pending Signals */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">PENDING_SIGNALS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{signals.length} from latest cycle</span>
        </div>
        <div className="p-4">
          {executeError && (
            <div className="mb-3 p-2 border border-[var(--red)]/30 bg-[var(--red)]/5 text-[var(--red)] text-[11px] font-mono">
              [ERR] {executeError}
            </div>
          )}
          {signals.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-dim)] text-[12px] font-mono">
              {running ? "No signals this cycle. Bot is scanning markets..." : "Start the bot to generate signals."}
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map((sig) => (
                <div key={sig.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-[var(--border)] hover:border-[var(--cyan)]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 border ${sig.side === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                      {sig.side.toUpperCase()}
                    </span>
                    <span className="text-[13px] font-mono font-semibold text-[var(--cyan)]">{sig.symbol}</span>
                    <span className="text-[10px] text-[var(--text-dim)] font-mono">@{sig.entryPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-mono text-[var(--text-secondary)] text-right">
                      <div>{sig.size.toFixed(4)} units · ${(sig.size * sig.entryPrice).toFixed(2)}</div>
                      <div>SL: {sig.stopLoss.toFixed(2)} | TP: {sig.takeProfit.toFixed(2)}</div>
                    </div>
                    <div className="text-[10px] font-mono text-right">
                      <div className="text-[var(--cyan)]">conf: {(sig.confidence * 100).toFixed(0)}%</div>
                      <div className="text-[var(--text-dim)]">▲{sig.longVotes} ▼{sig.shortVotes}</div>
                    </div>
                    <button
                      onClick={() => handleExecute(sig)}
                      disabled={!connected || executingId === sig.id}
                      className="btn-terminal btn-terminal-green text-[10px] py-1.5 px-3 disabled:opacity-40"
                    >
                      {executingId === sig.id ? "BUILDING..." : "[ EXECUTE ]"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Config Panel */}
        <div className="terminal-card space-y-4">
          <div className="terminal-header">
            <span className="text-[11px] font-bold tracking-wider">CONFIGURATION</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Portfolio Value Display */}
            <div className="flex items-center justify-between py-2 px-3 bg-white/[0.02] border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em]">Portfolio</span>
              <span className="text-[13px] font-mono text-[var(--cyan)]">${portfolioValue.toFixed(2)}</span>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-2 block">Markets</label>
              <div className="flex gap-2 flex-wrap">
                {ALL_MARKETS.map((s) => {
                  const limit = marketLimits[s];
                  const maxLev = limit?.maxLeverage || "?";
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        const next = config.symbols.includes(s)
                          ? config.symbols.filter((x) => x !== s)
                          : [...config.symbols, s];
                        updateConfig({ symbols: next });
                      }}
                      className={`py-1.5 px-3 text-[11px] font-mono border transition-all ${config.symbols.includes(s) ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10" : "border-[var(--border)] text-[var(--text-dim)]"}`}
                    >
                      {s}
                      <span className="text-[9px] text-[var(--text-dim)] ml-1">({maxLev}x)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em]">Min Confidence: {(config.minConfidence * 100).toFixed(0)}%</label>
                <span className="text-[9px] text-[var(--text-dim)] cursor-help" title="Minimum signal strength required before the bot queues a trade. Higher = fewer but stronger signals.">(?)</span>
              </div>
              <input type="range" min={30} max={90} value={config.minConfidence * 100} onChange={(e) => updateConfig({ minConfidence: parseInt(e.target.value) / 100 })} className="w-full" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em]">Max Margin: {config.maxMarginPct}%</label>
                <span className="text-[9px] text-[var(--text-dim)] cursor-help" title="Percentage of your portfolio to use as margin per trade. 20% of $100 = $20 margin. Position size = margin × market max leverage.">(?)</span>
              </div>
              <input type="range" min={5} max={100} value={config.maxMarginPct} onChange={(e) => updateConfig({ maxMarginPct: parseInt(e.target.value) })} className="w-full" />
              <div className="flex justify-between text-[9px] text-[var(--text-dim)] font-mono mt-1">
                <span>5%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em]">Scan Interval: {config.interval}s</label>
                <span className="text-[9px] text-[var(--text-dim)] cursor-help" title="How often the bot analyzes markets and generates signals.">(?)</span>
              </div>
              <input type="range" min={10} max={300} step={10} value={config.interval} onChange={(e) => updateConfig({ interval: parseInt(e.target.value) })} className="w-full" />
            </div>

            <button
              onClick={saveConfig}
              className={`btn-terminal w-full text-[11px] ${hasUnsavedChanges ? "border-[var(--yellow)] text-[var(--yellow)]" : ""}`}
            >
              [ SAVE CONFIG {hasUnsavedChanges ? "*" : ""} ]
            </button>
          </div>
        </div>

        {/* Live Log */}
        <div className="terminal-card flex flex-col h-[520px]">
          <div className="terminal-header">
            <span className="text-[11px] font-bold tracking-wider">BOT_LOG</span>
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-[10px] text-[var(--text-dim)]">{logs.length} entries</span>
              <button onClick={clearLogs} className="text-[10px] text-[var(--red)] hover:underline">[ clear ]</button>
            </div>
          </div>
          <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-black/30">
            {logs.length === 0 ? (
              <div className="text-[var(--text-dim)] py-4">{running ? "Waiting for log output..." : "Bot is offline. Start to see logs."}</div>
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
      </div>

      {/* Strategy Details */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">STRATEGY_DETAILS</span>
        </div>
        <div className="p-4">
          <table className="terminal-table">
            <thead>
              <tr><th>Engine</th><th>Signal Type</th><th>Best In</th><th>Weight</th><th>Status</th></tr>
            </thead>
            <tbody>
              {[
                { name: "TrendFollow", signal: "EMA cross + RSI filter", best: "Trending markets", weight: "1.0x", status: "active" },
                { name: "MeanReversion", signal: "Bollinger + RSI extremes", best: "Range-bound", weight: "1.0x", status: "active" },
                { name: "Momentum", signal: "MACD hist + volume", best: "Breakouts", weight: "1.0x", status: "active" },
                { name: "SR_Bounce", signal: "Support/Resistance + RSI", best: "Reversals", weight: "1.0x", status: "active" },
                { name: "VolBreakout", signal: "Volume spike + direction", best: "High volatility", weight: "1.0x", status: "active" },
              ].map((s) => (
                <tr key={s.name}>
                  <td className="text-[var(--cyan)] font-mono">{s.name}</td>
                  <td className="text-[var(--text-secondary)]">{s.signal}</td>
                  <td className="text-[var(--text-dim)]">{s.best}</td>
                  <td className="text-[var(--text-secondary)] font-mono">{s.weight}</td>
                  <td><span className="flex items-center gap-1.5"><span className="status-dot online" /><span className="text-[var(--green)] text-[10px]">{s.status}</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
