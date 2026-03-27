import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { api, ApiUser } from '../lib/api';
import { connectWS, disconnectWS, WSC } from '../lib/wsClient';

export type User = {
  id: string;
  username: string;
  email: string;
  balance: number;
  coins: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  level: number;
  xp: number;
  vipLevel: string;
};

export type GameHistory = {
  id: string;
  game: string;
  wager: number;
  multiplier: number;
  payout: number;
  won: boolean;
  timestamp: number;
};

export type Notification = {
  id: string;
  type: 'win' | 'bonus' | 'info';
  message: string;
  timestamp: number;
};

type State = {
  user: User | null;
  history: GameHistory[];
  page: string;
  activeGame: string | null;
  notifications: Notification[];
  walletOpen: boolean;
  chatOpen: boolean;
  authLoading: boolean;
};

type Action =
  | { type: 'LOGIN'; user: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_HISTORY'; entry: GameHistory }
  | { type: 'UPDATE_BALANCE'; amount: number }
  | { type: 'ADD_COINS'; amount: number }
  | { type: 'SET_PAGE'; page: string }
  | { type: 'SET_GAME'; game: string | null }
  | { type: 'ADD_NOTIFICATION'; notif: Notification }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'TOGGLE_WALLET' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_AUTH_LOADING'; loading: boolean };

const init: State = {
  user: null, history: [], page: 'home',
  activeGame: null, notifications: [], walletOpen: false, chatOpen: false, authLoading: true,
};

function apiUserToUser(u: ApiUser): User {
  return {
    id: String(u.id), username: u.username, email: u.email,
    balance: u.balance, coins: Math.floor(u.totalWagered / 10),
    totalWins: u.totalWins, totalLosses: u.totalLosses, totalWagered: u.totalWagered,
    level: Math.floor(u.totalWagered / 5000) + 1,
    xp: Math.floor(u.totalWagered / 5),
    vipLevel: u.vipLevel,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.user, authLoading: false };
    case 'LOGOUT': return { ...state, user: null, history: [], authLoading: false };
    case 'SET_AUTH_LOADING': return { ...state, authLoading: action.loading };
    case 'ADD_HISTORY': {
      const e = action.entry;
      const newHistory = [e, ...state.history].slice(0, 500);
      if (!state.user) return { ...state, history: newHistory };
      const profit = e.payout - e.wager;
      const newWagered = state.user.totalWagered + e.wager;
      const newXp = state.user.xp + Math.floor(e.wager / 5);
      const newCoins = state.user.coins + Math.floor(e.wager / 10);
      return {
        ...state, history: newHistory,
        user: {
          ...state.user,
          balance: state.user.balance + profit,
          coins: newCoins,
          totalWins: state.user.totalWins + (e.won ? 1 : 0),
          totalLosses: state.user.totalLosses + (e.won ? 0 : 1),
          totalWagered: newWagered,
          xp: newXp,
          level: Math.floor(newXp / 500) + 1,
          vipLevel: e.won && newWagered >= 5000000 ? 'Diamond' : e.won && newWagered >= 1000000 ? 'Platinum' : e.won && newWagered >= 500000 ? 'Gold' : e.won && newWagered >= 100000 ? 'Silver' : state.user.vipLevel,
        },
      };
    }
    case 'UPDATE_BALANCE':
      if (!state.user) return state;
      return { ...state, user: { ...state.user, balance: action.amount } };
    case 'ADD_COINS':
      if (!state.user) return state;
      return { ...state, user: { ...state.user, coins: state.user.coins + action.amount } };
    case 'SET_PAGE':
      return { ...state, page: action.page, activeGame: null };
    case 'SET_GAME':
      return { ...state, activeGame: action.game };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notif, ...state.notifications].slice(0, 20) };
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    case 'TOGGLE_WALLET':
      return { ...state, walletOpen: !state.walletOpen };
    case 'TOGGLE_CHAT':
      return { ...state, chatOpen: !state.chatOpen };
    default: return state;
  }
}

type Ctx = {
  state: State;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  addHistory: (e: GameHistory) => void;
  navigate: (page: string) => void;
  playGame: (game: string) => void;
  addNotification: (msg: string, type?: Notification['type']) => void;
  toggleWallet: () => void;
  toggleChat: () => void;
};

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, init);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // On mount: restore session from localStorage token
  useEffect(() => {
    const token = localStorage.getItem('nb_token');
    const history = (() => { try { return JSON.parse(localStorage.getItem('nb_history') ?? '[]'); } catch { return []; } })();
    if (token) {
      api.me(token).then(u => {
        dispatchRef.current({ type: 'LOGIN', user: apiUserToUser(u) });
        connectWS(token);
      }).catch(() => {
        localStorage.removeItem('nb_token');
        dispatchRef.current({ type: 'SET_AUTH_LOADING', loading: false });
        connectWS(null);
      });
    } else {
      dispatchRef.current({ type: 'SET_AUTH_LOADING', loading: false });
      connectWS(null);
    }
    if (history.length) history.forEach((e: GameHistory) => dispatchRef.current({ type: 'ADD_HISTORY', entry: e }));
  }, []);

  // WebSocket balance updates (from crash game bet/cashout)
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type === 'cashout_ok' || msg.type === 'bet_ok') {
        dispatchRef.current({ type: 'UPDATE_BALANCE', amount: msg.balance as number });
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, []);

  // Persist history
  useEffect(() => {
    localStorage.setItem('nb_history', JSON.stringify(state.history));
  }, [state.history]);

  const login = async (username: string, password: string) => {
    const { token, user } = await api.login(username, password);
    localStorage.setItem('nb_token', token);
    dispatch({ type: 'LOGIN', user: apiUserToUser(user) });
    connectWS(token);
  };

  const register = async (username: string, email: string, password: string) => {
    const { token, user } = await api.register(username, email, password);
    localStorage.setItem('nb_token', token);
    dispatch({ type: 'LOGIN', user: apiUserToUser(user) });
    connectWS(token);
  };

  const logout = () => {
    localStorage.removeItem('nb_token');
    dispatch({ type: 'LOGOUT' });
    disconnectWS();
    connectWS(null);
  };

  const addHistory = (e: GameHistory) => dispatch({ type: 'ADD_HISTORY', entry: e });
  const navigate = (page: string) => dispatch({ type: 'SET_PAGE', page });
  const playGame = (game: string) => dispatch({ type: 'SET_GAME', game });
  const addNotification = (message: string, type: Notification['type'] = 'info') => {
    dispatch({ type: 'ADD_NOTIFICATION', notif: { id: Date.now().toString(), type, message, timestamp: Date.now() } });
  };
  const toggleWallet = () => dispatch({ type: 'TOGGLE_WALLET' });
  const toggleChat = () => dispatch({ type: 'TOGGLE_CHAT' });

  return (
    <GameCtx.Provider value={{ state, login, register, logout, addHistory, navigate, playGame, addNotification, toggleWallet, toggleChat }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}

