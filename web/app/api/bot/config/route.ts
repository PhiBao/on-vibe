import { NextResponse } from "next/server";
import { readBotConfig, writeBotConfig } from "@/lib/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const existing = readBotConfig();
  const merged = { ...existing, ...body };
  writeBotConfig(merged);
  return NextResponse.json({ success: true, config: merged });
}

export async function GET() {
  return NextResponse.json(readBotConfig());
}
