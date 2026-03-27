const BASE = '/api';

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

async function req<T>(method: string, path: string, body?: object, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export interface ApiTransaction {
  id: number;
  type: string;
  amount: number;
  note: string;
  status: string;
  createdAt: string;
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
    req<{ token: string; user: ApiUser }>('POST', '/auth/register', { username, email, password }),

  login: (username: string, password: string) =>
    req<{ token: string; user: ApiUser }>('POST', '/auth/login', { username, password }),

  me: (token: string) =>
    req<ApiUser>('GET', '/auth/me', undefined, token),

  getGameHistory: (token: string) =>
    req<ApiGameHistory[]>('GET', '/game/history', undefined, token),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    req<{ message: string }>('POST', '/auth/change-password', { currentPassword, newPassword }, token),

  getTransactions: (token: string) =>
    req<ApiTransaction[]>('GET', '/wallet/transactions', undefined, token),

  withdraw: (token: string, amount: number, upiId: string) =>
    req<{ message: string; balance: number }>('POST', '/wallet/withdraw', { amount, upiId }, token),

  upiInitiate: (token: string, amount: number, method: string) =>
    req<UpiInitResult>('POST', '/payment/upi-initiate', { amount, method }, token),

  upiConfirm: (token: string, txnRef: string, utr?: string) =>
    req<UpiConfirmResult>('POST', '/payment/upi-confirm', { txnRef, utr }, token),
};
