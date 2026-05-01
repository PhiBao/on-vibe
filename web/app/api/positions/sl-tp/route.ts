import { NextResponse } from "next/server";
import { address } from "@solana/kit";
import { defaultAuditor } from "@/lib/security";
import { serializeInstruction } from "@/lib/phoenix-tx";
import { initPhoenix, buildStopLossOrder } from "@/lib/engine/market.js";

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, side, stopLoss, takeProfit, wallet } = body;

  if (!symbol || !side || !wallet) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!stopLoss && !takeProfit) {
    return NextResponse.json({ error: "Must provide stopLoss or takeProfit" }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const rateCheck = defaultAuditor.checkRateLimit(clientIp);
  if (!rateCheck.passed) {
    return NextResponse.json({ error: rateCheck.message }, { status: 429 });
  }

  try {
    const client = await initPhoenix();
    const authority = address(wallet);

    // Build SL and TP as separate instructions.
    // Phoenix auto-creates the conditional orders account if it doesn't exist.
    // The frontend checks SOL balance before calling this endpoint.
    const instructions: any[] = [];
    let slBuilt = false;
    let tpBuilt = false;

    if (stopLoss) {
      try {
        const slIx = await buildStopLossOrder(symbol, authority, side, parseFloat(stopLoss), false);
        instructions.push(serializeInstruction(slIx as any));
        slBuilt = true;
      } catch {
        // Stop-loss build failed silently
      }
    }

    if (takeProfit) {
      try {
        const tpIx = await buildStopLossOrder(symbol, authority, side, parseFloat(takeProfit), true);
        instructions.push(serializeInstruction(tpIx as any));
        tpBuilt = true;
      } catch {
        // Take-profit build failed silently
      }
    }

    if (instructions.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No SL/TP instructions could be built",
        slBuilt,
        tpBuilt,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      instructions,
      symbol,
      side,
      stopLoss,
      takeProfit,
      slBuilt,
      tpBuilt,
      message: `Sign transaction to set ${slBuilt && tpBuilt ? "SL/TP" : slBuilt ? "SL" : "TP"} on ${symbol}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `SL/TP build failed: ${message}` }, { status: 500 });
  }
}
