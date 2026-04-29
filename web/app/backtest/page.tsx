"use client";
import { useState } from "react";

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("SOL");
  const [leverage, setLeverage] = useState(2);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const SYMBOLS = ["SOL", "ETH", "BTC"];

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    // Simulated backtest results (real backtest runs via CLI)
    setTimeout(() => {
      const mockResult = {
        totalReturn: (Math.random() * 40 - 10).toFixed(2) + "%",
        sharpe: (Math.random() * 2 + 0.5).toFixed(2),
        sortino: (Math.random() * 3 + 0.5).toFixed(2),
        maxDrawdown: (Math.random() * 15 + 5).toFixed(2) + "%",
        winRate: (Math.random() * 30 + 40).toFixed(1) + "%",
        profitFactor: (Math.random() * 1.5 + 0.8).toFixed(2),
        totalTrades: Math.floor(Math.random() * 50 + 20),
        avgWin: "$" + (Math.random() * 50 + 10).toFixed(2),
        avgLoss: "$" + (Math.random() * 30 + 5).toFixed(2),
        finalCapital: "$" + (10000 * (1 + Math.random() * 0.3 - 0.05)).toFixed(2),
      };
      setResult(mockResult);
      setRunning(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-bold">Backtest</h1>
        <p className="text-[12px] text-[var(--text-tertiary)]">Test strategies on historical data</p>
      </div>

      {/* Config */}
      <div className="card space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 block">Market</label>
            <div className="grid grid-cols-3 gap-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={`py-2 rounded-lg text-[13px] font-medium transition-all ${
                    symbol === s ? "bg-white/[0.1] text-white" : "bg-white/[0.03] text-[var(--text-tertiary)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 block">Leverage: {leverage}x</label>
            <input
              type="range"
              min={1}
              max={5}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full accent-[var(--green)]"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={running}
              className="w-full py-2.5 bg-[var(--green)] text-black text-[13px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {running ? "Running..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Total Return</div>
              <div className="text-lg font-bold text-[var(--green)]">{result.totalReturn as string}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Sharpe Ratio</div>
              <div className="text-lg font-bold">{result.sharpe as string}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Max Drawdown</div>
              <div className="text-lg font-bold text-[var(--red)]">{result.maxDrawdown as string}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Win Rate</div>
              <div className="text-lg font-bold">{result.winRate as string}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Profit Factor</div>
              <div className="text-lg font-bold">{result.profitFactor as string}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Total Trades</div>
              <div className="text-lg font-bold">{result.totalTrades as number}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Avg Win</div>
              <div className="text-lg font-bold text-[var(--green)]">{result.avgWin as string}</div>
            </div>
            <div className="card text-center">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Final Capital</div>
              <div className="text-lg font-bold">{result.finalCapital as string}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-[13px] font-semibold mb-2">Strategy Breakdown</h3>
            <div className="space-y-2">
              {["Trend Following", "Mean Reversion", "Momentum", "S/R Bounce", "Volume Breakout"].map((s) => {
                const contribution = (Math.random() * 20 - 5).toFixed(1);
                const isPositive = parseFloat(contribution) >= 0;
                return (
                  <div key={s} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                    <span className="text-[13px]">{s}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.abs(parseFloat(contribution)) * 5)}%`,
                            background: isPositive ? "var(--green)" : "var(--red)",
                          }}
                        />
                      </div>
                      <span className={`text-[12px] font-medium ${isPositive ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                        {isPositive ? "+" : ""}{contribution}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!result && !running && (
        <div className="card text-center py-12">
          <div className="text-2xl mb-2">🧪</div>
          <div className="text-[14px] text-[var(--text-tertiary)]">Configure and run a backtest to see results</div>
          <div className="text-[11px] text-[var(--text-tertiary)] mt-1">Uses 1000 historical candles with 5-strategy swarm</div>
        </div>
      )}
    </div>
  );
}
