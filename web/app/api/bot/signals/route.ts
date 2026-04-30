import { NextResponse } from "next/server";
import { readSignals, expireOldSignals } from "@/lib/bot-signals";

export async function GET() {
  expireOldSignals(300000); // expire signals older than 5 minutes
  const signals = readSignals();
  return NextResponse.json({ signals, count: signals.length });
}
