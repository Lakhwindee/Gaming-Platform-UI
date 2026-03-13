import React, { createContext, useContext, useEffect, useReducer } from 'react';

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
  vipLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
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
  | { type: 'TOGGLE_CHAT' };

const init: State = {
  user: null,
  history: [],
  page: 'home',
  activeGame: null,
  notifications: [],
  walletOpen: false,
  chatOpen: false,
};

function getVipLevel(totalWagered: number): User['vipLevel'] {
  if (totalWagered >= 5000000) return 'Diamond';
  if (totalWagered >= 1000000) return 'Platinum';
  if (totalWagered >= 500000) return 'Gold';
  if (totalWagered >= 100000) return 'Silver';
  return 'Bronze';
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.user };
    case 'LOGOUT': return { ...state, user: null, history: [] };
    case 'ADD_HISTORY': {
      const e = action.entry;
      const newHistory = [e, ...state.history].slice(0, 500);
      if (!state.user) return { ...state, history: newHistory };
      const profit = e.payout - e.wager;
      const newWagered = state.user.totalWagered + e.wager;
      const newXp = state.user.xp + Math.floor(e.wager / 5);
      const newCoins = state.user.coins + Math.floor(e.wager / 10);
      return {
        ...state,
        history: newHistory,
        user: {
          ...state.user,
          balance: state.user.balance + profit,
          coins: newCoins,
          totalWins: state.user.totalWins + (e.won ? 1 : 0),
          totalLosses: state.user.totalLosses + (e.won ? 0 : 1),
          totalWagered: newWagered,
          xp: newXp,
          level: Math.floor(newXp / 500) + 1,
          vipLevel: getVipLevel(newWagered),
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
  login: (username: string, email: string) => void;
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
  const saved = (() => {
    try {
      const u = localStorage.getItem('nb_user');
      const h = localStorage.getItem('nb_history');
      return { user: u ? JSON.parse(u) : null, history: h ? JSON.parse(h) : [] };
    } catch { return { user: null, history: [] }; }
  })();

  const [state, dispatch] = useReducer(reducer, { ...init, user: saved.user, history: saved.history });

  useEffect(() => {
    if (state.user) localStorage.setItem('nb_user', JSON.stringify(state.user));
    else localStorage.removeItem('nb_user');
  }, [state.user]);

  useEffect(() => {
    localStorage.setItem('nb_history', JSON.stringify(state.history));
  }, [state.history]);

  const login = (username: string, email: string) => {
    const user: User = {
      id: Date.now().toString(),
      username,
      email,
      balance: 10000,
      coins: 500,
      totalWins: 0,
      totalLosses: 0,
      totalWagered: 0,
      level: 1,
      xp: 0,
      vipLevel: 'Bronze',
    };
    dispatch({ type: 'LOGIN', user });
  };

  const logout = () => dispatch({ type: 'LOGOUT' });
  const addHistory = (e: GameHistory) => dispatch({ type: 'ADD_HISTORY', entry: e });
  const navigate = (page: string) => dispatch({ type: 'SET_PAGE', page });
  const playGame = (game: string) => dispatch({ type: 'SET_GAME', game });
  const addNotification = (message: string, type: Notification['type'] = 'info') => {
    dispatch({ type: 'ADD_NOTIFICATION', notif: { id: Date.now().toString(), type, message, timestamp: Date.now() } });
  };
  const toggleWallet = () => dispatch({ type: 'TOGGLE_WALLET' });
  const toggleChat = () => dispatch({ type: 'TOGGLE_CHAT' });

  return (
    <GameCtx.Provider value={{ state, login, logout, addHistory, navigate, playGame, addNotification, toggleWallet, toggleChat }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}

let _id = 0;
export function makeId() { return `${Date.now()}-${_id++}`; }
