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

## Aviator Mobile App (artifacts/gaming-platform)

Dedicated single-game Aviator/Crash mobile app (ASTRNVT-style). Red/dark premium casino theme, built with Expo React Native.

### Theme
- `#08020E` background, `#CC0022` primary red, `#FFD700` gold, `#00C853` green
- Font: Inter (400, 500, 600, 700)
- Haptic feedback on all game events

### Screens (3 tabs)
- **Fly (index)** — Main Aviator game: SVG rocket animation, real-time WebSocket multiplier, BET/CASHOUT buttons, history chips, live bets panel
- **Wallet** — Balance display, quick deposit packages (₹100/500/1000/5000), custom deposit, UPI withdrawal, transaction history
- **Profile** — Stats (wins/losses/wagered), XP bar, level, win rate ring, settings menu, logout

### Auth
- Login/Register on single screen (tab switcher)
- JWT stored in AsyncStorage, auto-restored on launch
- Auth gate: unauthenticated → login; authenticated → tabs

### Navigation
- Stack: `(auth)` + `(tabs)` — AuthGate redirects between them
- Removed old screens: game/crash, game/dice, game/coinflip, history, leaderboard

### State
- `AuthContext` (reducer) — user, token, balance, login/register/logout/refreshBalance
- `WSC` module-level WS singleton (lib/wsClient.ts) — connects to `/ws`, reconnects on close
- `wsSend()` for bet/cashout messages

### Key Files
- `context/AuthContext.tsx` — auth state, WS auth, balance updates
- `lib/wsClient.ts` — WebSocket singleton
- `lib/api.ts` — REST API client (auth + wallet endpoints)
- `constants/colors.ts` — red/dark theme palette
- `app/(tabs)/index.tsx` — main Aviator game screen with SVG canvas
- `app/(tabs)/wallet.tsx` — wallet with deposits/withdrawals
- `app/(tabs)/profile.tsx` — player profile and stats

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server. Routes at `/api`.
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Wallet: `GET /api/wallet/balance`, `GET /api/wallet/transactions`, `POST /api/wallet/deposit`, `POST /api/wallet/withdraw`
- WebSocket: `ws://localhost:8080/ws` — game engine broadcasts phase/mult/bots to all clients

### `lib/db` (`@workspace/db`)
Drizzle ORM + PostgreSQL. Run `pnpm --filter @workspace/db run push` for migrations.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI spec + Orval codegen. Run `pnpm --filter @workspace/api-spec run codegen`.

## NeonBet Web (`artifacts/neonbet-web`)

Premium 1win-style casino gaming site. React + Vite on port 19702 (base path `/neonbet-web/`).

### Architecture
- **Frontend**: React + Vite, dark neon theme (`#0a0a0f` bg, neon-blue/purple/green/gold/red)
- **Auth**: JWT (bcryptjs on server) — register/login/me via `/api/auth/*`
- **Real-time**: WebSocket singleton (`lib/wsClient.ts`) at `${BASE_URL}ws` — proxied through Vite to API server at port 8080
- **Database**: PostgreSQL via Drizzle ORM — tables: `users` (balance default ₹10,000), `game_rounds`, `bets`
- **State**: `GameContext.tsx` (React Context + reducer), `WSC` module-level WS singleton

### Key Files
- `src/context/GameContext.tsx` — app state, auth actions, WS balance sync
- `src/lib/wsClient.ts` — WebSocket singleton (connects to `${BASE_URL}ws`, reconnects on disconnect)
- `src/lib/api.ts` — REST API client (register, login, me)
- `src/lib/utils.ts` — `makeId()` + `cn()` utilities
- `src/pages/CrashGame.tsx` — Aviator/Crash game (canvas, WSC state, bet/cashout via WS)
- `vite.config.ts` — proxy `/api` + `${basePath}ws` → `localhost:8080`

### Games (8 total)
Crash/Aviator, Mines, Plinko, Tower, Hi-Lo, Slots, Dice, Coin Flip

### Multiplayer (Crash)
Server-side game engine (`api-server/src/lib/gameEngine.ts`) broadcasts round state to all clients. Bets/cashouts sent via WS messages. Balance updates flow from server → `WSC.msgListeners` → `GameContext`.

### Important Notes
- `makeId()` MUST live in `lib/utils.ts` (not `GameContext.tsx`) — avoids Fast Refresh breakage
- WS URL uses `import.meta.env.BASE_URL` prefix so Replit proxy routes correctly
- JWT_SECRET: `process.env.JWT_SECRET || 'neonbet-secret-2024'`
