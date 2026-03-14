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

export const api = {
  register: (username: string, email: string, password: string) =>
    req<{ token: string; user: ApiUser }>('POST', '/auth/register', { username, email, password }),

  login: (username: string, password: string) =>
    req<{ token: string; user: ApiUser }>('POST', '/auth/login', { username, password }),

  me: (token: string) =>
    req<ApiUser>('GET', '/auth/me', undefined, token),
};
