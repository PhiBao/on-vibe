import { NextResponse } from "next/server";
import { createPhoenixClient } from "@ellipsis-labs/rise";

let marketCache: any = null;
let marketCacheTime = 0;

export async function GET() {
  try {
    const now = Date.now();
    if (!marketCache || now - marketCacheTime > 60000) {
      const client = createPhoenixClient({
        apiUrl: "https://perp-api.phoenix.trade",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      });
      await client.exchange.ready();
      marketCache = await client.api.markets().getMarkets();
      marketCacheTime = now;
    }

    const limits: Record<string, { maxLeverage: number; takerFee: number; makerFee: number; isolatedOnly: boolean }> = {};
    for (const m of marketCache || []) {
      if (m.symbol && m.leverageTiers && m.leverageTiers.length > 0) {
        limits[m.symbol] = {
          maxLeverage: m.leverageTiers[0].maxLeverage || 10,
          takerFee: m.takerFee || 0.00035,
          makerFee: m.makerFee || 0.00005,
          isolatedOnly: m.isolatedOnly || false,
        };
      }
    }

    return NextResponse.json({ markets: limits });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
