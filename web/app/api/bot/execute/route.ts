import { NextResponse } from "next/server";
import { Side, symbol as phoenixSymbol } from "@ellipsis-labs/rise";
import { address } from "@solana/kit";
import { defaultAuditor } from "@/lib/security";
import { serializeInstruction } from "@/lib/phoenix-tx";
import { initPhoenix } from "@/lib/engine/market.js";

export async function POST(request: Request) {
  const body = await request.json();
  const { signalId, symbol, side, size, price, stopLoss, takeProfit, leverage, wallet } = body;

  if (!signalId || !symbol || !side || !size || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const rateCheck = defaultAuditor.checkRateLimit(clientIp);
  if (!rateCheck.passed) {
    return NextResponse.json({ error: rateCheck.message }, { status: 429 });
  }

  const auditChecks = defaultAuditor.auditOrder({ symbol, side, size: parseFloat(size), price: parseFloat(price), leverage, wallet });
  const failedChecks = auditChecks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    const critical = failedChecks.find((c) => c.severity === "critical");
    return NextResponse.json({ error: critical?.message || failedChecks[0].message, checks: auditChecks }, { status: 400 });
  }

  try {
    const client = await initPhoenix();

    const marketSymbol = phoenixSymbol(symbol);
    const authority = address(wallet);

    // Market order only — SL/TP set separately after position confirms
    const orderPacket = await client.orderPackets.buildMarketOrderPacket({
      symbol: marketSymbol,
      side: side === "buy" || side === "long" ? Side.Bid : Side.Ask,
      baseUnits: String(size),
    });

    const marketIx = await client.ixs.buildPlaceMarketOrder({
      authority,
      symbol: marketSymbol,
      orderPacket,
    });

    const instructions = [serializeInstruction(marketIx as any)];

    return NextResponse.json({
      success: true,
      instructions,
      signalId,
      stopLoss,
      takeProfit,
      message: `Sign transaction to submit market order (${side} ${size} ${symbol})`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Order build failed: ${message}` }, { status: 500 });
  }
}
