# Phoenix Terminal v3 — Agent Guide

## Project Overview

Cyberpunk trading terminal for Phoenix perpetuals on Solana.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind v4, TypeScript
- **Web3**: Solana Wallet Adapter, Phoenix Rise SDK (`@ellipsis-labs/rise`)
- **Security**: Custom auditor based on nemesis-auditor + pashov patterns

## Directory Structure

```
/
├── web/                    # Next.js terminal
│   ├── app/                # Pages + API routes
│   ├── components/         # TerminalLayout, WalletProvider
│   └── lib/                # Security, engine, tx helpers
└── data/                   # Runtime state (gitignored)
```

## Quick Commands

```bash
cd web && npm run dev     # localhost:3000
```

## Design System

See `web/AGENTS.md` for detailed cyberpunk terminal design system, component conventions, coding rules, and architecture.

## Security Checklist

- [x] All inputs validated via `SecurityAuditor`
- [x] Rate limiting on all mutation endpoints
- [x] Circuit breaker for daily volume
- [x] Duplicate order detection
- [x] Solana address format validation
- [x] Price anomaly detection
