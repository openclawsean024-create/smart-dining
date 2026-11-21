/**
 * fetch wrapper — base URL + JWT header + 統一錯誤格式。
 *
 * 後端啟動於 http://localhost:4000,
 * Vite proxy 已將 /api → http://localhost:4000,所以這裡用相對路徑。
 *
 * 若瀏覽器直接連(無 proxy),可改為 import.meta.env.VITE_API_BASE。
 */

import { useStaffStore } from '../store/staffStore';

const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * 呼叫時使用哪一種身分:
 *   - 'member'(預設):顧客會員 JWT(localStorage,結帳登入後才有)
 *   - 'staff':員工 JWT(staffStore;後台 / KDS / 菜單管理)
 *   - 'none':不帶 Authorization
 */
export type AuthMode = 'member' | 'staff' | 'none';

function getAuthToken(mode: AuthMode): string | null {
  if (mode === 'none') return null;
  if (mode === 'staff') return useStaffStore.getState().token;
  try {
    return localStorage.getItem('kiosk_token');
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 額外 header(會與 Authorization 合併) */
  headers?: Record<string, string>;
  /** 關閉自動加 Authorization(用於 /api/auth/login、/api/auth/verify);等同 auth: 'none' */
  noAuth?: boolean;
  /** 使用哪一種身分的 token,預設 'member' */
  auth?: AuthMode;
  /** 逾時(ms),預設 15000 */
  timeoutMs?: number;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : '/' + path;
  return (API_BASE || '') + p;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, noAuth = false, timeoutMs = 15000 } = opts;
  const authMode: AuthMode = noAuth ? 'none' : (opts.auth ?? 'member');

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  const token = getAuthToken(authMode);
  if (token) finalHeaders['Authorization'] = 'Bearer ' + token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method,
      headers: finalHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : 'Network error';
    throw new ApiError(msg, 0, null);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    // 員工 token 失效(過期、帳號停用)→ 清掉登入狀態,畫面會回到員工登入頁
    if (res.status === 401 && authMode === 'staff' && token) {
      useStaffStore.getState().clear();
    }
    const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    // 後端錯誤格式為 { error: string };Fastify 內建錯誤為 { message: string }
    const message =
      obj && typeof obj.error === 'string' && obj.error !== 'Internal Server Error'
        ? obj.error
        : obj && typeof obj.message === 'string'
          ? obj.message
          : res.statusText || 'Request failed';
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}
