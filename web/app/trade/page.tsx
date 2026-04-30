"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePhoenixTx } from "@/lib/use-phoenix-tx";

const SYMBOLS = ["SOL", "ETH", "BTC"];

function TradeContent() {
  const searchParams = useSearchParams();
  const defaultSymbol = searchParams.get("symbol") || "SOL";
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { sendInstructions } = usePhoenixTx();

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [market, setMarket] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch(`/api/market?symbol=${symbol}`);
        const data = await res.json();
        setMarket(data);
        if (data.price) {
          const price = data.price as number;
          const atr = price * 0.02;
          setStopLoss(side === "buy" ? (price - atr * 1.5).toFixed(2) : (price + atr * 1.5).toFixed(2));
          setTakeProfit(side === "buy" ? (price + atr * 3).toFixed(2) : (price - atr * 3).toFixed(2));
        }
      } catch {}
    };
    fetchMarket();
  }, [symbol, side]);

  useEffect(() => {
    if (!connected || !publicKey) { setWalletBalance(null); return; }
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/wallet/balance?address=${publicKey.toBase58()}`);
        const data = await res.json();
        setWalletBalance(data.usdc || 0);
      } catch {}
    };
    fetchBalance();
  }, [connected, publicKey]);

  const price = (market?.price as number) || 0;
  const rsi = (market?.rsi as string) || "—";
  const trend = (market?.trend as string) || "unknown";
  const ema = (market?.ema as Record<string, number>) || {};

  const handleSubmit = async () => {
    if (!size || !price) return;
    if (!connected) { setVisible(true); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, side, size: parseFloat(size), price,
          stopLoss: stopLoss ? parseFloat(stopLoss) : null,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          leverage,
          wallet: publicKey?.toBase58(),
        }),
      });
      const data = await res.json();
      if (data.success && data.instructions) {
        setResult("[OK] Building transaction... Please sign in your wallet");
        const { signature, error } = await sendInstructions(data.instructions);
        if (signature) {
          setResult(`[OK] ${side.toUpperCase()} ${size} ${symbol} @ $${price.toFixed(2)} — Tx: ${signature.slice(0, 8)}...`);
        } else {
          setResult(`[ERR] ${error || "Transaction failed"}`);
        }
      } else {
        setResult(`[ERR] ${data.error}`);
      }
      if (data.success) setSize("");
    } catch { setResult("[ERR] Trade execution failed"); }
    setSubmitting(false);
  };

  const notional = size ? parseFloat(size) * price : 0;
  const margin = leverage > 0 ? notional / leverage : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-bold text-[var(--cyan)] glow-cyan tracking-wider">TRADE_EXECUTION</h1>
        <p className="text-[11px] text-[var(--text-dim)] font-mono mt-1">Phoenix perpetuals — sign transactions with your wallet</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="terminal-card space-y-4">
          <div className="terminal-header">
            <span className="text-[11px] font-bold tracking-wider">ORDER_PACKET</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-2 block">Market</label>
              <div className="grid grid-cols-3 gap-1">
                {SYMBOLS.map((s) => (
                  <button key={s} onClick={() => setSymbol(s)} className={`py-2 text-[12px] font-mono font-medium transition-all border ${symbol === s ? "border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10" : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)]"}`}>{s}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => setSide("buy")} className={`py-2.5 text-[12px] font-mono font-bold transition-all border ${side === "buy" ? "border-[var(--green)] text-black bg-[var(--green)]" : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--green)]/50"}`}>LONG</button>
              <button onClick={() => setSide("sell")} className={`py-2.5 text-[12px] font-mono font-bold transition-all border ${side === "sell" ? "border-[var(--red)] text-white bg-[var(--red)]" : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--red)]/50"}`}>SHORT</button>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-2 block">Size ({symbol})</label>
              <input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="0.00" className="terminal-input w-full" />
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[0.1, 0.5, 1, 5].map((v) => (
                  <button key={v} onClick={() => setSize(String(v))} className="py-1 text-[10px] border border-[var(--border)] hover:border-[var(--cyan)]/50 text-[var(--text-secondary)] font-mono transition-colors">{v}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-2 block">Leverage: {leverage}x</label>
              <input type="range" min={1} max={20} value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value))} className="w-full" />
              <div className="flex justify-between text-[9px] text-[var(--text-dim)] font-mono mt-1"><span>1x</span><span>10x</span><span>20x</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-1 block">Stop Loss</label>
                <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="terminal-input w-full text-[11px]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.15em] mb-1 block">Take Profit</label>
                <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="terminal-input w-full text-[11px]" />
              </div>
            </div>

            <div className="p-3 border border-[var(--border)] bg-black/20 space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">Notional</span><span>${notional.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">Margin</span><span>${margin.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">Liq. Price</span><span className="text-[var(--orange)]">~${side === "buy" ? (price * (1 - 1/leverage * 0.9)).toFixed(2) : (price * (1 + 1/leverage * 0.9)).toFixed(2)}</span></div>
              {walletBalance !== null && (
                <div className="flex justify-between border-t border-[var(--border)] pt-1.5 mt-1">
                  <span className="text-[var(--text-dim)]">Balance</span>
                  <span className="text-[var(--cyan)]">${walletBalance.toFixed(2)} USDC</span>
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={submitting || !size || !price} className={`w-full py-3 text-[13px] font-mono font-bold transition-all disabled:opacity-40 border ${side === "buy" ? "border-[var(--green)] text-black bg-[var(--green)] hover:opacity-90" : "border-[var(--red)] text-white bg-[var(--red)] hover:opacity-90"}`}>
              {!connected ? "[ CONNECT WALLET ]" : submitting ? "SIGNING..." : `${side === "buy" ? "LONG" : "SHORT"} ${symbol}`}
            </button>

            {result && (
              <div className={`p-3 text-[11px] font-mono border ${result.startsWith("[OK]") ? "border-[var(--green)] text-[var(--green)] bg-[var(--green)]/5" : "border-[var(--red)] text-[var(--red)] bg-[var(--red)]/5"}`}>
                {result}
              </div>
            )}
          </div>
        </div>

        {/* Market Info */}
        <div className="col-span-2 space-y-4">
          <div className="terminal-card">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[var(--cyan)]">{symbol}</span>
                <div>
                  <div className="text-[11px] text-[var(--text-dim)]">PHOENIX-PERP</div>
                  <div className="text-[10px] text-[var(--text-dim)]">1h candles · orderbook L2</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono">${price.toFixed(2)}</div>
                <div className={`text-[12px] font-mono ${trend === "bullish" ? "text-[var(--green)]" : trend === "bearish" ? "text-[var(--red)]" : "text-[var(--text-tertiary)]"}`}>
                  {trend === "bullish" ? "▲ BULLISH" : trend === "bearish" ? "▼ BEARISH" : "● NEUTRAL"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="terminal-card text-center p-3">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">RSI (14)</div>
              <div className="text-lg font-bold font-mono" style={{ color: parseFloat(rsi) < 30 ? "var(--green)" : parseFloat(rsi) > 70 ? "var(--red)" : "var(--text)" }}>{rsi}</div>
            </div>
            <div className="terminal-card text-center p-3">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Trend</div>
              <div className={`text-lg font-bold font-mono ${trend === "bullish" ? "text-[var(--green)]" : trend === "bearish" ? "text-[var(--red)]" : "text-[var(--text)]"}`}>{trend.toUpperCase()}</div>
            </div>
            <div className="terminal-card text-center p-3">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">EMA</div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)]">
                9:{ema.ema9?.toFixed(1) || "—"} 21:{ema.ema21?.toFixed(1) || "—"}
              </div>
            </div>
          </div>

          <div className="terminal-card">
            <div className="terminal-header">
              <span className="text-[11px] font-bold tracking-wider">ORDER_BOOK_L2</span>
              <span className="text-[10px] text-[var(--text-dim)] ml-auto">spread: {price > 0 ? "0.02%" : "—"}</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-[var(--green)] uppercase tracking-wider mb-2 font-bold">Bids</div>
                {((market?.book as Record<string, unknown>)?.bids as number[][])?.slice(0, 5).map((bid: number[], i: number) => (
                  <div key={i} className="flex justify-between py-1 text-[11px] font-mono">
                    <span className="text-[var(--green)]">${bid[0]?.toFixed(2)}</span>
                    <span className="text-[var(--text-dim)]">{bid[1]?.toFixed(4)}</span>
                  </div>
                )) || <div className="text-[11px] text-[var(--text-dim)] font-mono">Loading...</div>}
              </div>
              <div>
                <div className="text-[10px] text-[var(--red)] uppercase tracking-wider mb-2 font-bold">Asks</div>
                {((market?.book as Record<string, unknown>)?.asks as number[][])?.slice(0, 5).map((ask: number[], i: number) => (
                  <div key={i} className="flex justify-between py-1 text-[11px] font-mono">
                    <span className="text-[var(--red)]">${ask[0]?.toFixed(2)}</span>
                    <span className="text-[var(--text-dim)]">{ask[1]?.toFixed(4)}</span>
                  </div>
                )) || <div className="text-[11px] text-[var(--text-dim)] font-mono">Loading...</div>}
              </div>
            </div>
          </div>

          <div className="terminal-card">
            <div className="terminal-header">
              <span className="text-[11px] font-bold tracking-wider">RECENT_CANDLES</span>
              <span className="text-[10px] text-[var(--text-dim)] ml-auto">1h timeframe</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="terminal-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">High</th>
                    <th className="text-right">Low</th>
                    <th className="text-right">Close</th>
                    <th className="text-right">Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {((market?.candles as Array<Record<string, unknown>>)?.slice(-8).reverse() || []).map((c: Record<string, unknown>, i: number) => {
                    const o = c.open as number; const cl = c.close as number;
                    return (
                      <tr key={i}>
                        <td className="text-[var(--text-dim)]">{new Date((c.time as number) || 0).toLocaleTimeString()}</td>
                        <td className="text-right">${o?.toFixed(2)}</td>
                        <td className="text-right">${(c.high as number)?.toFixed(2)}</td>
                        <td className="text-right">${(c.low as number)?.toFixed(2)}</td>
                        <td className={`text-right ${cl >= o ? "text-[var(--green)]" : "text-[var(--red)]"}`}>${cl?.toFixed(2)}</td>
                        <td className="text-right text-[var(--text-dim)]">{(c.volume as number)?.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[80vh] text-[var(--text-dim)] font-mono">
        <span className="text-[var(--cyan)]">&gt;</span> loading trade module...<span className="animate-blink">_</span>
      </div>
    }>
      <TradeContent />
    </Suspense>
  );
}
