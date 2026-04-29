# 🔥 Phoenix Bot

Multi-strategy AI trading bot + web dashboard for Phoenix perpetuals on Solana. Combines 5 parallel trading strategies, funding rate analysis, liquidation detection, trailing stops, and partial profit taking.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     WEB DASHBOARD                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Dashboard │ │  Trade   │ │Positions │ │ Journal  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│         ↕ API Routes          ↕ Solana Wallet               │
│  ┌──────────────────────────────────────────────────┐       │
│  │           Next.js 16 (App Router)                 │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    TRADING ENGINE                            │
│  ┌───────────────────────────────────────────────────┐      │
│  │              SWARM STRATEGIES (5)                  │      │
│  │  TrendFollow · MeanReversion · Momentum · SR · Vol│      │
│  └────────────────────┬──────────────────────────────┘      │
│                       ↓                                      │
│  ┌────────────┐ ┌───────────┐ ┌────────────────────┐        │
│  │  Funding   │ │Synthesizer│ │ Liquidation Detect  │        │
│  │  Analysis  │ → (weighted) ← │ (stop-hunt zones)  │        │
│  └────────────┘ └─────┬─────┘ └────────────────────┘        │
│                       ↓                                      │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐       │
│  │   Risk   │→ │ Execution  │→ │ Position Manager   │       │
│  │ Manager  │  │(Paper/Live)│  │(Trailing+Partial)  │       │
│  └──────────┘  └────────────┘  └────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           ↕
              Phoenix Perps API (Solana)
```

## Features

### Trading Engine
- **5 parallel strategies**: Trend Following, Mean Reversion, Momentum, S/R Bounce, Volume Breakout
- **Weighted synthesizer**: Combines signals by confidence, agreement bonus when 3+ strategies align
- **Funding rate analysis**: Detects crowded long/short, carry trade opportunities
- **Liquidation detection**: Identifies stop-hunt zones and cascade risk
- **Trailing stop**: Tightens as price moves in your favor
- **Partial profit taking**: Exits 50% at target, trails the rest
- **Break-even trigger**: Moves SL to entry after 1% profit
- **Max hold time**: 48h prevents bag-holding

### Risk Management
- Position sizing: Max 5% of portfolio per trade
- Daily loss limit: 10% circuit breaker
- Max drawdown: 20% full stop
- Cooldown: 30min after loss
- R:R ratio: Minimum 2:1 to enter

### Web Dashboard
- **Dashboard**: Portfolio stats, live market prices, strategy status
- **Trade**: Full trading UI with orderbook, candle data, SL/TP
- **Positions**: Open positions with real-time P&L
- **Journal**: Performance analytics, win rate, profit factor
- **Backtest**: Test strategies on historical data

### Wallet Support (Solana)
- **Phantom** — most popular Solana wallet
- **Solflare** — feature-rich Solana wallet
- **OKX Wallet** — via WalletConnect
- **Coinbase Wallet** — via WalletConnect
- **Bitget Wallet** — multi-chain
- **Trust Wallet** — multi-chain
- **WalletConnect** — 300+ wallets via QR code (mobile + desktop)

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### 1. Clone & Install

```bash
git clone https://github.com/PhiBao/phoenix-bot.git
cd phoenix-bot

# Install bot dependencies
npm install

# Install web dashboard dependencies
cd web && npm install --legacy-peer-deps && cd ..
```

### 2. Configure

```bash
cp .env.example .env
cp web/.env.example web/.env.local  # if exists
```

Edit `.env`:
- `OPENAI_API_KEY` — optional, for AI analysis (falls back to rule-based)
- `TRADING_MODE` — `paper` (default) or `live`
- `SYMBOLS` — markets to scan (default: SOL,ETH,BTC)

### 3. Run

**Bot only (CLI):**
```bash
npm start          # Paper trading
npm run analyze    # Market analysis
npm run backtest SOL 2  # Backtest SOL with 2x leverage
npm run journal    # View trade history
```

**Web dashboard:**
```bash
cd web
npm run dev        # → http://localhost:3001
```

**Both together:**
```bash
# Terminal 1: Bot
npm start

# Terminal 2: Dashboard
cd web && npm run dev
```

## Strategies

| # | Strategy | Signal | Best In |
|---|----------|--------|---------|
| 1 | **Trend Following** | EMA(9/21/50) crossover + RSI filter | Trending |
| 2 | **Mean Reversion** | Bollinger Bands + RSI extremes | Range-bound |
| 3 | **Momentum** | MACD histogram + volume | Breakouts |
| 4 | **S/R Bounce** | Support/Resistance + RSI | Reversals |
| 5 | **Volume Breakout** | Volume spike + price direction | High volatility |

### Signal Range
Each strategy outputs a signal in `[-1.0, 1.0]`:
- `1.0` = full long
- `-1.0` = full short
- `0.0` = flat/hold

### Synthesizer
Weighted average by confidence. Agreement bonus: +15% confidence when 3+ strategies agree on direction.

## Configuration

### Bot (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `TRADING_MODE` | `paper` | `paper` or `live` |
| `SYMBOLS` | `SOL,ETH,BTC` | Markets to scan |
| `SCAN_INTERVAL` | `60` | Seconds between cycles |
| `MIN_CONFIDENCE` | `0.55` | Minimum confidence to trade |
| `MAX_POSITION_PCT` | `5` | Max % of portfolio per position |
| `MAX_LEVERAGE` | `3` | Maximum leverage |
| `MAX_DAILY_LOSS_PCT` | `10` | Daily loss circuit breaker |
| `TRAILING_STOP_PCT` | `1.5` | Trailing stop distance % |
| `PARTIAL_PROFIT_PCT` | `2.0` | Take partial at X% profit |
| `BREAK_EVEN_TRIGGER` | `1.0` | Move SL to entry at X% |
| `MAX_HOLD_BARS` | `48` | Max hold time (48h) |
| `OPENAI_API_KEY` | — | For AI analysis (optional) |

### Web Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |

## Project Structure

```
phoenix-bot/
├── src/
│   ├── bot.js                    # Main trading loop
│   ├── analyze.js                # Standalone market analysis
│   ├── journal.js                # Trade journal CLI
│   ├── backtest.js               # Backtest runner
│   ├── market/
│   │   └── phoenix.js            # Rise SDK wrapper
│   ├── analysis/
│   │   ├── indicators.js         # RSI, MACD, BB, EMA, ATR, S/R
│   │   ├── signals.js            # 5 strategies + synthesizer
│   │   └── funding.js            # Funding rate + liquidation
│   ├── risk/
│   │   ├── manager.js            # Risk management
│   │   └── position-manager.js   # Trailing stop + partial profit
│   ├── execution/
│   │   └── executor.js           # Paper + live execution
│   └── backtest/
│       └── engine.js             # Backtest engine
├── web/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── trade/page.tsx        # Trading UI
│   │   ├── positions/page.tsx    # Open positions
│   │   ├── journal/page.tsx      # Performance analytics
│   │   ├── backtest/page.tsx     # Backtest UI
│   │   └── api/
│   │       ├── market/route.ts   # Market data API
│   │       ├── status/route.ts   # Portfolio status API
│   │       └── trade/route.ts    # Trade execution API
│   ├── components/
│   │   ├── WalletProvider.tsx    # Solana wallet context
│   │   ├── ConnectButton.tsx     # Wallet connect button
│   │   └── Sidebar.tsx           # Navigation
│   └── lib/
│       └── web3.ts               # (removed — using Solana adapters)
├── data/                          # Runtime data (gitignored)
├── .env.example
├── .gitignore
└── README.md
```

## Going Live

1. Set `TRADING_MODE=live` in `.env`
2. Add `SOLANA_PRIVATE_KEY` (base58 format)
3. Ensure wallet has USDC collateral on Phoenix
4. Start with `MAX_POSITION_PCT=2` and `MAX_LEVERAGE=2`
5. Monitor the dashboard closely for the first few cycles

## Technologies

- **Trading**: Rise SDK (`@ellipsis-labs/rise`) for Phoenix perpetuals
- **Web**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare, WalletConnect, etc.)
- **Data**: Phoenix Perps API, Solana RPC
- **Analysis**: Custom indicators (RSI, MACD, Bollinger, EMA, ATR, S/R)

## Disclaimer

This is experimental software for educational purposes. Trading crypto perpetuals involves substantial risk of loss. Use at your own risk. Always paper trade first. Never trade with funds you can't afford to lose.

## License

MIT
