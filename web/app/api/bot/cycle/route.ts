import { NextResponse } from "next/server";
import { createPhoenixClient } from "@ellipsis-labs/rise";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const symbols: string[] = body.symbols || ["SOL", "ETH", "BTC"];
  const minConfidence = body.minConfidence || 0.55;
  const maxMarginPct = body.maxMarginPct || 20;
  const walletAddress = body.walletAddress || "";
  const portfolioValueFromClient = body.portfolioValue || 0;

  const logs: string[] = [];
  function log(line: string) {
    logs.push(line);
  }

  log(`🔄 Cycle start`);

  // Fetch real balance + positions if wallet connected
  let portfolioValue = portfolioValueFromClient || 1000;
  const onChainPositions: Array<{ symbol: string; side: string }> = [];

  if (walletAddress) {
    try {
      const client = createPhoenixClient({
        apiUrl: "https://perp-api.phoenix.trade",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      });
      await client.exchange.ready();

      const traderState = await client.api.traders().getTraderStateSnapshot(walletAddress);

      // Raw debug dump — log the top-level keys so we know the structure
      log(`  [debug] traderState keys: ${Object.keys(traderState as any).join(", ")}`);
      const tsAny = traderState as any;
      if (tsAny.snapshot) {
        log(`  [debug] snapshot keys: ${Object.keys(tsAny.snapshot).join(", ")}`);
      }

      // Try multiple response structures
      let subaccounts: any[] = [];
      if (tsAny?.snapshot?.subaccounts && Array.isArray(tsAny.snapshot.subaccounts)) {
        subaccounts = tsAny.snapshot.subaccounts;
        log(`  [debug] using snapshot.subaccounts (${subaccounts.length})`);
      } else if (tsAny?.subaccounts && Array.isArray(tsAny.subaccounts)) {
        subaccounts = tsAny.subaccounts;
        log(`  [debug] using root subaccounts (${subaccounts.length})`);
      } else if (tsAny?.traderSubaccounts && Array.isArray(tsAny.traderSubaccounts)) {
        subaccounts = tsAny.traderSubaccounts;
        log(`  [debug] using traderSubaccounts (${subaccounts.length})`);
      } else {
        log(`  [debug] no subaccounts array found — dumping raw state`);
        try {
          const rawStr = JSON.stringify(tsAny).slice(0, 500);
          log(`  [debug] raw: ${rawStr}...`);
        } catch {}
      }

      let usdc = 0;
      for (const sub of subaccounts) {
        try {
          const c = sub.collateral ?? sub.deposits ?? "0";
          const collateralRaw = typeof c === "bigint" ? Number(c) : parseFloat(String(c));
          usdc += collateralRaw / 1e6;
        } catch {}

        // Log subaccount keys to find where positions live
        log(`  [debug] subaccount keys: ${Object.keys(sub).join(", ")}`);

        const posArray = sub.positions ?? sub.openPositions ?? [];
        log(`  [debug] positions count: ${posArray.length}`);

        for (const p of posArray) {
          if (!p) continue;
          // Log raw position object keys
          log(`  [debug] position keys: ${Object.keys(p).join(", ")}`);

          const symRaw = p.symbol ?? "";
          const sym = typeof symRaw === "string" ? symRaw : String(symRaw);

          // Phoenix snapshot uses basePositionLots (raw) or basePositionUnits (human-readable)
          let size = 0;
          try {
            if (p.basePositionUnits) {
              size = parseFloat(String(p.basePositionUnits));
            } else if (p.basePositionLots) {
              size = parseFloat(String(p.basePositionLots));
            }
          } catch {}

          // Side is determined by sign — no explicit side field in snapshot
          const side = size > 0 ? "long" : size < 0 ? "short" : "";
          log(`  [debug] pos parsed: sym=${sym} side=${side} size=${size}`);
          if (sym && size !== 0) {
            onChainPositions.push({ symbol: sym, side });
          }
        }
      }
      if (usdc > 0) portfolioValue = usdc;
      log(`  Wallet: $${portfolioValue.toFixed(2)} | ${onChainPositions.length} on-chain positions`);
    } catch (err: unknown) {
      log(`  ⚠ Balance fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    log(`  ⚠ No wallet address provided — cannot check on-chain positions`);
  }

  // Import engine modules dynamically
  const { initPhoenix, getCandles, getCurrentPrice, getFundingRate, getAllMarketLimits } = await import("@/lib/engine/market.js");
  const { TrendFollowing, MeanReversion, Momentum, SRBounce, VolumeBreakout, synthesizeSignals } = await import("@/lib/engine/signals.js");
  const { analyzeFunding } = await import("@/lib/engine/funding.js");

  let phoenix = null;
  try {
    phoenix = await initPhoenix();
  } catch (err: unknown) {
    log(`⚠ Phoenix init failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Fetch dynamic market limits
  let marketLimits: Record<string, any> = {};
  try {
    marketLimits = await getAllMarketLimits();
  } catch {}

  const signalsGenerated: Array<Record<string, unknown>> = [];

  for (const symbol of symbols) {
    try {
      const candles = await getCandles(symbol, "1h", 100);
      if (!candles || candles.length < 50) {
        log(`  ${symbol}: insufficient data (${candles?.length || 0})`);
        continue;
      }

      const price = await getCurrentPrice(symbol) || candles[candles.length - 1].close;

      const strategies = [
        TrendFollowing(candles),
        MeanReversion(candles),
        Momentum(candles),
        SRBounce(candles),
        VolumeBreakout(candles),
      ];

      let fundingSignal: { signal: number; confidence: number } = { signal: 0, confidence: 0 };
      try {
        const fundingData = await getFundingRate(symbol);
        if (fundingData) {
          const fa = analyzeFunding([fundingData], price) as { signal: number; confidence: number };
          fundingSignal = { signal: fa.signal || 0, confidence: fa.confidence || 0 };
        }
      } catch {}

      // Use market-specific max leverage from Phoenix
      const marketMaxLev = marketLimits[symbol]?.maxLeverage || 10;
      const margin = portfolioValue * (maxMarginPct / 100);
      const notional = margin * marketMaxLev;
      const positionSize = notional / price;

      const combined = synthesizeSignals(strategies, price, { maxLeverage: marketMaxLev });
      if (fundingSignal.signal !== 0) {
        combined.signal = combined.signal * 0.8 + fundingSignal.signal * 0.2;
        combined.confidence = Math.min(1, combined.confidence + fundingSignal.confidence * 0.1);
      }

      const stratLog = strategies.map((s: {name: string; signal: number}) => `${s.name.slice(0,6)}:${s.signal > 0 ? "▲" : s.signal < 0 ? "▼" : "◆"}${s.signal.toFixed(1)}`).join(" ");
      log(`  ${symbol}: $${price.toFixed(2)} ${combined.signal > 0 ? "▲" : combined.signal < 0 ? "▼" : "◆"} sig:${combined.signal.toFixed(2)} conf:${(combined.confidence * 100).toFixed(1)}% maxLev:${marketMaxLev}x | ${stratLog}`);

      if (combined.action === "hold" || combined.confidence < minConfidence) {
        if (combined.confidence < minConfidence) {
          log(`    ⏸ Below threshold (${(combined.confidence * 100).toFixed(1)}% < ${(minConfidence * 100).toFixed(1)}%)`);
        } else if (combined.holdReason) {
          log(`    ⏸ Hold: ${combined.holdReason} (sig:${combined.signal.toFixed(2)} conf:${(combined.confidence * 100).toFixed(1)}% votes:▲${combined.longVotes}▼${combined.shortVotes})`);
        } else {
          log(`    ⏸ Hold: weak signal (sig:${combined.signal.toFixed(2)})`);
        }
        continue;
      }

      // Check real on-chain positions — don't duplicate
      const hasPosition = onChainPositions.find((p) => p.symbol === symbol);
      if (hasPosition) {
        log(`    ⏸ Already have ${hasPosition.side} position on ${symbol} (on-chain)`);
        continue;
      }

      const signal = {
        id: `sig_${Date.now()}_${symbol}`,
        symbol,
        side: combined.action,
        entryPrice: price,
        size: positionSize,
        leverage: marketMaxLev,
        stopLoss: combined.stopLoss,
        takeProfit: combined.takeProfit,
        confidence: combined.confidence,
        longVotes: combined.longVotes,
        shortVotes: combined.shortVotes,
        details: combined.details,
        queuedAt: Date.now(),
      };
      signalsGenerated.push(signal);
      log(`    🔔 SIGNAL: ${combined.action.toUpperCase()} ${symbol} | $${price.toFixed(2)} | ${positionSize.toFixed(4)} units | SL:${combined.stopLoss?.toFixed(2)} | TP:${combined.takeProfit?.toFixed(2)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ${symbol}: Error — ${msg}`);
    }
  }

  log(`📊 Portfolio: $${portfolioValue.toFixed(2)} | Signals: ${signalsGenerated.length} | Positions: ${onChainPositions.length}`);

  return NextResponse.json({
    ran: true,
    logs,
    signals: signalsGenerated,
    portfolioValue,
    onChainPositions,
  });
}
