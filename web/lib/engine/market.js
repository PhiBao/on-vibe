import { createPhoenixClient, Side, Direction } from "@ellipsis-labs/rise";

let client = null;

export async function initPhoenix() {
  if (client) return client;
  
  client = createPhoenixClient({
    apiUrl: "https://perp-api.phoenix.trade",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    exchangeMetadata: { stream: false },
  });

  // Wait for exchange metadata to load
  await client.exchange.ready();
  console.log("✓ Phoenix client initialized");
  return client;
}

export function getClient() {
  if (!client) throw new Error("Phoenix not initialized. Call initPhoenix() first.");
  return client;
}

// ─── Market Data ───────────────────────────────────────────

export async function getMarkets() {
  const c = getClient();
  return c.api.markets().getMarkets();
}

export async function getMarket(symbol) {
  const c = getClient();
  return c.api.markets().getMarket(symbol);
}

export async function getCandles(symbol, interval = "1h", limit = 100) {
  const c = getClient();
  const raw = await c.api.candles().getCandles(symbol, { timeframe: interval });
  // Normalize: Phoenix returns array of candle objects
  return (raw || []).slice(-limit).map(candle => ({
    timestamp: candle.time || candle.timestamp || candle.t,
    open: parseFloat(candle.open || candle.o),
    high: parseFloat(candle.high || candle.h),
    low: parseFloat(candle.low || candle.l),
    close: parseFloat(candle.close || candle.c),
    volume: parseFloat(candle.volume || candle.v || 0),
  }));
}

export async function getOrderbook(symbol) {
  const c = getClient();
  return c.api.orderbook().getOrderbook(symbol);
}

export async function getFills(symbol) {
  const c = getClient();
  return c.api.trades().getMarketFills(symbol);
}

export async function getFundingRate(symbol) {
  const c = getClient();
  const history = await c.api.funding().getFundingRateHistory(symbol);
  return history?.[0] || null;
}

export async function getTraderState(authority) {
  const c = getClient();
  return c.api.traders().getTraderStateSnapshot(authority);
}

export async function getExchangeInfo() {
  const c = getClient();
  return c.api.exchange().getExchange();
}

// ─── Market Limits ─────────────────────────────────────────

let marketCache = null;
let marketCacheTime = 0;

export async function getMarketMaxLeverage(symbol) {
  const now = Date.now();
  if (!marketCache || now - marketCacheTime > 60000) {
    const c = getClient();
    marketCache = await c.api.markets().getMarkets();
    marketCacheTime = now;
  }
  const market = (marketCache || []).find((m) => m.symbol === symbol);
  if (!market || !market.leverageTiers || market.leverageTiers.length === 0) return 10;
  return market.leverageTiers[0].maxLeverage || 10;
}

export async function getAllMarketLimits() {
  const now = Date.now();
  if (!marketCache || now - marketCacheTime > 60000) {
    const c = getClient();
    marketCache = await c.api.markets().getMarkets();
    marketCacheTime = now;
  }
  const limits = {};
  for (const m of marketCache || []) {
    if (m.symbol && m.leverageTiers && m.leverageTiers.length > 0) {
      limits[m.symbol] = {
        maxLeverage: m.leverageTiers[0].maxLeverage || 10,
        tickSize: m.tickSize,
        takerFee: m.takerFee,
        makerFee: m.makerFee,
        isolatedOnly: m.isolatedOnly || false,
      };
    }
  }
  return limits;
}

// ─── Price Helpers ─────────────────────────────────────────

export async function getCurrentPrice(symbol) {
  const c = getClient();
  const book = await c.api.orderbook().getOrderbook(symbol);
  if (book?.mid) return parseFloat(book.mid);
  if (book?.bids?.[0] && book?.asks?.[0]) {
    return (parseFloat(book.bids[0][0]) + parseFloat(book.asks[0][0])) / 2;
  }
  return null;
}

export async function getMidPrice(symbol) {
  const book = await getOrderbook(symbol);
  if (!book?.bids?.[0] || !book?.asks?.[0]) return null;
  const bestBid = parseFloat(book.bids[0].price);
  const bestAsk = parseFloat(book.asks[0].price);
  return (bestBid + bestAsk) / 2;
}

// ─── Order Building ────────────────────────────────────────

export async function buildLimitOrder(symbol, side, priceUsd, baseUnits) {
  const c = getClient();
  return c.orderPackets.buildLimitOrderPacket({
    symbol,
    side: side === "buy" ? Side.Bid : Side.Ask,
    priceUsd: String(priceUsd),
    baseUnits: String(baseUnits),
  });
}

export async function buildMarketOrder(symbol, side, baseUnits) {
  const c = getClient();
  return c.orderPackets.buildMarketOrderPacket({
    symbol,
    side: side === "buy" ? Side.Bid : Side.Ask,
    baseUnits: String(baseUnits),
  });
}

export async function buildStopLoss(symbol, side, triggerPrice) {
  const c = getClient();
  return c.ixs.buildPlaceStopLoss({
    symbol,
    tradeSide: side === "buy" ? Side.Bid : Side.Ask,
    executionDirection: side === "buy" ? Direction.LessThan : Direction.GreaterThan,
    triggerPrice: BigInt(Math.round(triggerPrice * 1e6)),
  });
}

export { Side, Direction };
