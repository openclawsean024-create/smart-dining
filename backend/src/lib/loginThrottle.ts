/**
 * 員工登入失敗次數限制（記憶體內，單機）。
 * 同一帳號在 WINDOW_MS 內連續失敗 MAX_FAILURES 次後，暫時拒絕登入，降低暴力猜密碼的風險。
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  firstFailureAt: number;
}

export class LoginThrottle {
  private entries = new Map<string, Entry>();

  private fresh(key: string, now: number): Entry | undefined {
    const e = this.entries.get(key);
    if (e && now - e.firstFailureAt > WINDOW_MS) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    const e = this.fresh(key, now);
    return !!e && e.failures >= MAX_FAILURES;
  }

  recordFailure(key: string, now = Date.now()): void {
    const e = this.fresh(key, now);
    if (e) e.failures += 1;
    else this.entries.set(key, { failures: 1, firstFailureAt: now });
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}
