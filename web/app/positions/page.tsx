"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Position {
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  source?: string;
}

export default function PositionsPage() {
  const { publicKey, connected } = useWallet();
  const [onChainPositions, setOnChainPositions] = useState<Position[]>([]);
  const [onChainUsdc, setOnChainUsdc] = useState(0);
  const [legacyData, setLegacyData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch on-chain positions when wallet connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setOnChainPositions([]);
      setOnChainUsdc(0);
      return;
    }
    const addr = publicKey.toBase58();
    const fetchOnChain = async () => {
      try {
        const res = await fetch(`/api/wallet/balance?address=${addr}`);
        const data = await res.json();
        if (Array.isArray(data.positions)) {
          setOnChainPositions(data.positions.map((p: any) => ({
            symbol: p.symbol || "?",
            side: p.side || "?",
            size: p.size || 0,
            entryPrice: p.entryPrice || 0,
            unrealizedPnl: p.unrealizedPnl || 0,
            leverage: p.leverage,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
          })));
        }
        if (typeof data.usdc === "number") setOnChainUsdc(data.usdc);
      } catch {}
    };
    fetchOnChain();
    const interval = setInterval(fetchOnChain, 15000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  // Fetch legacy server-side positions (for non-wallet view)
  useEffect(() => {
    const fetchLegacy = async () => {
      try {
        const res = await fetch("/api/status");
        setLegacyData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchLegacy();
    const interval = setInterval(fetchLegacy, 15000);
    return () => clearInterval(interval);
  }, []);

  const legacyPositions = (legacyData as { positions?: Array<Record<string, unknown>> })?.positions || [];
  const recentTrades = (legacyData as { recentTrades?: Array<Record<string, unknown>> })?.recentTrades || [];

  // Use on-chain positions when available, else legacy
  const positions: Position[] = onChainPositions.length > 0
    ? onChainPositions
    : legacyPositions.map((p: Record<string, unknown>) => ({
        symbol: String(p.symbol || "?"),
        side: String(p.side || "?"),
        size: Number(p.size || 0),
        entryPrice: Number(p.entryPrice || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        leverage: Number(p.leverage || 1),
        stopLoss: Number(p.stopLoss || 0),
        takeProfit: Number(p.takeProfit || 0),
        source: String(p.source || "bot"),
      }));

  if (loading) return (
    <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
      <span className="text-[var(--cyan)]">&gt;</span> loading positions...<span className="animate-blink">_</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">POSITION_MONITOR</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">On-chain positions from Phoenix perpetuals</p>
      </div>

      {connected && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="terminal-card p-4">
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">USDC Balance</div>
            <div className="text-xl font-bold font-mono text-[var(--cyan)]">${onChainUsdc.toFixed(2)}</div>
          </div>
          <div className="terminal-card p-4">
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">Open Positions</div>
            <div className="text-xl font-bold font-mono text-[var(--cyan)]">{onChainPositions.length}</div>
          </div>
          <div className="terminal-card p-4">
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.15em] mb-2">Unrealized PnL</div>
            <div className={`text-xl font-bold font-mono ${onChainPositions.reduce((s, p) => s + p.unrealizedPnl, 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {onChainPositions.reduce((s, p) => s + p.unrealizedPnl, 0) >= 0 ? "+" : ""}
              ${onChainPositions.reduce((s, p) => s + p.unrealizedPnl, 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Open Positions */}
      <div className="terminal-card">
        <div className="terminal-header">
          <span className="text-[11px] font-bold tracking-wider">OPEN_POSITIONS</span>
          <span className="text-[10px] text-[var(--text-dim)] ml-auto">{positions.length} active {onChainPositions.length > 0 ? "(on-chain)" : ""}</span>
        </div>
        <div className="p-4">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-dim)] text-[12px] font-mono">
              {connected ? "No open positions on Phoenix" : "Connect wallet to see on-chain positions"}
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-[var(--border)] bg-white/[0.02] hover:border-[var(--cyan)]/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-bold px-2 py-1 border ${pos.side === "long" ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--red)] text-[var(--red)]"}`}>
                      {pos.side.toUpperCase()}
                    </span>
                    <div>
                      <div className="text-[13px] font-mono font-semibold text-[var(--cyan)]">{pos.symbol}</div>
                      {pos.source && <div className="text-[10px] text-[var(--text-dim)] font-mono">{pos.source}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-mono font-medium">${pos.entryPrice.toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">{pos.leverage ? `${pos.leverage}x · ` : ""}{pos.size.toFixed(4)} units</div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <div className={`font-bold ${pos.unrealizedPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}
                    </div>
                    {(pos.stopLoss || pos.takeProfit) && (
                      <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                        {pos.stopLoss ? <>SL: <span className="text-[var(--red)]">${pos.stopLoss.toFixed(2)}</span></> : null}
                        {pos.stopLoss && pos.takeProfit ? <span className="mx-1">|</span> : null}
                        {pos.takeProfit ? <>TP: <span className="text-[var(--green)]">${pos.takeProfit.toFixed(2)}</span></> : null}
                      </div>
                    )}
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
