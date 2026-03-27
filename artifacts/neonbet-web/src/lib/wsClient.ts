export type Phase = 'waiting' | 'flying' | 'crashed';

export interface RoundBet {
  user: string;
  avatar: number;
  amount: number;
  status: 'active' | 'cashed' | 'lost';
  cashout: number | null;
  winAmount: number;
}

export interface TopBet {
  user: string;
  avatar: number;
  amount: number;
  mult: number;
  win: number;
  date: string;
}

export interface WSState {
  phase: Phase;
  mult: number;
  countdown: number;
  roundId: number;
  startTime: number;
  history: number[];
  connected: boolean;
  synced: boolean;
  allBets: RoundBet[];
  betCount: number;
  cashedCount: number;
  totalWin: number;
  prevRound: { result: number; bets: RoundBet[] } | null;
  topBets: TopBet[];
}

type Listener = () => void;
type MsgListener = (msg: Record<string, unknown>) => void;

const DEFAULT: WSState = {
  phase: 'waiting', mult: 1.0, countdown: 5,
  roundId: 0, startTime: 0, history: [], connected: false, synced: false,
  allBets: [], betCount: 0, cashedCount: 0, totalWin: 0,
  prevRound: null, topBets: [],
};

export const WSC = {
  state: { ...DEFAULT } as WSState,
  listeners: new Set<Listener>(),
  msgListeners: new Set<MsgListener>(),
  socket: null as WebSocket | null,
  token: null as string | null,
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
  initialized: false,
  // Server-sync: authoritative elapsed ms at last state update + local time when received
  _serverElapsedMs: 0,
  _localReceiveTime: 0,
};

/** Returns server-synced elapsed seconds — same on all devices regardless of local clock */
export function getServerElapsed(): number {
  if (WSC.state.phase !== 'flying') return 0;
  return (WSC._serverElapsedMs + (Date.now() - WSC._localReceiveTime)) / 1000;
}

function notify() { WSC.listeners.forEach(fn => fn()); }

export function connectWS(token: string | null) {
  WSC.token = token;
  if (WSC.socket) { WSC.socket.onclose = null; WSC.socket.close(); WSC.socket = null; }
  if (WSC.reconnectTimer) { clearTimeout(WSC.reconnectTimer); WSC.reconnectTimer = null; }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = window.location.host
    ? `${proto}//${window.location.host}/api/ws`
    : `ws://localhost:8080/api/ws`;
  const ws = new WebSocket(wsUrl);
  WSC.socket = ws;

  ws.onopen = () => {
    WSC.state.connected = true;
    notify();
    if (WSC.token) ws.send(JSON.stringify({ type: 'auth', token: WSC.token }));
  };

  ws.onmessage = (e) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(e.data as string); } catch { return; }
    if (msg.type === 'state') {
      WSC._localReceiveTime = Date.now();
      WSC._serverElapsedMs = (msg.elapsedMs as number) ?? 0;
      WSC.state = { ...WSC.state, ...(msg as Partial<WSState>), connected: true };
      notify();
    }
    WSC.msgListeners.forEach(fn => fn(msg));
  };

  ws.onclose = () => {
    WSC.state.connected = false;
    notify();
    WSC.reconnectTimer = setTimeout(() => connectWS(WSC.token), 2500);
  };

  ws.onerror = () => ws.close();
}

export function wsSend(msg: object) {
  if (WSC.socket?.readyState === WebSocket.OPEN) WSC.socket.send(JSON.stringify(msg));
}

/** Returns true if message was sent, false if socket wasn't ready. */
export function wsSendReliable(msg: object): boolean {
  if (WSC.socket?.readyState === WebSocket.OPEN) {
    WSC.socket.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

export function disconnectWS() {
  if (WSC.socket) { WSC.socket.onclose = null; WSC.socket.close(); WSC.socket = null; }
  if (WSC.reconnectTimer) { clearTimeout(WSC.reconnectTimer); WSC.reconnectTimer = null; }
  WSC.state.connected = false;
  notify();
}
