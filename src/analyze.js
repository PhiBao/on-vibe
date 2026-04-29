// Standalone market analysis — run once to see current market state

import "dotenv/config";
import { initPhoenix, getCandles, getCurrentPrice, getFundingRate, getOrderbook } from "./market/phoenix.js";
import { analyze, RSI, MACD, BollingerBands, EMA, SupportResistance } from "./analysis/indicators.js";

const SYMBOLS = (process.env.SYMBOLS || "SOL,ETH,BTC").split(",").map(s => s.trim());

async function main() {
  console.log("\n📊 Market Analysis\n");

  try {
    await initPhoenix();
  } catch (err) {
    console.error("Failed to init Phoenix:", err.message);
    process.exit(1);
  }

  for (const symbol of SYMBOLS) {
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  ${symbol}`);
    console.log(`${"═".repeat(50)}`);

    try {
      const price = await getCurrentPrice(symbol);
      console.log(`  Price: $${price?.toFixed(2) || "N/A"}`);

      const candles = await getCandles(symbol, "1h", 100);
      if (!candles || candles.length < 50) {
        console.log(`  ⚠ Not enough data (${candles?.length || 0} candles)`);
        continue;
      }

      const ta = analyze(candles);
      if (!ta) { console.log("  Analysis failed"); continue; }

      console.log(`\n  Trend:     ${ta.trend === "bullish" ? "🟢 Bullish" : ta.trend === "bearish" ? "🔴 Bearish" : "⚪ Neutral"}`);
      console.log(`  RSI:       ${ta.rsi.value.toFixed(1)} (${ta.rsi.signal})`);
      console.log(`  MACD:      ${ta.macd.cross} | hist: ${ta.macd.histogram.toFixed(4)}`);
      console.log(`  Bollinger: ${ta.bollinger.position}`);
      console.log(`  EMA:       9=${ta.ema.ema9?.toFixed(2)} 21=${ta.ema.ema21?.toFixed(2)} 50=${ta.ema.ema50?.toFixed(2)}`);
      console.log(`  ATR:       ${ta.atr?.toFixed(4)}`);
      console.log(`  Volume:    ${ta.volume.ratio?.toFixed(2)}x average`);
      console.log(`  Support:   $${ta.support?.toFixed(2) || "none"}`);
      console.log(`  Resistance: $${ta.resistance?.toFixed(2) || "none"}`);

      // Funding rate
      try {
        const funding = await getFundingRate(symbol);
        if (funding) console.log(`  Funding:   ${funding.rate || "N/A"}`);
      } catch {}

      // Signal summary
      const closes = candles.map(c => c.close);
      const rsi = ta.rsi.value;
      const macd = ta.macd;
      
      let signal = "HOLD";
      let confidence = 0;
      
      if (ta.trend === "bullish" && rsi < 40 && macd.histogram > 0) {
        signal = "LONG"; confidence = 0.7;
      } else if (ta.trend === "bearish" && rsi > 60 && macd.histogram < 0) {
        signal = "SHORT"; confidence = 0.7;
      } else if (rsi < 30 && ta.bollinger.position === "below_lower") {
        signal = "LONG"; confidence = 0.75;
      } else if (rsi > 70 && ta.bollinger.position === "above_upper") {
        signal = "SHORT"; confidence = 0.75;
      }
      
      console.log(`\n  📌 Signal: ${signal} (${(confidence * 100).toFixed(0)}%)`);
      if (signal !== "HOLD") {
        const atr = ta.atr || price * 0.02;
        const sl = signal === "LONG" ? price - atr * 1.5 : price + atr * 1.5;
        const tp = signal === "LONG" ? ta.resistance || price * 1.04 : ta.support || price * 0.96;
        console.log(`  Entry:     $${price?.toFixed(2)}`);
        console.log(`  Stop Loss: $${sl.toFixed(2)}`);
        console.log(`  Take Profit: $${tp.toFixed(2)}`);
      }

    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  console.log("\n");
}

main().catch(console.error);
