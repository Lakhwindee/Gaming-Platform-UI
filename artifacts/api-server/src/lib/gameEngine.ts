import { WebSocketServer, WebSocket } from 'ws';
import { db } from '@workspace/db';
import { usersTable, gameRoundsTable, betsTable } from '@workspace/db/schema';
import { eq, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'neonbet-secret-2024';

type Phase = 'waiting' | 'flying' | 'crashed';

interface BetSlot {
  betId: number | null;
  amount: number;
  autoCashout: number;
  active: boolean;
  cashedOut: boolean;
  queued: { amount: number; autoCashout: number } | null;
}

function emptySlot(): BetSlot {
  return { betId: null, amount: 0, autoCashout: 0, active: false, cashedOut: false, queued: null };
}

interface ClientState {
  ws: WebSocket;
  userId: number | null;
  username: string | null;
  slots: [BetSlot, BetSlot];
}

interface RoundBet {
  user: string;
  avatar: number;
  amount: number;
  status: 'active' | 'cashed' | 'lost';
  cashout: number | null;
  winAmount: number;
}

function maskName(name: string): string {
  if (name.length <= 3) return name;
  return name[0] + '***' + name[name.length - 1];
}

function genMaskedId(): string {
  const d1 = Math.floor(Math.random() * 9) + 1;
  const d2 = Math.floor(Math.random() * 10);
  return `${d1}***${d2}`;
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

function genAllBets(): RoundBet[] {
  const count = 8 + Math.floor(Math.random() * 12);
  return Array.from({ length: count }, () => ({
    user: genMaskedId(),
    avatar: Math.floor(Math.random() * 8),
    amount: 100 + Math.floor(Math.random() * 9900),
    status: 'active' as const,
    cashout: null,
    winAmount: 0,
  }));
}

interface TopWin {
  user: string;
  avatar: number;
  amount: number;
  mult: number;
  win: number;
  date: string;
}

const ENG = {
  phase: 'waiting' as Phase,
  mult: 1.0,
  countdown: 5,
  crashPoint: 0,
  roundId: 0,
  startTime: 0,
  allBets: genAllBets() as RoundBet[],
  prevRound: null as { result: number; bets: RoundBet[] } | null,
  topBets: [
    { user: '5***8', avatar: 3, amount: 1000, mult: 88.50, win: 88500, date: new Date().toISOString() },
    { user: '2***1', avatar: 6, amount: 5000, mult: 15.32, win: 76600, date: new Date().toISOString() },
    { user: '7***4', avatar: 1, amount: 2000, mult: 24.10, win: 48200, date: new Date().toISOString() },
    { user: '3***9', avatar: 5, amount: 10000, mult: 4.50, win: 45000, date: new Date().toISOString() },
    { user: '9***2', avatar: 0, amount: 500, mult: 62.00, win: 31000, date: new Date().toISOString() },
  ] as TopWin[],
  history: [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01],
  timer: null as ReturnType<typeof setInterval> | null,
  cdTimer: null as ReturnType<typeof setInterval> | null,
};

const clients = new Map<WebSocket, ClientState>();

function statePayload() {
  const totalWin = ENG.allBets.reduce((s, b) => s + b.winAmount, 0);
  const cashedCount = ENG.allBets.filter(b => b.status === 'cashed').length;
  return {
    type: 'state',
    phase: ENG.phase,
    mult: ENG.mult,
    countdown: ENG.countdown,
    roundId: ENG.roundId,
    startTime: ENG.startTime,
    history: ENG.history,
    allBets: ENG.allBets,
    betCount: ENG.allBets.length,
    cashedCount,
    totalWin,
    prevRound: ENG.prevRound,
    topBets: ENG.topBets.slice(0, 10),
  };
}

function broadcast(data: object) {
  const json = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

async function processCashout(ws: WebSocket, state: ClientState, slotIdx: 0 | 1, mult: number) {
  const slot = state.slots[slotIdx];
  if (!slot.active || slot.cashedOut || !state.userId) return;
  slot.cashedOut = true;
  const payout = Math.floor(slot.amount * mult);

  const bet = ENG.allBets.find(b => b.user === (state.username ? maskName(state.username) : '') && b.status === 'active');
  if (bet) { bet.status = 'cashed'; bet.cashout = mult; bet.winAmount = payout; }

  try {
    if (slot.betId) {
      await db.update(betsTable)
        .set({ status: 'cashed', cashedOutAt: String(mult), payout })
        .where(eq(betsTable.id, slot.betId));
    }
    const rows = await db.update(usersTable)
      .set({ balance: sql`balance + ${payout}`, totalWins: sql`total_wins + 1`, totalLosses: sql`total_losses - 1` })
      .where(eq(usersTable.id, state.userId))
      .returning({ balance: usersTable.balance });

    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'cashout_ok', slot: slotIdx + 1, mult, payout, balance: rows[0]?.balance ?? 0 }));

    if (payout >= 1000) {
      const topEntry: TopWin = {
        user: state.username ? maskName(state.username) : '?***?',
        avatar: Math.floor(Math.random() * 8),
        amount: slot.amount, mult, win: payout,
        date: new Date().toISOString(),
      };
      ENG.topBets = [topEntry, ...ENG.topBets].sort((a, b) => b.win - a.win).slice(0, 20);
    }
  } catch (e) {
    console.error('DB cashout error:', e);
    slot.cashedOut = false;
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'cashout_fail', slot: slotIdx + 1, error: 'Server error' }));
  }
}

async function autoPlaceQueuedBets() {
  for (const [ws, c] of clients) {
    if (!c.userId) continue;
    for (let i = 0; i < 2; i++) {
      const slot = c.slots[i];
      if (!slot.queued) continue;
      const { amount, autoCashout } = slot.queued;
      slot.queued = null;
      try {
        const rows = await db.update(usersTable)
          .set({ balance: sql`balance - ${amount}`, totalWagered: sql`total_wagered + ${amount}`, totalLosses: sql`total_losses + 1` })
          .where(sql`id = ${c.userId} AND balance >= ${amount}`)
          .returning({ balance: usersTable.balance });
        if (!rows.length) {
          ws.send(JSON.stringify({ type: 'bet_fail', slot: i + 1, error: 'Insufficient balance for queued bet' }));
          continue;
        }
        const betRows = await db.insert(betsTable).values({
          roundId: ENG.roundId, userId: c.userId, amount,
          autoCashout: autoCashout ? String(autoCashout) : null, status: 'active',
        }).returning({ id: betsTable.id });
        slot.betId = betRows[0]?.id ?? null;
        slot.amount = amount;
        slot.autoCashout = autoCashout;
        slot.active = true;
        slot.cashedOut = false;
        if (c.username) {
          ENG.allBets.push({ user: maskName(c.username), avatar: Math.floor(Math.random() * 8), amount, status: 'active', cashout: null, winAmount: 0 });
        }
        ws.send(JSON.stringify({ type: 'bet_ok', slot: i + 1, balance: rows[0].balance, roundId: ENG.roundId, auto: true }));
      } catch (e) { console.error('auto queue bet error:', e); }
    }
  }
}

async function startCountdown() {
  ENG.phase = 'waiting';
  ENG.mult = 1.0;
  ENG.countdown = 5;
  ENG.crashPoint = genCrash();

  for (const [, c] of clients) {
    for (const slot of c.slots) {
      slot.active = false; slot.cashedOut = false; slot.betId = null; slot.amount = 0;
    }
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

  ENG.allBets = genAllBets();
  broadcast(statePayload());
  await autoPlaceQueuedBets();

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

    ENG.allBets = ENG.allBets.map(b => {
      if (b.status === 'active' && Math.random() < 0.006 && ENG.mult > 1.2) {
        const win = Math.floor(b.amount * ENG.mult);
        return { ...b, status: 'cashed' as const, cashout: ENG.mult, winAmount: win };
      }
      return b;
    });

    for (const [ws, c] of clients) {
      for (let i = 0; i < 2; i++) {
        const slot = c.slots[i];
        if (slot.active && !slot.cashedOut && slot.autoCashout > 1.05 && ENG.mult >= slot.autoCashout) {
          await processCashout(ws, c, i as 0 | 1, ENG.mult);
        }
      }
    }

    broadcast(statePayload());
    if (ENG.mult >= ENG.crashPoint) await doCrash();
  }, 100);
}

async function doCrash() {
  if (ENG.timer) { clearInterval(ENG.timer); ENG.timer = null; }
  ENG.phase = 'crashed';

  const finalBets = ENG.allBets.map(b =>
    b.status === 'active' ? { ...b, status: 'lost' as const } : b
  );
  ENG.allBets = finalBets;
  ENG.prevRound = { result: ENG.mult, bets: [...finalBets] };
  ENG.history = [ENG.mult, ...ENG.history].slice(0, 20);

  for (const [ws, c] of clients) {
    for (let i = 0; i < 2; i++) {
      const slot = c.slots[i];
      if (slot.active && !slot.cashedOut && slot.betId) {
        try {
          await db.update(betsTable).set({ status: 'crashed', payout: 0 }).where(eq(betsTable.id, slot.betId));
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'bet_crash', slot: i + 1, mult: ENG.mult, amount: slot.amount }));
        } catch (e) { console.error('DB bet crash:', e); }
      }
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

export function handleConnection(ws: WebSocket) {
  const state: ClientState = {
    ws, userId: null, username: null,
    slots: [emptySlot(), emptySlot()],
  };
  clients.set(ws, state);
  ws.send(JSON.stringify(statePayload()));

  ws.on('message', async (raw) => {
    let msg: { type: string; token?: string; amount?: number; autoCashout?: number; slot?: number };
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
      const slotIdx = (((msg.slot ?? 1) - 1) as 0 | 1);
      if (slotIdx !== 0 && slotIdx !== 1) { ws.send(JSON.stringify({ type: 'bet_fail', error: 'Invalid slot' })); return; }
      const slot = state.slots[slotIdx];
      const amount = Math.floor(msg.amount ?? 0);
      if (amount < 10 || amount > 100000) {
        ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Invalid amount (₹10 - ₹1,00,000)' }));
        return;
      }

      if (ENG.phase === 'flying') {
        if (slot.active || slot.queued) {
          ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Slot already has a bet' }));
          return;
        }
        slot.queued = { amount, autoCashout: msg.autoCashout ?? 0 };
        ws.send(JSON.stringify({ type: 'bet_queued', slot: slotIdx + 1, amount }));
        return;
      }

      if (ENG.phase !== 'waiting') {
        ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Wait for next round' }));
        return;
      }
      if (slot.active) {
        ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Slot already active' }));
        return;
      }

      try {
        const rows = await db.update(usersTable)
          .set({ balance: sql`balance - ${amount}`, totalWagered: sql`total_wagered + ${amount}`, totalLosses: sql`total_losses + 1` })
          .where(sql`id = ${state.userId} AND balance >= ${amount}`)
          .returning({ balance: usersTable.balance });
        if (!rows.length) { ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Insufficient balance' })); return; }

        const betRows = await db.insert(betsTable).values({
          roundId: ENG.roundId, userId: state.userId, amount,
          autoCashout: msg.autoCashout ? String(msg.autoCashout) : null, status: 'active',
        }).returning({ id: betsTable.id });

        slot.betId = betRows[0]?.id ?? null;
        slot.amount = amount;
        slot.autoCashout = msg.autoCashout ?? 0;
        slot.active = true;
        slot.cashedOut = false;

        if (state.username) {
          ENG.allBets.push({ user: maskName(state.username), avatar: Math.floor(Math.random() * 8), amount, status: 'active', cashout: null, winAmount: 0 });
        }

        ws.send(JSON.stringify({ type: 'bet_ok', slot: slotIdx + 1, balance: rows[0].balance, roundId: ENG.roundId }));
      } catch (e) {
        console.error('DB place_bet error:', e);
        ws.send(JSON.stringify({ type: 'bet_fail', slot: slotIdx + 1, error: 'Server error' }));
      }
      return;
    }

    if (msg.type === 'cancel_bet') {
      if (!state.userId) return;
      const slotIdx = (((msg.slot ?? 1) - 1) as 0 | 1);
      const slot = state.slots[slotIdx];

      if (slot.queued) {
        slot.queued = null;
        ws.send(JSON.stringify({ type: 'bet_cancelled', slot: slotIdx + 1, refunded: false }));
        return;
      }
      if (slot.active && !slot.cashedOut && ENG.phase === 'waiting') {
        const amount = slot.amount;
        slot.active = false; slot.betId = null; slot.amount = 0;
        if (state.username) {
          const idx = ENG.allBets.findIndex(b => b.user === maskName(state.username!) && b.status === 'active');
          if (idx !== -1) ENG.allBets.splice(idx, 1);
        }
        try {
          const rows = await db.update(usersTable)
            .set({ balance: sql`balance + ${amount}`, totalWagered: sql`total_wagered - ${amount}`, totalLosses: sql`total_losses - 1` })
            .where(eq(usersTable.id, state.userId))
            .returning({ balance: usersTable.balance });
          ws.send(JSON.stringify({ type: 'bet_cancelled', slot: slotIdx + 1, amount, refunded: true, balance: rows[0]?.balance }));
        } catch {
          ws.send(JSON.stringify({ type: 'bet_cancel_fail', slot: slotIdx + 1, error: 'Server error' }));
        }
        return;
      }
      ws.send(JSON.stringify({ type: 'bet_cancel_fail', slot: slotIdx + 1, error: 'Cannot cancel now' }));
      return;
    }

    if (msg.type === 'cashout') {
      if (!state.userId) return;
      const slotIdx = (((msg.slot ?? 1) - 1) as 0 | 1);
      const slot = state.slots[slotIdx];
      if (!slot.active || slot.cashedOut || ENG.phase !== 'flying') {
        ws.send(JSON.stringify({ type: 'cashout_fail', slot: slotIdx + 1, error: 'Cannot cashout now' }));
        return;
      }
      await processCashout(ws, state, slotIdx, ENG.mult);
      return;
    }
  });

  ws.on('close', () => { clients.delete(ws); });
}

export function startGameEngine(_wss: WebSocketServer) {
  startCountdown();
}
