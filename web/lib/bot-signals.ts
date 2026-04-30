import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const SIGNAL_QUEUE_FILE = path.join(DATA_DIR, "signal-queue.jsonl");
const BOT_CONFIG_FILE = path.join(DATA_DIR, "bot-config.json");
const BOT_STATE_FILE = path.join(DATA_DIR, "bot-state.json");

export interface TradeSignal {
  id: string;
  cycle: number;
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  longVotes: number;
  shortVotes: number;
  details: Array<{ name: string; signal: string; confidence: string }>;
  queuedAt: number;
  status: "pending" | "executed" | "expired" | "rejected";
  executedAt?: number;
  txSignature?: string;
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readSignals(): TradeSignal[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return [];
    return fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8")
      .trim().split("\n")
      .filter(Boolean)
      .map(l => JSON.parse(l))
      .filter((s: TradeSignal) => s.status === "pending");
  } catch { return []; }
}

export function readAllSignals(): TradeSignal[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return [];
    return fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8")
      .trim().split("\n")
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch { return []; }
}

export function markSignalExecuted(signalId: string, txSignature?: string) {
  ensureDataDir();
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return;
    const lines = fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8").trim().split("\n").filter(Boolean);
    const updated = lines.map(l => {
      const s = JSON.parse(l);
      if (s.id === signalId) {
        s.status = "executed";
        s.executedAt = Date.now();
        if (txSignature) s.txSignature = txSignature;
      }
      return JSON.stringify(s);
    });
    fs.writeFileSync(SIGNAL_QUEUE_FILE, updated.join("\n") + "\n");
  } catch {}
}

export function rejectSignal(signalId: string) {
  ensureDataDir();
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return;
    const lines = fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8").trim().split("\n").filter(Boolean);
    const updated = lines.map(l => {
      const s = JSON.parse(l);
      if (s.id === signalId) { s.status = "rejected"; s.rejectedAt = Date.now(); }
      return JSON.stringify(s);
    });
    fs.writeFileSync(SIGNAL_QUEUE_FILE, updated.join("\n") + "\n");
  } catch {}
}

export function expireOldSignals(maxAgeMs = 300000) {
  ensureDataDir();
  try {
    if (!fs.existsSync(SIGNAL_QUEUE_FILE)) return;
    const now = Date.now();
    const lines = fs.readFileSync(SIGNAL_QUEUE_FILE, "utf8").trim().split("\n").filter(Boolean);
    const updated = lines.map(l => {
      const s = JSON.parse(l);
      if (s.status === "pending" && now - s.queuedAt > maxAgeMs) {
        s.status = "expired";
        s.expiredAt = now;
      }
      return JSON.stringify(s);
    });
    fs.writeFileSync(SIGNAL_QUEUE_FILE, updated.join("\n") + "\n");
  } catch {}
}

export function readBotConfig() {
  ensureDataDir();
  try {
    if (fs.existsSync(BOT_CONFIG_FILE)) return JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, "utf8"));
  } catch {}
  return {
    enabled: false,
    minConfidence: 0.55,
    maxPositionPct: 20,
    maxLeverage: 20,
    symbols: ["SOL", "ETH", "BTC"],
    interval: 60,
    portfolioValue: 0,
    walletAddress: "",
  };
}

export function writeBotConfig(config: Record<string, unknown>) {
  ensureDataDir();
  fs.writeFileSync(BOT_CONFIG_FILE, JSON.stringify(config, null, 2));
}
