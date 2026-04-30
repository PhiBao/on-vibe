<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Phoenix Terminal v3 — Agent Guide

## Project Overview

Cyberpunk trading terminal for Phoenix perpetuals on Solana. **Web-only product** — no CLI bot. The entire trading experience happens in the browser. Stack: Next.js 16 + React 19 + Tailwind v4 + TypeScript + Solana Wallet Adapter + Phoenix Rise SDK.

## Architecture

```
web/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard (wallet + markets + signals)
│   ├── trade/page.tsx            # Manual trade execution
│   ├── positions/page.tsx        # Position monitor
│   ├── bots/page.tsx             # Bot control + pending signals + auto-execute
│   ├── journal/page.tsx          # Performance analytics
│   ├── backtest/page.tsx         # Backtest UI
│   ├── api/                      # API routes (route.ts)
│   │   ├── bot/
│   │   │   ├── toggle/route.ts   # Start/stop bot (writes state file)
│   │   │   ├── cycle/route.ts    # Runs one analysis cycle
│   │   │   ├── signals/route.ts  # Reads pending signals from queue
│   │   │   ├── execute/route.ts  # Builds Phoenix order packet
│   │   │   ├── config/route.ts   # Saves bot config
│   │   │   └── logs/route.ts     # Reads bot log file
│   │   ├── market/route.ts
│   │   ├── trade/route.ts
│   │   ├── wallet/balance/route.ts
│   │   └── backtest/route.ts
│   ├── globals.css               # Cyberpunk design system
│   ├── layout.tsx                # Terminal layout (suppressHydrationWarning)
│   └── providers.tsx             # Wallet context provider
├── components/
│   ├── TerminalLayout.tsx        # Sidebar + CRT effects + nav
│   └── WalletProvider.tsx        # Solana wallet adapters
├── lib/
│   ├── security.ts               # Security auditor module
│   ├── bot-signals.ts            # Signal queue file I/O
│   └── engine/                   # Trading engine (JS modules)
│       ├── market.js             # Phoenix Rise SDK wrapper
│       ├── indicators.js         # Technical indicators
│       ├── signals.js            # 5 strategies + synthesizer
│       ├── funding.js            # Funding rate analysis
│       ├── risk.js               # Risk management
│       ├── position.js           # Position management
│       └── backtest.js           # Backtest engine
```

## Bot Execution Flow

```
User clicks [START BOT]
  → POST /api/bot/toggle (writes bot-state.json: running=true)
Browser starts interval timer
  → POST /api/bot/cycle every N seconds
Server runs analysis (imports engine modules)
  → Fetches candles, runs 5 strategies, synthesizes
  → If signal is strong, writes to signal-queue.jsonl
Browser polls /api/bot/signals
  → Displays pending signals in UI
User clicks [EXECUTE] (or auto-execute if enabled)
  → POST /api/bot/execute builds Phoenix order packet
  → Browser signs transaction with wallet adapter
  → Transaction submitted on-chain
```

## Design System (Cyberpunk Terminal)

### Colors
- `--cyan: #00f0ff` — Primary accent
- `--green: #00ff41` — Success / long
- `--red: #ff0040` — Error / short
- `--magenta: #ff00ff` — Secondary accent
- `--yellow: #f0e800` — Warning
- `--bg: #050505` — Background
- `--terminal-bg: #08080c` — Card background

### Typography
- Font: `JetBrains Mono` or `Courier New` fallback
- Use `font-mono` class everywhere
- Uppercase labels with `tracking-wider` or `tracking-[0.15em]`

### Components
- `.terminal-card` — Main container with top glow line
- `.terminal-header` — Section header with `>` prefix
- `.terminal-border` — Border with corner accents
- `.btn-terminal` — Ghost button with hover glow
- `.terminal-input` — Dark input with cyan focus
- `.terminal-table` — Data table with minimal borders

### Effects
- `.crt-overlay` — Fixed CRT scanline overlay (z-9999)
- `.scanline` — Animated scanning line (z-9998)
- `.terminal-flicker` — Subtle screen flicker animation
- `.grid-bg` — 40px grid background

### Hydration Safety
- Always add `suppressHydrationWarning` to `<html>` and `<body>` in `layout.tsx`
- Browser extensions inject attributes that cause hydration mismatches

## API Route Conventions

### Bot Routes
- `POST /api/bot/toggle` — Flips `running` flag in `bot-state.json`, saves config
- `POST /api/bot/cycle` — Imports engine modules, runs one analysis cycle, writes signals
- `GET /api/bot/signals` — Reads `signal-queue.jsonl`, filters pending, expires old (>5min)
- `POST /api/bot/execute` — Builds Phoenix order packet, marks signal executed
- `GET /api/bot/logs` — Reads last 200 lines from `bot-log.jsonl`

### Data Directory
- Runtime data stored in `../data/` (relative to `web/`)
- Files: `trades.jsonl`, `risk-state.json`, `bot-state.json`, `bot-log.jsonl`, `signal-queue.jsonl`, `bot-config.json`

### Security Requirements
- ALL user inputs must pass `defaultAuditor.auditOrder()`
- Rate limiting on all mutation endpoints
- Circuit breaker for daily volume
- Duplicate detection

## Wallet Integration

### Solana Wallet Adapter
- Configured in `components/WalletProvider.tsx`
- Supports: Phantom, Solflare, Coinbase, Bitget, Trust, WalletConnect
- Use `useWallet()` hook in client components

### Phoenix Rise SDK
- Client creation: `createPhoenixClient({ apiUrl, rpcUrl })`
- Always `await client.exchange.ready()` before API calls
- Order packets: `client.orderPackets.buildMarketOrderPacket({ symbol, side, baseUnits })`
- Trader state: `client.api.traders().getTraderStateSnapshot(address)`

## State Management

- No global state library — React hooks + API polling
- Bot state: `data/bot-state.json` (running, cycle, config)
- Signal queue: `data/signal-queue.jsonl` (append-only, status updates rewrite file)
- Trade history: `data/trades.jsonl`
- Polling intervals: dashboard 30s, signals/logs 3s, wallet 15s, bot cycles: user-configured

## Coding Conventions

1. **All text in monospace** — Use `font-mono` for consistency
2. **Color tokens only** — Never hardcode colors, use CSS variables
3. **Uppercase labels** — Section headers, button labels in uppercase
4. **Bracket buttons** — Action buttons use `[ LABEL ]` format
5. **Terminal prefixes** — Use `>` for prompts, `▲▼` for direction
6. **Animate-in** — Use `.animate-in` class for page transitions
7. **Error handling** — Always catch API errors, show terminal-style error messages
8. **No CLI** — Everything is web-only. No spawned processes, no env private keys.

## Key Files

| File | Purpose |
|------|---------|
| `web/app/globals.css` | Cyberpunk design system |
| `web/components/TerminalLayout.tsx` | App shell with CRT effects |
| `web/lib/security.ts` | Security audit module |
| `web/lib/bot-signals.ts` | Signal queue I/O |
| `web/lib/engine/signals.js` | 5-strategy swarm engine |
| `web/lib/engine/risk.js` | Risk management |
| `web/app/api/bot/cycle/route.ts` | Bot analysis cycle |
| `web/app/api/bot/execute/route.ts` | Signal → order packet |
