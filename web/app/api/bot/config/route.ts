import { NextResponse } from "next/server";
import { readBotConfig, writeBotConfig } from "@/lib/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  writeBotConfig(body);
  return NextResponse.json({ success: true, config: body });
}

export async function GET() {
  return NextResponse.json(readBotConfig());
}
