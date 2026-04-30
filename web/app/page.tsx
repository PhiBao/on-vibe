"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePhoenixTx } from "@/lib/use-phoenix-tx";

const SYMBOLS = ["SOL", "ETH", "BTC"];

function StatBlock({ label, value, sub, color = "cyan" }: { label: string; value: string; sub?: string; color?: "cyan" | "green" | "red" | "magenta" | "yellow" }) {
  const colorMap = { cyan: "text-[var(--cyan)]", green: "text-[var(--green)]", red: "text-[var(--red)]", magenta: "text-[var(--magenta)]", yellow: "text-[var(--yellow)]" };
  return (
    <div className="terminal-card p-4 animate-in">
      <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">{label}</div>
      <div className={`text-xl font-bold font-mono ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-dim)] mt-1 font-mono">{sub}</div>}
    </div>
  );
}

function MarketRow({ sym, data }: { sym: string; data: Record<string, unknown> }) {
  const price = (data.price as number) || 0;
  const change = parseFloat(data.change24h as string || "0");
  const rsi = parseFloat(data.rsi as string || "50");
  const trend = data.trend as string || "unknown";
  const trendColor = trend === "bullish" ? "text-[var(--green)]" : trend === "bearish" ? "text-[var(--red)]" : "text-[var(--text-tertiary)]";
  const trendLabel = trend === "bullish" ? "LONG_BIAS" : trend === "bearish" ? "SHORT_BIAS" : "NEUTRAL";
  const changeColor = change >= 0 ? "text-[var(--green)]" : "text-[var(--red)]";
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02] px-2 transition-colors">
      <div className="flex items-center gap-3 w-32"><span className="text-[var(--cyan)] text-sm font-bold">{sym}</span><span className="text-[10px] text-[var(--text-dim)]">-PERP</span></div>
      <div className="w-32 text-right"><span className="text-[13px] font-mono font-semibold">${price.toFixed(2)}</span></div>
      <div className={`w-24 text-right text-[11px] font-mono ${changeColor}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</div>
      <div className="w-20 text-right"><span className={`text-[11px] font-mono ${trendColor}`}>{trendLabel}</span></div>
      <div className="w-16 text-right text-[11px] text-[var(--text-tertiary)] font-mono">RSI {rsi.toFixed(1)}</div>
      <a href={`/trade?symbol=${sym}`} className="btn-terminal text-[10px] py-1 px-3 ml-4">EXECUTE</a>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [markets, setMarkets] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState({ running: false, cycle: 0 });
  const [walletData, setWalletData] = useState<Record<string, unknown> | null>(null);
  const [pendingSignals, setPendingSignals] = useState<number>(0);
  const [fundAmount, setFundAmount] = useState("100");
  const [fundAction, setFundAction] = useState<"deposit" | "withdraw">("deposit");
  const [fundStatus, setFundStatus] = useState<string | null>(null);

  const { publicKey, connected } = useWallet();
  const { sendInstructions } = usePhoenixTx();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statusRes, botRes, signalRes] = await Promise.all([
          fetch("/api/status"),
          fetch("/api/bot/status").catch(() => null),
          fetch("/api/bot/signals").catch(() => null),
        ]);
        const statusData = await statusRes.json();
        setStatus(statusData);
        if (botRes) { const botData = await botRes.json(); setBotStatus(botData); }
        if (signalRes) { const sigData = await signalRes.json(); setPendingSignals(sigData.count || 0); }

        const marketData: Record<string, Record<string, unknown>> = {};
        for (const sym of SYMBOLS) {
          try { const res = await fetch(`/api/market?symbol=${sym}`); marketData[sym] = await res.json(); } catch {}
        }
        setMarkets(marketData);
      } catch {}
      setLoading(false);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!connected || !publicKey) { setWalletData(null); return; }
    const fetchWallet = async () => {
      try { const res = await fetch(`/api/wallet/balance?address=${publicKey.toBase58()}`); const data = await res.json(); setWalletData(data); } catch {}
    };
    fetchWallet();
    const interval = setInterval(fetchWallet, 15000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[var(--text-dim)] font-mono text-sm"><span className="text-[var(--cyan)]">&gt;</span> initializing systems...<span className="animate-blink">_</span></div>
      </div>
    );
  }

  const portfolio = (status as { portfolio?: Record<string, unknown> })?.portfolio || {};
  const stats = (status as { stats?: Record<string, unknown> })?.stats || {};
  const positions = (status as { positions?: Array<Record<string, unknown>> })?.positions || [];
  const walletPositions = (walletData?.positions as Array<Record<string, unknown>>) || [];
  const walletUsdc = (walletData?.usdc as number) || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">DASHBOARD</h1>
          <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Multi-strategy swarm trading on Phoenix perpetuals</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingSignals > 0 && (
            <a href="/bots" className="flex items-center gap-2 px-3 py-1.5 terminal-card text-[10px] border border-[var(--yellow)]/30">
              <span className="status-dot warn" />
              <span className="text-[var(--yellow)]">{pendingSignals} SIGNAL{pendingSignals > 1 ? "S" : ""} PENDING</span>
            </a>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 terminal-card text-[10px]">
            <span className={`status-dot ${botStatus.running ? "online" : "offline"}`} />
            <span className={botStatus.running ? "text-[var(--green)]" : "text-[var(--red)]"}>BOT {botStatus.running ? "ACTIVE" : "STANDBY"}</span>
            {botStatus.running && <span className="text-[var(--text-dim)]">cycle #{botStatus.cycle}</span>}
          </div>
        </div>
      </div>

      {connected && walletData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBlock label="Portfolio (Phoenix)" value={`$${walletUsdc.toFixed(2)}`} sub={`${walletPositions.length} open positions`} color="cyan" />
            <StatBlock label="Unrealized PnL" value={`$${walletPositions.reduce((s: number, p: Record<string, unknown>) => s + ((p.unrealizedPnl as number) || 0), 0).toFixed(2)}`} color={walletPositions.reduce((s: number, p: Record<string, unknown>) => s + ((p.unrealizedPnl as number) || 0), 0) >= 0 ? "green" : "red"} />
            <StatBlock label="Win Rate" value={`${stats.winRate as string || "0"}%`} sub={`${stats.totalTrades as number || 0} trades`} color="green" />
            <StatBlock label="Drawdown" value={`${portfolio.drawdown as string || "0"}%`} sub={`PF: ${stats.profitFactor as string || "0"}`} color="yellow" />
          </div>

          <div className="terminal-card border-l-2 border-l-[var(--cyan)]">
            <div className="terminal-header">
              <span className="text-[11px] font-bold tracking-wider">WALLET_OVERVIEW</span>
              <span className="text-[10px] text-[var(--text-dim)] ml-auto">{publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}</span>
            </div>
            <div className="p-4 space-y-4">
              {/* Fund / Withdraw */}
              <div className="flex items-center gap-2">
                <div className="flex border border-[var(--border)]">
                  <button onClick={() => setFundAction("deposit")} className={`px-3 py-1.5 text-[10px] font-mono ${fundAction === "deposit" ? "bg-[var(--green)]/10 text-[var(--green)] border-r border-[var(--border)]" : "text-[var(--text-dim)] border-r border-[var(--border)]"}`}>DEPOSIT</button>
                  <button onClick={() => setFundAction("withdraw")} className={`px-3 py-1.5 text-[10px] font-mono ${fundAction === "withdraw" ? "bg-[var(--red)]/10 text-[var(--red)]" : "text-[var(--text-dim)]"}`}>WITHDRAW</button>
                </div>
                <input type="number" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="terminal-input w-24 text-[11px] py-1.5" placeholder="USDC" />
                <button
                  onClick={async () => {
                    if (!publicKey) return;
                    setFundStatus("Building transaction...");
                    try {
                      const res = await fetch("/api/wallet/fund", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ address: publicKey.toBase58(), amount: parseFloat(fundAmount), action: fundAction }),
                      });
                      const data = await res.json();
                      if (data.success && data.instructions) {
                        setFundStatus("Sign in wallet...");
                        const { signature, error } = await sendInstructions(data.instructions);
                        if (signature) {
                          setFundStatus(`[OK] ${fundAction.toUpperCase()} ${fundAmount} USDC — ${signature.slice(0, 8)}...`);
                        } else {
                          setFundStatus(`[ERR] ${error || "Transaction failed"}`);
                        }
                      } else {
                        setFundStatus(`[ERR] ${data.error}`);
                      }
                    } catch { setFundStatus("[ERR] Request failed"); }
                  }}
                  className={`btn-terminal text-[10px] py-1.5 px-3 ${fundAction === "deposit" ? "btn-terminal-green" : "btn-terminal-red"}`}
                >
                  [ {fundAction.toUpperCase()} ]
                </button>
              </div>
              {fundStatus && (
                <div className={`text-[10px] font-mono ${fundStatus.startsWith("[OK]") ? "text-[var(--green)]" : fundStatus.startsWith("[ERR]") ? "text-[var(--red)]" : "text-[var(--cyan)]"}`}>
                  {fundStatus}
                </div>
              )}

              {walletPositions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">On-Chain Positions</div>
                  {walletPositions.map((pos, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] border border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 border ${(pos.side as string)?.toLowerCase() === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>{(pos.side as string || "?").toUpperCase()}</span>
                        <span className="text-[12px] font-mono font-semibold text-[var(--cyan)]">{pos.symbol as string}</span>
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)]">Size: {(pos.size as number || 0).toFixed(4)}</div>
                      <div className={`text-[11px] font-mono font-bold ${(pos.unrealizedPnl as number || 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{(pos.unrealizedPnl as number || 0) >= 0 ? "+" : ""}${(pos.unrealizedPnl as number || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-[var(--text-dim)] text-[12px] font-mono">No open positions on Phoenix</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="terminal-card p-6 text-center border border-[var(--yellow)]/20">
          <div className="text-[var(--yellow)] text-sm mb-2 font-mono">⚠ WALLET NOT CONNECTED</div>
          <div className="text-[12px] text-[var(--text-dim)] font-mono">Connect your Solana wallet to see real portfolio data from Phoenix</div>
        </div>
      )}

      <div className="terminal-card">
        <div className="terminal-header"><span className="text-[11px] font-bold tracking-wider">MARKET_DATA</span><span className="text-[10px] text-[var(--text-dim)] ml-auto">phoenix.trade/api/v1</span></div>
        <div className="p-4">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase tracking-wider px-2 pb-2 border-b border-[var(--border)] mb-2">
            <span className="w-32">Asset</span><span className="w-32 text-right">Price</span><span className="w-24 text-right">24h</span><span className="w-20 text-right">Signal</span><span className="w-16 text-right">RSI</span><span className="ml-4 w-20" />
          </div>
          {SYMBOLS.map((sym) => (<MarketRow key={sym} sym={sym} data={markets[sym] || {}} />))}
        </div>
      </div>

      {positions.length > 0 && (
        <div className="terminal-card">
          <div className="terminal-header"><span className="text-[11px] font-bold tracking-wider">BOT_POSITIONS</span><span className="text-[10px] text-[var(--text-dim)] ml-auto">{positions.length} active</span></div>
          <div className="p-4 space-y-2">
            {positions.map((pos, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 border ${(pos.side as string) === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>{(pos.side as string).toUpperCase()}</span>
                  <span className="text-[12px] font-mono font-semibold">{pos.symbol as string}</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-mono">Entry: ${(pos.entryPrice as number || 0).toFixed(2)} · {(pos.leverage as number || 1)}x</div>
                <div className="text-[11px] text-[var(--text-dim)] font-mono">SL: <span className="text-[var(--red)]">${(pos.stopLoss as number || 0).toFixed(2)}</span><span className="mx-2 text-[var(--text-dim)]">|</span>TP: <span className="text-[var(--green)]">${(pos.takeProfit as number || 0).toFixed(2)}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="terminal-card">
        <div className="terminal-header"><span className="text-[11px] font-bold tracking-wider">SWARM_STRATEGIES</span><span className="text-[10px] text-[var(--text-dim)] ml-auto">5 parallel engines</span></div>
        <div className="p-4 grid grid-cols-5 gap-3">
          {[
            { name: "TrendFollow", status: "active", icon: "↗" },
            { name: "MeanRev", status: "active", icon: "↔" },
            { name: "Momentum", status: "active", icon: "⤊" },
            { name: "SR_Bounce", status: "active", icon: "⚡" },
            { name: "VolBreak", status: "active", icon: "◊" },
          ].map((s) => (
            <div key={s.name} className="text-center p-3 border border-[var(--border)] bg-white/[0.02] hover:border-[var(--cyan)]/30 transition-colors group">
              <div className="text-[16px] text-[var(--cyan)] mb-1 group-hover:glow-cyan">{s.icon}</div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)]">{s.name}</div>
              <div className="flex items-center justify-center gap-1 mt-1.5"><span className="status-dot online" /><span className="text-[9px] text-[var(--green)] uppercase">{s.status}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
