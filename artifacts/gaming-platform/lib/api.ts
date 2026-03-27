const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

async function request<T>(path: string, opts?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...((opts?.headers as Record<string, string>) ?? {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data === 'object' ? JSON.stringify(data) : (data.error ?? "Request failed"));
  return data as T;
}

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  balance: number;
  totalWins: number;
  totalLosses: number;
  totalWagered: number;
  vipLevel: string;
}

export interface ApiTransaction {
  id: number;
  type: string;
  amount: number;
  note: string;
  status: string;
  createdAt: string;
}

export interface ApiGameHistory {
  betId: number;
  roundId: number | null;
  amount: number;
  payout: number | null;
  cashedOutAt: string | null;
  status: string;
  placedAt: string;
  crashPoint: string | null;
}

export interface UpiInitResult {
  txnRef: string;
  merchantUpi: string;
  amount: number;
  bonus: number;
  total: number;
}

export interface UpiConfirmResult {
  success: boolean;
  balance: number;
  depositAmount: number;
  bonus: number;
  totalCredit: number;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: ApiUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (username: string, password: string) =>
    request<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: (token: string) => request<ApiUser>("/auth/me", undefined, token),

  getBalance: (token: string) =>
    request<{ balance: number; wagerRequirement: number }>("/wallet/balance", undefined, token),

  getTransactions: (token: string) =>
    request<ApiTransaction[]>("/wallet/transactions", undefined, token),

  withdraw: (token: string, amount: number, upiId: string) =>
    request<{ message: string; balance: number }>("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, upiId }),
    }, token),

  upiInitiate: (token: string, amount: number, method: string) =>
    request<UpiInitResult>("/payment/upi-initiate", {
      method: "POST",
      body: JSON.stringify({ amount, method }),
    }, token),

  upiConfirm: (token: string, txnRef: string, utr?: string) =>
    request<UpiConfirmResult>("/payment/upi-confirm", {
      method: "POST",
      body: JSON.stringify({ txnRef, utr }),
    }, token),

  getGameHistory: (token: string) =>
    request<ApiGameHistory[]>("/auth/game-history", undefined, token),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),

};
