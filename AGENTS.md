# Phoenix Terminal v3 — Agent Guide

## Project Overview

Cyberpunk trading terminal for Phoenix perpetuals on Solana. Multi-strategy swarm bot with web dashboard.

## Stack
- **Backend**: Node.js 20+, ES modules, pure math indicators
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind v4, TypeScript
- **Web3**: Solana Wallet Adapter, Phoenix Rise SDK (`@ellipsis-labs/rise`)
- **Security**: Custom auditor based on nemesis-auditor + pashov patterns

## Directory Structure

```
/
├── src/                    # Trading engine (Node.js)
│   ├── bot.js              # Main loop
│   ├── analysis/           # Indicators + signals
│   ├── risk/               # Risk + position manager
│   ├── execution/          # Paper/live executor
│   └── backtest/           # Backtest engine
├── web/                    # Next.js terminal
│   ├── app/                # Pages + API routes
│   ├── components/         # TerminalLayout, WalletProvider
│   └── lib/                # Security module
└── data/                   # Runtime state (gitignored)
```

## Quick Commands

```bash
# Bot CLI
npm start                 # Paper trading
npm run backtest SOL 2    # Backtest

# Web terminal
cd web && npm run dev     # localhost:3000
```

## Design System

See `web/AGENTS.md` for detailed cyberpunk terminal design system, component conventions, and coding rules.

## Security Checklist

- [ ] All inputs validated via `SecurityAuditor`
- [ ] Rate limiting on all mutation endpoints
- [ ] Circuit breaker for daily volume
- [ ] Duplicate order detection
- [ ] Solana address format validation
- [ ] Price anomaly detection
