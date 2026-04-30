import { NextResponse } from "next/server";
import { readBotState, readBotConfig } from "@/lib/data-store";

export async function GET() {
  const state = readBotState();
  const config = readBotConfig() || state.config;
  return NextResponse.json({ ...state, config });
}
