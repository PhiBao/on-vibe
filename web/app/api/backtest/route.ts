import { NextResponse } from "next/server";
import { createPhoenixClient } from "@ellipsis-labs/rise";
import { Backtester } from "@/lib/engine/backtest.js";

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, leverage } = body;

  if (!symbol || typeof leverage !== "number") {
    return NextResponse.json({ error: "Missing symbol or leverage" }, { status: 400 });
  }

  try {
    const client = createPhoenixClient({
      apiUrl: "https://perp-api.phoenix.trade",
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    });
    await client.exchange.ready();

    const raw = await client.api.candles().getCandles(symbol, { timeframe: "1h", limit: 1000 });
    const candles = (raw || []).map((c: { time: number; open: number; high: number; low: number; close: number; volume: number }) => ({
      timestamp: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    if (candles.length < 100) {
      return NextResponse.json({ error: "Insufficient candle data" }, { status: 400 });
    }

    const backtester = new Backtester({
      initialCapital: 10000,
      leverage,
      takerFee: 0.0005,
      makerFee: 0.0002,
      slippage: 0.0003,
      fundingRate: 0.0001,
      maxPositionPct: 0.3,
      commission: 0.001,
    });

    const result = backtester.run(candles, "swarm");

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
