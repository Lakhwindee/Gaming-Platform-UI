import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { api, ApiUser } from "@/lib/api";
import { connectWS, disconnectWS, WSC } from "@/lib/wsClient";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  balance: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  vipLevel: string;
  level: number;
  xp: number;
}

type State = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
};

type Action =
  | { type: "SET_USER"; user: AuthUser; token: string }
  | { type: "UPDATE_BALANCE"; balance: number }
  | { type: "LOGOUT" }
  | { type: "LOADED" };

function toAuthUser(u: ApiUser): AuthUser {
  return {
    id: String(u.id),
    username: u.username,
    email: u.email,
    balance: u.balance,
    totalWins: u.totalWins,
    totalLosses: u.totalLosses,
    totalWagered: u.totalWagered,
    vipLevel: u.vipLevel,
    level: Math.floor(u.totalWagered / 5000) + 1,
    xp: Math.floor(u.totalWagered / 5),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER": return { ...state, user: action.user, token: action.token, loading: false };
    case "UPDATE_BALANCE": return state.user ? { ...state, user: { ...state.user, balance: action.balance } } : state;
    case "LOGOUT": return { user: null, token: null, loading: false };
    case "LOADED": return { ...state, loading: false };
    default: return state;
  }
}

interface Ctx {
  state: State;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { user: null, token: null, loading: true });
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    AsyncStorage.getItem("aviator_token").then(async (token) => {
      if (token) {
        try {
          const u = await api.me(token);
          dispatchRef.current({ type: "SET_USER", user: toAuthUser(u), token });
          connectWS(token);
        } catch {
          await AsyncStorage.removeItem("aviator_token");
          dispatchRef.current({ type: "LOADED" });
          connectWS(null);
        }
      } else {
        dispatchRef.current({ type: "LOADED" });
        connectWS(null);
      }
    });
  }, []);

  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      if ((msg.type === "cashout_ok" || msg.type === "bet_ok") && msg.balance !== undefined) {
        dispatchRef.current({ type: "UPDATE_BALANCE", balance: msg.balance as number });
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user } = await api.login(username, password);
    await AsyncStorage.setItem("aviator_token", token);
    dispatch({ type: "SET_USER", user: toAuthUser(user), token });
    connectWS(token);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { token, user } = await api.register(username, email, password);
    await AsyncStorage.setItem("aviator_token", token);
    dispatch({ type: "SET_USER", user: toAuthUser(user), token });
    connectWS(token);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("aviator_token");
    dispatch({ type: "LOGOUT" });
    disconnectWS();
    connectWS(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    const token = state.token;
    if (!token) return;
    try {
      const u = await api.me(token);
      dispatch({ type: "UPDATE_BALANCE", balance: u.balance });
    } catch {}
  }, [state.token]);

  return (
    <AuthCtx.Provider value={{ state, login, register, logout, refreshBalance }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
