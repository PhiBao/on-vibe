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

    const traderState = await client.api.traders().getTraderStateSnapshot(address);

    // The response structure: { authority, traderPdaIndex, slot, snapshot: { subaccounts: [...] } }
    const ts = traderState as unknown as {
      snapshot?: {
        subaccounts?: Array<{
          collateral: string;
          positions: Array<{
            marketSymbol?: string;
            symbol?: string;
            side?: string;
            baseLots?: number;
            size?: number;
            entryPrice?: number;
            unrealizedPnl?: number;
            quoteLots?: number;
          }>;
        }>;
      };
    };

    let usdc = 0;
    const positions: Array<Record<string, unknown>> = [];

    const subaccounts = ts?.snapshot?.subaccounts || [];
    for (const sub of subaccounts) {
      // collateral is a string representing raw USDC amount (6 decimals)
      const collateralRaw = parseFloat(sub.collateral || "0");
      usdc += collateralRaw / 1e6;

      for (const p of sub.positions || []) {
        positions.push({
          symbol: p.marketSymbol || p.symbol || "?",
          side: p.side || "?",
          size: p.baseLots || p.size || 0,
          entryPrice: p.entryPrice || 0,
          unrealizedPnl: p.unrealizedPnl || 0,
          quoteLots: p.quoteLots || 0,
        });
      }
    }

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
