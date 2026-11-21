/**
 * 員工登入失敗次數限制（記憶體內，單一行程）。
 *
 * - 先「預約」一次嘗試（begin）再做 bcrypt 比對：並行送出的請求也算在內，
 *   不能靠同時送出大量請求繞過上限。
 * - 以多個 key 同時計數（見 staff/routes.ts）：
 *     帳號＋IP：5 次（一般猜錯）
 *     IP：20 次（同一來源猜很多帳號）
 *     帳號：50 次（分散 IP 猜同一帳號）
 *   只憑帳號名稱打錯 5 次，鎖不住別的 IP 上的店長。
 */
export const WINDOW_MS = 15 * 60 * 1000;
/** 同一帳號、同一 IP 的失敗上限 */
export const MAX_FAILURES = 5;
export const MAX_FAILURES_PER_IP = 20;
export const MAX_FAILURES_PER_USER = 50;

interface Entry {
  failures: number;
  inFlight: number;
  firstAt: number;
}

export class LoginThrottle {
  private entries = new Map<string, Entry>();

  constructor(private readonly maxFailures: number) {}

  private entry(key: string, now: number): Entry {
    let e = this.entries.get(key);
    if (e && e.inFlight === 0 && now - e.firstAt > WINDOW_MS) {
      this.entries.delete(key);
      e = undefined;
    }
    if (!e) {
      e = { failures: 0, inFlight: 0, firstAt: now };
      this.entries.set(key, e);
    }
    return e;
  }

  /** 進行中的嘗試也算進上限。 */
  isBlocked(key: string, now = Date.now()): boolean {
    const e = this.entry(key, now);
    return e.failures + e.inFlight >= this.maxFailures;
  }

  /** 開始一次嘗試；之後必須呼叫 fail() 或 succeed()。 */
  begin(key: string, now = Date.now()): void {
    this.entry(key, now).inFlight += 1;
  }

  fail(key: string, now = Date.now()): void {
    const e = this.entry(key, now);
    e.inFlight = Math.max(0, e.inFlight - 1);
    e.failures += 1;
  }

  succeed(key: string): void {
    this.entries.delete(key);
  }

  /** 結束嘗試但不計成功或失敗（例如發生例外）。 */
  release(key: string, now = Date.now()): void {
    const e = this.entry(key, now);
    e.inFlight = Math.max(0, e.inFlight - 1);
  }
}

/** 一次登入同時檢查多個 key；任何一個達上限就擋。 */
export class LoginGuard {
  constructor(private readonly rules: Array<{ throttle: LoginThrottle; key: string }>) {}

  isBlocked(): boolean {
    return this.rules.some((r) => r.throttle.isBlocked(r.key));
  }
  begin(): void {
    for (const r of this.rules) r.throttle.begin(r.key);
  }
  fail(): void {
    for (const r of this.rules) r.throttle.fail(r.key);
  }
  /** 成功：清掉帳號＋IP 與 IP 的計數；帳號總數只釋放這次嘗試（避免攻擊者用自己的帳號清掉別人的計數）。 */
  succeed(clear: (key: string) => boolean): void {
    for (const r of this.rules) {
      if (clear(r.key)) r.throttle.succeed(r.key);
      else r.throttle.release(r.key);
    }
  }
  release(): void {
    for (const r of this.rules) r.throttle.release(r.key);
  }
}
