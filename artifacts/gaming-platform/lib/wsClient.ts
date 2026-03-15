export type Phase = "waiting" | "flying" | "crashed";

export interface RoundBet {
  user: string;
  avatar: number;
  amount: number;
  status: "active" | "cashed" | "lost";
  cashout: number | null;
  winAmount: number;
}

export interface TopWin {
  user: string;
  avatar: number;
  amount: number;
  mult: number;
  win: number;
  date: string;
}

export interface TopHistoryEntry {
  mult: number;
  date: string;
}

export interface WSState {
  phase: Phase;
  mult: number;
  countdown: number;
  roundId: number;
  startTime: number;
  history: number[];
  allBets: RoundBet[];
  betCount: number;
  cashedCount: number;
  totalWin: number;
  prevRound: { result: number; bets: RoundBet[] } | null;
  topBets: TopWin[];
  topHistory: TopHistoryEntry[];
  connected: boolean;
}

type Listener = () => void;
type MsgListener = (msg: Record<string, unknown>) => void;

const DEFAULT: WSState = {
  phase: "waiting", mult: 1.0, countdown: 5,
  roundId: 0, startTime: 0, history: [],
  allBets: [], betCount: 0, cashedCount: 0, totalWin: 0,
  prevRound: null, topBets: [], topHistory: [], connected: false,
};

export const WSC = {
  state: { ...DEFAULT } as WSState,
  listeners: new Set<Listener>(),
  msgListeners: new Set<MsgListener>(),
  socket: null as WebSocket | null,
  token: null as string | null,
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
};

function notify() { WSC.listeners.forEach(fn => fn()); }

export function connectWS(token: string | null) {
  WSC.token = token;
  if (WSC.socket) { WSC.socket.onclose = null; WSC.socket.close(); WSC.socket = null; }
  if (WSC.reconnectTimer) { clearTimeout(WSC.reconnectTimer); WSC.reconnectTimer = null; }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const url = domain ? `wss://${domain}/api/ws` : "ws://localhost:8080/api/ws";
  const ws = new WebSocket(url);
  WSC.socket = ws;

  ws.onopen = () => {
    WSC.state.connected = true;
    notify();
    if (WSC.token) ws.send(JSON.stringify({ type: "auth", token: WSC.token }));
  };

  ws.onmessage = (e: MessageEvent) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(e.data as string); } catch { return; }
    if (msg.type === "state") {
      WSC.state = { ...WSC.state, ...(msg as Partial<WSState>), connected: true };
      notify();
    }
    WSC.msgListeners.forEach(fn => fn(msg));
  };

  ws.onclose = () => {
    WSC.state.connected = false;
    notify();
    WSC.reconnectTimer = setTimeout(() => connectWS(WSC.token), 3000);
  };

  ws.onerror = () => ws.close();
}

export function wsSend(msg: object) {
  if (WSC.socket?.readyState === WebSocket.OPEN) WSC.socket.send(JSON.stringify(msg));
}

export function disconnectWS() {
  if (WSC.socket) { WSC.socket.onclose = null; WSC.socket.close(); WSC.socket = null; }
  if (WSC.reconnectTimer) { clearTimeout(WSC.reconnectTimer); WSC.reconnectTimer = null; }
  WSC.state.connected = false;
  notify();
}
