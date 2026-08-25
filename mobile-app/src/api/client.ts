/**
 * 基礎 fetch 客戶端,封裝錯誤處理、JSON 轉換、與 auth token 注入。
 *
 * 路徑相對於 VITE_API_BASE(或 `/api`,會被 Vite proxy 處理)。
 */

const baseUrl = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const apiRoot = baseUrl ? baseUrl : '';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.name = 'ApiError';
  }
}

type TokenGetter = () => string | null;
let getToken: TokenGetter = () => null;

export function setAuthTokenGetter(fn: TokenGetter) {
  getToken = fn;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const url = path.startsWith('http') ? path : apiRoot + path;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const k of Object.keys(query)) {
    const v = query[k];
    if (v === undefined) continue;
    sp.append(k, String(v));
  }
  const qs = sp.toString();
  return qs ? url + (url.includes('?') ? '&' : '?') + qs : url;
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : res.statusText) || ('HTTP ' + res.status);
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}
