import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, side, size, price, stopLoss, takeProfit, leverage, mode } = body;

  if (!symbol || !side || !size || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const order = {
    id: `${mode || "paper"}_${Date.now()}`,
    symbol,
    side, // "buy" or "sell"
    type: "market",
    size: parseFloat(size),
    price: parseFloat(price),
    stopLoss: stopLoss ? parseFloat(stopLoss) : null,
    takeProfit: takeProfit ? parseFloat(takeProfit) : null,
    leverage: leverage ? parseInt(leverage) : 1,
    timestamp: Date.now(),
    mode: mode || "paper",
    status: "filled",
  };

  // Append to trades.jsonl
  const dir = DATA_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "trades.jsonl"), JSON.stringify(order) + "\n");

  // Update risk state
  const stateFile = path.join(dir, "risk-state.json");
  let state: Record<string, unknown> = {};
  try {
    if (fs.existsSync(stateFile)) state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}

  const positions = (state.openPositions as Array<Record<string, unknown>>) || [];
  positions.push({
    id: order.id,
    symbol: order.symbol,
    side: side === "buy" ? "long" : "short",
    entryPrice: order.price,
    size: order.size,
    leverage: order.leverage,
    stopLoss: order.stopLoss,
    takeProfit: order.takeProfit,
    openedAt: Date.now(),
    source: "web_ui",
  });
  state.openPositions = positions;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  return NextResponse.json({ success: true, order });
}
