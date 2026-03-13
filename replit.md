# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── gaming-platform/    # Expo React Native mobile gaming platform
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Gaming Platform (artifacts/gaming-platform)

Premium online gaming platform with dark casino-style UI built with Expo React Native.

### Features
- **Game Lobby**: Home screen with 3 animated game cards, live player count, balance display
- **Crash Game**: Real-time multiplier graph, cash-out mechanic, multiplayer view
- **Dice Roll**: Predict high/low (1-3 vs 4-6), instant results, animated dice
- **Coin Flip**: Heads or tails, animated coin, 1.98x payout
- **Leaderboard**: Podium view, animated rankings, 10 mock players
- **Game History**: Full game log with P&L, stats summary bar
- **Profile**: XP bar, win rate ring, stats grid, settings menu
- **Auth**: Login/Register with smooth tab switcher

### Design
- Dark theme: `#0A0A0F` background, neon accents (blue, purple, gold, green, red)
- Font: Inter (400, 500, 600, 700)
- Custom app icon and splash screen (AI-generated diamond gem)
- Smooth spring animations, haptic feedback
- Liquid glass tab bar on iOS 26+, BlurView fallback

### Navigation
- 4 tabs: Lobby, Ranks, History, Profile
- Stack screens: auth, game/crash, game/dice, game/coinflip

### State
- React Context + AsyncStorage for persistence
- User balance, game history, leaderboard data
- Points-based wallet system

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server. Routes at `/api`.

### `lib/db` (`@workspace/db`)
Drizzle ORM + PostgreSQL. Run `pnpm --filter @workspace/db run push` for migrations.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI spec + Orval codegen. Run `pnpm --filter @workspace/api-spec run codegen`.
