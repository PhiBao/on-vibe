// AI Signal Engine — uses LLM to reason about market data and generate trade signals

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a quantitative trading analyst. Given market data and technical indicators, you produce a clear trading decision.

Output ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "action": "long" | "short" | "hold" | "close_long" | "close_short",
  "confidence": 0.0 to 1.0,
  "entryPrice": number or null,
  "stopLoss": number,
  "takeProfit": number,
  "leverage": 1 to 5,
  "reasoning": "one sentence explanation",
  "timeframe": "1h" | "4h" | "1d"
}

Rules:
- Only take trades with confidence > 0.6
- Risk/reward ratio must be at least 2:1
- Stop loss based on ATR (1.5-2x ATR from entry)
- Take profit at nearest resistance (long) or support (short)
- Consider trend, RSI, MACD, Bollinger Bands, volume, and S/R levels
- "hold" if no clear signal or conflicting indicators
- Never risk more than 5% of portfolio on a single trade`;

export async function analyzeWithAI(analysis, symbol, positionInfo = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠ No OPENAI_API_KEY — using rule-based fallback");
    return ruleBasedSignal(analysis);
  }

  const positionContext = positionInfo 
    ? `\nCurrent position: ${JSON.stringify(positionInfo)}`
    : "\nNo open position.";

  const prompt = `Analyze ${symbol} and decide:

Price: $${analysis.price}
Trend: ${analysis.trend}
RSI: ${analysis.rsi.value.toFixed(1)} (${analysis.rsi.signal})
MACD: value=${analysis.macd.value.toFixed(4)}, histogram=${analysis.macd.histogram.toFixed(4)}, cross=${analysis.macd.cross}
Bollinger: upper=$${analysis.bollinger.upper?.toFixed(2)}, mid=$${analysis.bollinger.middle?.toFixed(2)}, lower=$${analysis.bollinger.lower?.toFixed(2)}, position=${analysis.bollinger.position}
EMA: 9=${analysis.ema.ema9?.toFixed(2)}, 21=${analysis.ema.ema21?.toFixed(2)}, 50=${analysis.ema.ema50?.toFixed(2)}
ATR: ${analysis.atr?.toFixed(4)}
Volume: current=${analysis.volume.current?.toFixed(0)}, ratio=${analysis.volume.ratio?.toFixed(2)}x avg
Support: $${analysis.support?.toFixed(2) || "none"}
Resistance: $${analysis.resistance?.toFixed(2) || "none"}
${positionContext}

Respond with JSON only.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    const signal = JSON.parse(content);
    return validateSignal(signal, analysis);
  } catch (err) {
    console.error("AI analysis failed:", err.message);
    return ruleBasedSignal(analysis);
  }
}

// ─── Fallback: Rule-Based Signal ───────────────────────────

function ruleBasedSignal(analysis) {
  const { trend, rsi, macd, bollinger, volume, atr, price, support, resistance } = analysis;
  let action = "hold";
  let confidence = 0;
  let stopLoss, takeProfit;

  // Strong buy conditions
  if (trend === "bullish" && rsi.signal === "oversold" && macd.cross === "bullish_cross") {
    action = "long";
    confidence = 0.8;
  }
  // Moderate buy
  else if (trend === "bullish" && rsi.value < 45 && macd.histogram > 0) {
    action = "long";
    confidence = 0.65;
  }
  // Bollinger bounce from lower band
  else if (bollinger.position === "below_lower" && rsi.value < 35) {
    action = "long";
    confidence = 0.7;
  }
  // Strong sell conditions
  else if (trend === "bearish" && rsi.signal === "overbought" && macd.cross === "bearish_cross") {
    action = "short";
    confidence = 0.8;
  }
  // Moderate sell
  else if (trend === "bearish" && rsi.value > 55 && macd.histogram < 0) {
    action = "short";
    confidence = 0.65;
  }
  // Bollinger rejection from upper band
  else if (bollinger.position === "above_upper" && rsi.value > 65) {
    action = "short";
    confidence = 0.7;
  }

  if (action === "long") {
    stopLoss = price - (atr || price * 0.02) * 1.5;
    takeProfit = resistance || price * 1.04;
  } else if (action === "short") {
    stopLoss = price + (atr || price * 0.02) * 1.5;
    takeProfit = support || price * 0.96;
  }

  // Check R:R ratio
  if (action !== "hold") {
    const risk = Math.abs(price - stopLoss);
    const reward = Math.abs(takeProfit - price);
    if (reward / risk < 2) {
      action = "hold";
      confidence = 0;
    }
  }

  return {
    action,
    confidence,
    entryPrice: action !== "hold" ? price : null,
    stopLoss: stopLoss || null,
    takeProfit: takeProfit || null,
    leverage: confidence > 0.75 ? 3 : confidence > 0.65 ? 2 : 1,
    reasoning: action === "hold" ? "No clear signal" : `${trend} trend, RSI ${rsi.value.toFixed(0)}, ${macd.cross}`,
    timeframe: "1h",
    source: "rule_based",
  };
}

// ─── Validate Signal ───────────────────────────────────────

function validateSignal(signal, analysis) {
  // Clamp values
  signal.confidence = Math.max(0, Math.min(1, signal.confidence || 0));
  signal.leverage = Math.max(1, Math.min(5, signal.leverage || 1));
  signal.source = signal.source || "ai";

  // Ensure stop loss and take profit exist
  if (signal.action === "long" || signal.action === "short") {
    if (!signal.stopLoss || !signal.takeProfit) {
      const atr = analysis.atr || analysis.price * 0.02;
      if (signal.action === "long") {
        signal.stopLoss = signal.stopLoss || analysis.price - atr * 1.5;
        signal.takeProfit = signal.takeProfit || analysis.price + atr * 3;
      } else {
        signal.stopLoss = signal.stopLoss || analysis.price + atr * 1.5;
        signal.takeProfit = signal.takeProfit || analysis.price - atr * 3;
      }
    }

    // Verify R:R ratio
    const risk = Math.abs((signal.entryPrice || analysis.price) - signal.stopLoss);
    const reward = Math.abs(signal.takeProfit - (signal.entryPrice || analysis.price));
    if (risk > 0 && reward / risk < 1.5) {
      signal.action = "hold";
      signal.confidence = 0;
      signal.reasoning = "R:R ratio too low";
    }
  }

  return signal;
}
