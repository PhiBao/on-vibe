import { NextResponse } from "next/server";
import { createPhoenixClient } from "@ellipsis-labs/rise";
import { address as solanaAddress } from "@solana/kit";
import { defaultAuditor } from "@/lib/security";
import { serializeInstruction } from "@/lib/phoenix-tx";

export async function POST(request: Request) {
  const body = await request.json();
  const { address, amount, action } = body;

  if (!address || !amount || !action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for") || "unknown";
  const rateCheck = defaultAuditor.checkRateLimit(clientIp);
  if (!rateCheck.passed) {
    return NextResponse.json({ error: rateCheck.message }, { status: 429 });
  }

  try {
    const client = createPhoenixClient({
      apiUrl: "https://perp-api.phoenix.trade",
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    });
    await client.exchange.ready();

    if (action === "deposit") {
      const result = await client.ixs.buildDepositIxs({
        authority: solanaAddress(address),
        amount: BigInt(Math.round(amount * 1e6)), // USDC has 6 decimals
      });

      const instructions = [
        ...(result.instructions || []),
      ].map((ix: any) => serializeInstruction(ix));

      return NextResponse.json({
        success: true,
        action: "deposit",
        amount,
        instructions,
        message: "Sign transaction to deposit USDC into Phoenix",
      });
    } else if (action === "withdraw") {
      const result = await client.ixs.buildWithdrawIxs({
        authority: solanaAddress(address),
        amount: BigInt(Math.round(amount * 1e6)),
      });

      const instructions = [
        ...(result.instructions || []),
      ].map((ix: any) => serializeInstruction(ix));

      return NextResponse.json({
        success: true,
        action: "withdraw",
        amount,
        instructions,
        message: "Sign transaction to withdraw USDC from Phoenix",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `${action} failed: ${message}` }, { status: 500 });
  }
}
