import { NextResponse } from "next/server";
import { readLogs } from "@/lib/data-store";

export async function GET() {
  const logs = readLogs(200);
  return NextResponse.json({ logs });
}
