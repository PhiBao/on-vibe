import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const BOT_LOG_FILE = path.join(DATA_DIR, "bot-log.jsonl");

export async function GET() {
  try {
    if (!fs.existsSync(BOT_LOG_FILE)) return NextResponse.json({ logs: [] });
    const lines = fs.readFileSync(BOT_LOG_FILE, "utf8").trim().split("\n").filter(Boolean).slice(-200);
    return NextResponse.json({ logs: lines.map((l) => { try { return JSON.parse(l).line; } catch { return l; } }) });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}
