const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

async function request<T>(path: string, opts?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...((opts?.headers as Record<string, string>) ?? {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
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

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  balance: number;
  amount: number;
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

  getTransactions: (token: string) =>
    request<ApiTransaction[]>("/wallet/transactions", undefined, token),

  deposit: (token: string, amount: number, txRef: string) =>
    request<{ balance: number }>("/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, txRef }),
    }, token),

  withdraw: (token: string, amount: number, upiId: string) =>
    request<{ message: string; balance: number }>("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, upiId }),
    }, token),

  getPaymentConfig: (token?: string) =>
    request<{ keyId: string | null; enabled: boolean }>("/payment/config", undefined, token),

  createPaymentOrder: (token: string, amount: number) =>
    request<PaymentOrder>("/payment/create-order", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }, token),

  verifyPayment: (token: string, data: { paymentId: string; orderId: string; signature: string; amount: number }) =>
    request<PaymentVerifyResult>("/payment/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
};
