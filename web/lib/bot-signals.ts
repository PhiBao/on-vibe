// Re-export from data-store for backward compatibility
export {
  readPendingSignals as readSignals,
  readAllSignals,
  markSignalExecuted,
  rejectSignal,
  expireOldSignals,
  readBotConfig,
  writeBotConfig,
} from "@/lib/data-store";

export type { TradeSignal } from "@/lib/data-store";
