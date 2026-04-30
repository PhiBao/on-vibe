import { NextResponse } from "next/server";
import { writeBotConfig } from "@/lib/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const config = body.config || {};
  writeBotConfig({ ...config, enabled: true });
  return NextResponse.json({ success: true, config });
}
