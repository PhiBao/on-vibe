import { NextResponse } from "next/server";
import { createPhoenixClient } from "@ellipsis-labs/rise";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
  }

  try {
    const client = createPhoenixClient({
      apiUrl: "https://perp-api.phoenix.trade",
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    });
    await client.exchange.ready();

    // Fetch market metadata (best effort — don't let this kill the whole request)
    let marketMeta: Record<string, { baseLotsDecimals: number; tickSize: number }> = {};
    try {
      const markets = await client.api.markets().getMarkets();
      for (const m of markets || []) {
        if (m.symbol) {
          marketMeta[m.symbol] = {
            baseLotsDecimals: typeof m.baseLotsDecimals === "number" ? m.baseLotsDecimals : 0,
            tickSize: typeof m.tickSize === "number" ? m.tickSize : 1,
          };
        }
      }
    } catch {
      // Market metadata is best-effort
    }

    const traderState = await client.api.traders().getTraderStateSnapshot(address);

    // Phoenix can return trader state in multiple shapes — try them all
    // Shape 1: { snapshot: { subaccounts: [...] } }
    // Shape 2: { subaccounts: [...] }
    // Shape 3: { authority, slot, subaccounts: [...] }
    let subaccounts: any[] = [];

    const tsAny = traderState as any;
    if (tsAny?.snapshot?.subaccounts && Array.isArray(tsAny.snapshot.subaccounts)) {
      subaccounts = tsAny.snapshot.subaccounts;
    } else if (tsAny?.subaccounts && Array.isArray(tsAny.subaccounts)) {
      subaccounts = tsAny.subaccounts;
    } else if (tsAny?.traderSubaccounts && Array.isArray(tsAny.traderSubaccounts)) {
      subaccounts = tsAny.traderSubaccounts;
    }

    // If still no subaccounts, try to find any array that looks like positions
    if (subaccounts.length === 0 && tsAny) {
      for (const key of Object.keys(tsAny)) {
        const val = tsAny[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
          // Check if this array looks like subaccounts (has collateral or positions)
          if (val[0].collateral !== undefined || val[0].positions !== undefined) {
            subaccounts = val;
            break;
          }
        }
      }
    }

    let usdc = 0;
    const positions: Array<Record<string, unknown>> = [];

    for (const sub of subaccounts) {
      // collateral can be string, number, or bigint
      let collateralRaw = 0;
      try {
        const c = sub.collateral ?? sub.deposits ?? "0";
        collateralRaw = typeof c === "bigint" ? Number(c) : parseFloat(String(c));
      } catch {}
      usdc += collateralRaw / 1e6;

      const posArray = sub.positions ?? sub.openPositions ?? [];
      for (const p of posArray) {
        if (!p) continue;
        // Phoenix snapshot: symbol is direct string, no marketSymbol wrapper
        const symRaw = p.symbol ?? "";
        const sym = typeof symRaw === "string" ? symRaw : String(symRaw);
        if (!sym) continue;

        // Phoenix uses basePositionLots (raw) or basePositionUnits (human-readable)
        let size = 0;
        try {
          if (p.basePositionUnits) {
            size = parseFloat(String(p.basePositionUnits));
          } else if (p.basePositionLots) {
            const meta = marketMeta[sym] || { baseLotsDecimals: 0, tickSize: 1 };
            const lots = parseFloat(String(p.basePositionLots));
            size = lots / Math.pow(10, meta.baseLotsDecimals);
          }
        } catch {}

        // Skip zero positions
        if (size === 0) continue;

        // Side derived from sign (no explicit side field in snapshot)
        const side = size > 0 ? "long" : "short";
        const absSize = Math.abs(size);

        // Entry price: prefer entryPriceUsd string, else derive
        let entryPrice = 0;
        try {
          if (p.entryPriceUsd) {
            entryPrice = parseFloat(String(p.entryPriceUsd));
          } else if (p.entryPrice) {
            entryPrice = parseFloat(String(p.entryPrice));
          }
        } catch {}

        let unrealizedPnl = 0;
        try {
          const u = p.unrealizedPnl ?? p.upnl ?? 0;
          unrealizedPnl = typeof u === "number" ? u : parseFloat(String(u));
        } catch {}

        positions.push({
          symbol: sym,
          side,
          size: absSize,
          entryPrice,
          unrealizedPnl,
          rawBasePositionLots: p.basePositionLots ?? null,
        });
      }
    }

    // If no positions found, return empty (no debug output)

    return NextResponse.json({
      address,
      usdc,
      positions,
      subaccounts: subaccounts.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ address, usdc: 0, positions: [], error: message });
  }
}
