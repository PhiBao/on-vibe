import { NextResponse } from "next/server";
import { expireOldSignals, readPendingSignals } from "@/lib/data-store";

export async function GET() {
  expireOldSignals(300000);
  const signals = readPendingSignals();
  return NextResponse.json({ signals, count: signals.length });
}
