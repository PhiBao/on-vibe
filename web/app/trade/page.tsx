"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const SYMBOLS = ["SOL", "ETH", "BTC"];

function TradeContent() {
  const searchParams = useSearchParams();
  const defaultSymbol = searchParams.get("symbol") || "SOL";
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [market, setMarket] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

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

  const price = (market?.price as number) || 0;
  const rsi = (market?.rsi as string) || "—";
  const trend = (market?.trend as string) || "unknown";
  const trendColor = trend === "bullish" ? "text-[var(--green)]" : trend === "bearish" ? "text-[var(--red)]" : "text-[var(--text-tertiary)]";
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
          leverage, mode: "paper",
          wallet: publicKey?.toBase58(),
        }),
      });
      const data = await res.json();
      setResult(data.success ? `✅ ${side.toUpperCase()} ${size} ${symbol} @ $${price.toFixed(2)}` : `❌ ${data.error}`);
      if (data.success) setSize("");
    } catch { setResult("❌ Trade failed"); }
    setSubmitting(false);
  };

  const notional = size ? parseFloat(size) * price : 0;
  const margin = leverage > 0 ? notional / leverage : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-bold">Trade</h1>
        <p className="text-[12px] text-[var(--text-tertiary)]">Execute trades on Phoenix perpetuals</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="col-span-1 card space-y-4">
          {/* Symbol */}
          <div>
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 block">Market</label>
            <div className="grid grid-cols-3 gap-1">
              {SYMBOLS.map((s) => (
                <button key={s} onClick={() => setSymbol(s)} className={`py-2 rounded-lg text-[13px] font-medium transition-all ${symbol === s ? "bg-white/[0.1] text-white" : "bg-white/[0.03] text-[var(--text-tertiary)] hover:bg-white/[0.06]"}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => setSide("buy")} className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${side === "buy" ? "bg-[var(--green)] text-black" : "bg-white/[0.03] text-[var(--text-tertiary)]"}`}>Long</button>
            <button onClick={() => setSide("sell")} className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${side === "sell" ? "bg-[var(--red)] text-white" : "bg-white/[0.03] text-[var(--text-tertiary)]"}`}>Short</button>
          </div>

          {/* Size */}
          <div>
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 block">Size ({symbol})</label>
            <input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] focus:outline-none focus:border-[var(--green)]/50" />
            <div className="grid grid-cols-4 gap-1 mt-2">
              {[0.1, 0.5, 1, 5].map((v) => (
                <button key={v} onClick={() => setSize(String(v))} className="py-1 rounded text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text-secondary)]">{v}</button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 block">Leverage: {leverage}x</label>
            <input type="range" min={1} max={5} value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value))} className="w-full accent-[var(--green)]" />
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]"><span>1x</span><span>3x</span><span>5x</span></div>
          </div>

          {/* SL/TP */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block">Stop Loss</label>
              <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block">Take Profit</label>
              <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] focus:outline-none" />
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-white/[0.02] space-y-1 text-[12px]">
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Notional</span><span>${notional.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Margin</span><span>${margin.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Liq. Price</span><span className="text-[var(--orange)]">~${side === "buy" ? (price * (1 - 1/leverage * 0.9)).toFixed(2) : (price * (1 + 1/leverage * 0.9)).toFixed(2)}</span></div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={submitting || !size || !price} className={`w-full py-3 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-40 ${side === "buy" ? "bg-[var(--green)] text-black hover:opacity-90" : "bg-[var(--red)] text-white hover:opacity-90"}`}>
            {!connected ? "Connect Wallet to Trade" : submitting ? "Executing..." : `${side === "buy" ? "Long" : "Short"} ${symbol}`}
          </button>

          {result && <div className={`p-3 rounded-lg text-[12px] ${result.startsWith("✅") ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--red)]/10 text-[var(--red)]"}`}>{result}</div>}
        </div>

        {/* Market Info */}
        <div className="col-span-2 space-y-4">
          {/* Price Header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg font-bold">{symbol}</div>
                <div>
                  <div className="text-lg font-bold">{symbol}-PERP</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">Phoenix Perpetuals · 1h candles</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${price.toFixed(2)}</div>
                <div className={`text-[13px] font-medium ${trendColor}`}>{trend === "bullish" ? "▲ Bullish" : trend === "bearish" ? "▼ Bearish" : "● Neutral"}</div>
              </div>
            </div>
          </div>

          {/* Indicators */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <div className="text-[11px] text-[var(--text-tertiary)] mb-1">RSI (14)</div>
              <div className="text-lg font-bold" style={{ color: parseFloat(rsi) < 30 ? "var(--green)" : parseFloat(rsi) > 70 ? "var(--red)" : "var(--text)" }}>{rsi}</div>
            </div>
            <div className="card text-center">
              <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Trend</div>
              <div className="text-lg font-bold" style={{ color: trendColor }}>{trend}</div>
            </div>
            <div className="card text-center">
              <div className="text-[11px] text-[var(--text-tertiary)] mb-1">EMA</div>
              <div className="text-[11px]">9: {ema.ema9?.toFixed(2) || "—"} · 21: {ema.ema21?.toFixed(2) || "—"} · 50: {ema.ema50?.toFixed(2) || "—"}</div>
            </div>
          </div>

          {/* Orderbook */}
          <div className="card">
            <h3 className="text-[13px] font-semibold mb-3">Order Book</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)] mb-2">BIDS</div>
                {((market?.book as Record<string, unknown>)?.bids as number[][])?.slice(0, 5).map((bid: number[], i: number) => (
                  <div key={i} className="flex justify-between py-1 text-[12px]"><span className="text-[var(--green)]">${bid[0]?.toFixed(2)}</span><span className="text-[var(--text-tertiary)]">{bid[1]?.toFixed(4)}</span></div>
                )) || <div className="text-[12px] text-[var(--text-tertiary)]">Loading...</div>}
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)] mb-2">ASKS</div>
                {((market?.book as Record<string, unknown>)?.asks as number[][])?.slice(0, 5).map((ask: number[], i: number) => (
                  <div key={i} className="flex justify-between py-1 text-[12px]"><span className="text-[var(--red)]">${ask[0]?.toFixed(2)}</span><span className="text-[var(--text-tertiary)]">{ask[1]?.toFixed(4)}</span></div>
                )) || <div className="text-[12px] text-[var(--text-tertiary)]">Loading...</div>}
              </div>
            </div>
          </div>

          {/* Recent Candles */}
          <div className="card">
            <h3 className="text-[13px] font-semibold mb-3">Recent Candles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-[var(--text-tertiary)]"><th className="text-left py-1">Time</th><th className="text-right">Open</th><th className="text-right">High</th><th className="text-right">Low</th><th className="text-right">Close</th><th className="text-right">Vol</th></tr></thead>
                <tbody>
                  {((market?.candles as Array<Record<string, unknown>>)?.slice(-8).reverse() || []).map((c: Record<string, unknown>, i: number) => {
                    const o = c.open as number; const cl = c.close as number;
                    return (
                      <tr key={i} className="border-t border-white/[0.04]">
                        <td className="py-1 text-[var(--text-tertiary)]">{new Date((c.time as number) || 0).toLocaleTimeString()}</td>
                        <td className="text-right">${o?.toFixed(2)}</td><td className="text-right">${(c.high as number)?.toFixed(2)}</td><td className="text-right">${(c.low as number)?.toFixed(2)}</td>
                        <td className={`text-right ${cl >= o ? "text-[var(--green)]" : "text-[var(--red)]"}`}>${cl?.toFixed(2)}</td>
                        <td className="text-right text-[var(--text-tertiary)]">{(c.volume as number)?.toFixed(1)}</td>
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
  return <Suspense fallback={<div className="flex items-center justify-center h-[80vh] text-[var(--text-tertiary)]">Loading...</div>}><TradeContent /></Suspense>;
}
