import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const BOT_STATE_FILE = path.join(DATA_DIR, "bot-state.json");
const BOT_CONFIG_FILE = path.join(DATA_DIR, "bot-config.json");

function readBotState() {
  try {
    if (!fs.existsSync(BOT_STATE_FILE)) return { running: false, config: null, cycle: 0 };
    return JSON.parse(fs.readFileSync(BOT_STATE_FILE, "utf8"));
  } catch {
    return { running: false, config: null, cycle: 0 };
  }
}

function writeBotState(state: Record<string, unknown>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2));
}

export async function GET() {
  return NextResponse.json(readBotState());
}

export async function POST(request: Request) {
  const body = await request.json();
  const config = body.config || {};

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOT_CONFIG_FILE, JSON.stringify({ ...config, enabled: true }, null, 2));

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
