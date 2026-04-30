import { NextResponse } from "next/server";
import { createPhoenixClient, Side, symbol as phoenixSymbol } from "@ellipsis-labs/rise";
import { address } from "@solana/kit";
import { defaultAuditor } from "@/lib/security";
import { markSignalExecuted, readSignals } from "@/lib/bot-signals";
import { serializeInstruction } from "@/lib/phoenix-tx";

export async function POST(request: Request) {
  const body = await request.json();
  const { signalId, symbol, side, size, price, stopLoss, takeProfit, leverage, wallet } = body;

  if (!signalId || !symbol || !side || !size || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pending = readSignals();
  const sig = pending.find((s) => s.id === signalId);
  if (!sig) {
    return NextResponse.json({ error: "Signal not found or already processed" }, { status: 410 });
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
    const client = createPhoenixClient({
      apiUrl: "https://perp-api.phoenix.trade",
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    });
    await client.exchange.ready();

    const marketSymbol = phoenixSymbol(symbol);

    const orderPacket = await client.orderPackets.buildMarketOrderPacket({
      symbol: marketSymbol,
      side: side === "buy" || side === "long" ? Side.Bid : Side.Ask,
      baseUnits: String(size),
    });

    const ix = await client.ixs.buildPlaceMarketOrder({
      authority: address(wallet),
      symbol: marketSymbol,
      orderPacket,
    });

    const serializedIx = serializeInstruction(ix as unknown as { programAddress: string; accounts: Array<{ address: string; role: number }>; data: Uint8Array });

    markSignalExecuted(signalId);

    return NextResponse.json({
      success: true,
      instructions: [serializedIx],
      signalId,
      message: "Sign transaction in your wallet to submit",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EXECUTE ERROR]", err);
    return NextResponse.json({ error: `Order build failed: ${message}` }, { status: 500 });
  }
}
