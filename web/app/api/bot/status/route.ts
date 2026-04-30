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

function readBotConfig() {
  try {
    if (!fs.existsSync(BOT_CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

export async function GET() {
  const state = readBotState();
  const config = readBotConfig() || state.config;
  return NextResponse.json({ ...state, config });
}
