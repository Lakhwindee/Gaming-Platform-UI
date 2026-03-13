import React, { createContext, useContext, useEffect, useReducer } from 'react';

export type User = {
  id: string;
  username: string;
  email: string;
  balance: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  level: number;
  xp: number;
};

export type GameHistory = {
  id: string;
  game: 'crash' | 'dice' | 'coinflip';
  wager: number;
  multiplier: number;
  payout: number;
  won: boolean;
  timestamp: number;
};

type State = {
  user: User | null;
  history: GameHistory[];
  page: string;
  activeGame: string | null;
};

type Action =
  | { type: 'LOGIN'; user: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_HISTORY'; entry: GameHistory }
  | { type: 'UPDATE_BALANCE'; amount: number }
  | { type: 'SET_PAGE'; page: string }
  | { type: 'SET_GAME'; game: string | null };

const init: State = {
  user: null,
  history: [],
  page: 'lobby',
  activeGame: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.user };
    case 'LOGOUT':
      return { ...state, user: null, history: [] };
    case 'ADD_HISTORY': {
      const entry = action.entry;
      const newHistory = [entry, ...state.history].slice(0, 200);
      if (!state.user) return { ...state, history: newHistory };
      const profit = entry.payout - entry.wager;
      return {
        ...state,
        history: newHistory,
        user: {
          ...state.user,
          balance: state.user.balance + profit,
          totalWins: state.user.totalWins + (entry.won ? 1 : 0),
          totalLosses: state.user.totalLosses + (entry.won ? 0 : 1),
          totalWagered: state.user.totalWagered + entry.wager,
          xp: state.user.xp + Math.floor(entry.wager / 5),
          level: Math.floor((state.user.xp + Math.floor(entry.wager / 5)) / 500) + 1,
        },
      };
    }
    case 'UPDATE_BALANCE':
      if (!state.user) return state;
      return { ...state, user: { ...state.user, balance: action.amount } };
    case 'SET_PAGE':
      return { ...state, page: action.page, activeGame: null };
    case 'SET_GAME':
      return { ...state, activeGame: action.game };
    default:
      return state;
  }
}

type Ctx = {
  state: State;
  login: (username: string, email: string) => void;
  logout: () => void;
  addHistory: (e: GameHistory) => void;
  navigate: (page: string) => void;
  playGame: (game: string) => void;
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
      totalWins: 0,
      totalLosses: 0,
      totalWagered: 0,
      level: 1,
      xp: 0,
    };
    dispatch({ type: 'LOGIN', user });
  };

  const logout = () => dispatch({ type: 'LOGOUT' });
  const addHistory = (e: GameHistory) => dispatch({ type: 'ADD_HISTORY', entry: e });
  const navigate = (page: string) => dispatch({ type: 'SET_PAGE', page });
  const playGame = (game: string) => dispatch({ type: 'SET_GAME', game });

  return (
    <GameCtx.Provider value={{ state, login, logout, addHistory, navigate, playGame }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameProvider');
  return ctx;
}

let _histId = 0;
export function makeId() { return `${Date.now()}-${_histId++}`; }
