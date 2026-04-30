import { NextResponse } from "next/server";
import { readBotState, writeBotState, readBotConfig, writeBotConfig } from "@/lib/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const config = body.config || {};

  writeBotConfig({ ...config, enabled: true });

  const state = readBotState();

  if (state.running) {
    // Stop
    writeBotState({ ...state, running: false, stoppedAt: Date.now() });
    return NextResponse.json({ running: false, config, action: "stopped" });
  } else {
    // Start
    writeBotState({ ...state, running: true, config, startedAt: Date.now() });
    return NextResponse.json({ running: true, config, action: "started" });
  }
}
