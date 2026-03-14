import { WebSocketServer, WebSocket } from 'ws';
import { db } from '@workspace/db';
import { usersTable, gameRoundsTable, betsTable } from '@workspace/db/schema';
import { eq, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'neonbet-secret-2024';

type Phase = 'waiting' | 'flying' | 'crashed';

interface ClientState {
  ws: WebSocket;
  userId: number | null;
  username: string | null;
  betId: number | null;
  betAmount: number;
  autoCashout: number;
  hasBet: boolean;
  cashedOut: boolean;
}

interface BotBet {
  user: string;
  amount: number;
  status: string;
  cashout: number | null;
}

function genCrash(): number {
  const r = Math.random();
  if (r < 0.28) return parseFloat((1.0 + Math.random() * 0.05).toFixed(2));
  if (r < 0.50) return parseFloat((1.1 + Math.random() * 0.6).toFixed(2));
  if (r < 0.70) return parseFloat((1.8 + Math.random() * 1.5).toFixed(2));
  if (r < 0.85) return parseFloat((3.5 + Math.random() * 6).toFixed(2));
  if (r < 0.94) return parseFloat((10 + Math.random() * 20).toFixed(2));
  if (r < 0.99) return parseFloat((30 + Math.random() * 70).toFixed(2));
  return parseFloat((100 + Math.random() * 900).toFixed(2));
}

function calcMult(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsedSec) * 100) / 100;
}

const BOT_NAMES = ['CryptoKing', 'NeonBlade', 'StarDust', 'VortexX', 'NightOwl', 'BlazeRun', 'GhostRider', 'PixelHunter'];
function genBots(): BotBet[] {
  return Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
    user: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    amount: 100 + Math.floor(Math.random() * 1900),
    status: 'active', cashout: null,
  }));
}

const ENG = {
  phase: 'waiting' as Phase,
  mult: 1.0,
  countdown: 5,
  crashPoint: 0,
  roundId: 0,
  startTime: 0,
  crashTime: 0,
  bots: genBots(),
  history: [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01],
  timer: null as ReturnType<typeof setInterval> | null,
  cdTimer: null as ReturnType<typeof setInterval> | null,
};

const clients = new Map<WebSocket, ClientState>();

function statePayload() {
  return {
    type: 'state',
    phase: ENG.phase,
    mult: ENG.mult,
    countdown: ENG.countdown,
    roundId: ENG.roundId,
    startTime: ENG.startTime,
    history: ENG.history,
    bots: ENG.bots,
  };
}

function broadcast(data: object) {
  const json = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

async function startCountdown() {
  ENG.phase = 'waiting';
  ENG.mult = 1.0;
  ENG.countdown = 5;
  ENG.crashPoint = genCrash();
  ENG.bots = genBots();

  for (const [, c] of clients) {
    c.hasBet = false; c.cashedOut = false; c.betId = null; c.betAmount = 0;
  }

  try {
    const rows = await db.insert(gameRoundsTable).values({
      crashPoint: String(ENG.crashPoint), status: 'waiting',
    }).returning({ id: gameRoundsTable.id });
    ENG.roundId = rows[0]?.id ?? 0;
  } catch (e) {
    console.error('DB round insert:', e);
    ENG.roundId = Date.now();
  }

  broadcast(statePayload());

  if (ENG.cdTimer) clearInterval(ENG.cdTimer);
  ENG.cdTimer = setInterval(() => {
    ENG.countdown = Math.max(0, ENG.countdown - 1);
    broadcast(statePayload());
    if (ENG.countdown <= 0) {
      clearInterval(ENG.cdTimer!); ENG.cdTimer = null;
      startFlight();
    }
  }, 1000);
}

async function startFlight() {
  ENG.phase = 'flying';
  ENG.startTime = Date.now();
  ENG.mult = 1.0;

  try {
    await db.update(gameRoundsTable)
      .set({ status: 'flying', startedAt: new Date() })
      .where(eq(gameRoundsTable.id, ENG.roundId));
  } catch (e) { console.error('DB start flight:', e); }

  broadcast(statePayload());

  if (ENG.timer) clearInterval(ENG.timer);
  ENG.timer = setInterval(async () => {
    const el = (Date.now() - ENG.startTime) / 1000;
    ENG.mult = calcMult(el);

    ENG.bots = ENG.bots.map(b => {
      if (b.status === 'active' && Math.random() < 0.004 && ENG.mult > 1.3)
        return { ...b, status: 'cashed', cashout: ENG.mult };
      return b;
    });

    for (const [ws, c] of clients) {
      if (c.hasBet && !c.cashedOut && c.autoCashout > 1.05 && ENG.mult >= c.autoCashout) {
        await processCashout(ws, c, ENG.mult);
      }
    }

    broadcast(statePayload());
    if (ENG.mult >= ENG.crashPoint) await doCrash();
  }, 100);
}

async function doCrash() {
  if (ENG.timer) { clearInterval(ENG.timer); ENG.timer = null; }
  ENG.phase = 'crashed';
  ENG.crashTime = Date.now();
  ENG.bots = ENG.bots.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b);
  ENG.history = [ENG.mult, ...ENG.history].slice(0, 15);

  for (const [ws, c] of clients) {
    if (c.hasBet && !c.cashedOut && c.betId) {
      try {
        await db.update(betsTable).set({ status: 'crashed', payout: 0 }).where(eq(betsTable.id, c.betId));
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'bet_crash', mult: ENG.mult }));
      } catch (e) { console.error('DB bet crash:', e); }
      c.hasBet = false;
    }
  }

  try {
    await db.update(gameRoundsTable)
      .set({ status: 'crashed', crashedAt: new Date() })
      .where(eq(gameRoundsTable.id, ENG.roundId));
  } catch (e) { console.error('DB crash update:', e); }

  broadcast(statePayload());
  setTimeout(startCountdown, 4500);
}

async function processCashout(ws: WebSocket, c: ClientState, mult: number) {
  if (!c.hasBet || c.cashedOut || !c.betId || !c.userId) return;
  c.cashedOut = true; c.hasBet = false;
  const payout = Math.floor(c.betAmount * mult);

  try {
    await db.update(betsTable)
      .set({ status: 'cashed', cashedOutAt: String(mult), payout })
      .where(eq(betsTable.id, c.betId));

    const rows = await db.update(usersTable)
      .set({ balance: sql`balance + ${payout}`, totalWins: sql`total_wins + 1`, totalLosses: sql`total_losses - 1` })
      .where(eq(usersTable.id, c.userId))
      .returning({ balance: usersTable.balance });

    const balance = rows[0]?.balance ?? 0;
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'cashout_ok', mult, payout, balance }));
  } catch (e) {
    console.error('DB cashout error:', e);
    c.cashedOut = false; c.hasBet = true;
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'cashout_fail', error: 'Server error' }));
  }
}

export function handleConnection(ws: WebSocket) {
  const state: ClientState = {
    ws, userId: null, username: null, betId: null,
    betAmount: 0, autoCashout: 0, hasBet: false, cashedOut: false,
  };
  clients.set(ws, state);

  ws.send(JSON.stringify(statePayload()));

  ws.on('message', async (raw) => {
    let msg: { type: string; token?: string; amount?: number; autoCashout?: number };
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.type === 'auth' && msg.token) {
      try {
        const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: number; username: string };
        state.userId = payload.userId;
        state.username = payload.username;
        ws.send(JSON.stringify({ type: 'auth_ok', userId: payload.userId, username: payload.username }));
      } catch {
        ws.send(JSON.stringify({ type: 'auth_fail', error: 'Invalid token' }));
      }
      return;
    }

    if (msg.type === 'place_bet') {
      if (!state.userId) { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Login required' })); return; }
      if (ENG.phase !== 'waiting') { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Bet only during countdown' })); return; }
      if (state.hasBet) { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Already have active bet' })); return; }

      const amount = Math.floor(msg.amount ?? 0);
      if (amount < 10 || amount > 100000) { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Invalid amount (₹10 - ₹1,00,000)' })); return; }

      try {
        const rows = await db.update(usersTable)
          .set({
            balance: sql`balance - ${amount}`,
            totalWagered: sql`total_wagered + ${amount}`,
            totalLosses: sql`total_losses + 1`,
          })
          .where(sql`id = ${state.userId} AND balance >= ${amount}`)
          .returning({ balance: usersTable.balance });

        if (!rows.length) { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Insufficient balance' })); return; }

        const betRows = await db.insert(betsTable).values({
          roundId: ENG.roundId,
          userId: state.userId,
          amount,
          autoCashout: msg.autoCashout ? String(msg.autoCashout) : null,
          status: 'active',
        }).returning({ id: betsTable.id });

        state.betId = betRows[0]?.id ?? null;
        state.betAmount = amount;
        state.autoCashout = msg.autoCashout ?? 0;
        state.hasBet = true;
        state.cashedOut = false;

        ws.send(JSON.stringify({ type: 'bet_ok', balance: rows[0].balance, roundId: ENG.roundId }));
      } catch (e) {
        console.error('DB place_bet error:', e);
        ws.send(JSON.stringify({ type: 'bet_fail', error: 'Server error' }));
      }
      return;
    }

    if (msg.type === 'cashout') {
      if (!state.hasBet || state.cashedOut || ENG.phase !== 'flying') {
        ws.send(JSON.stringify({ type: 'cashout_fail', error: 'Cannot cashout now' })); return;
      }
      await processCashout(ws, state, ENG.mult);
      return;
    }
  });

  ws.on('close', () => { clients.delete(ws); });
}

export function startGameEngine(_wss: WebSocketServer) {
  startCountdown();
}
