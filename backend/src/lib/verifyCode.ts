/**
 * OTP Provider abstraction for the smart-dining backend.
 *
 * AC-011：不再有任何寫死的預設驗證碼（舊版對所有手機號碼都接受 '1234'，
 * 知道這個碼的人可以冒用任何會員登入）。
 *
 * - `MockOTPProvider`（預設）：每次寄送產生隨機 6 位數、一次性、5 分鐘有效的驗證碼。
 * - `DevOTPProvider`：固定驗證碼，只在明確設定 `OTP_PROVIDER=dev` 且以
 *   `OTP_DEV_CODE` 提供驗證碼時才可用（本機手動測試用），repo 內不寫死任何值。
 * - 正式環境（NODE_ENV=production）拒絕使用上述兩者：真實簡訊 provider（FR-085，M2）
 *   上線前，正式環境不能用假 OTP 登入會員。
 *
 * 新增真實簡訊供應商時，實作 OTPProvider 並在 getOTPProvider() 加一個 case 即可。
 */

export interface OTPSendResult {
  /** Identifier returned by the upstream provider (e.g. an SMS message id). */
  providerMessageId?: string;
  /**
   * 開發／測試時給開發者看的驗證碼提示。真實簡訊 provider 不得設定此欄位；
   * auth 路由在 NODE_ENV=production 時也不會回傳它。
   */
  devHint?: string;
}

export interface OTPProvider {
  /** Send a one-time code to `phone`. The provider decides the code. */
  send(phone: string): Promise<OTPSendResult>;
  /** Verify that `code` matches the most-recent code sent to `phone`. */
  verify(phone: string, code: string): Promise<boolean>;
}

/** 固定驗證碼的最短長度（避免設定成 1234 這類容易猜的短碼）。 */
export const DEV_CODE_MIN_LENGTH = 6;

/**
 * 固定驗證碼 provider（只供本機手動測試）。驗證碼由建構子傳入，沒有預設值。
 */
export class DevOTPProvider implements OTPProvider {
  private static warned = false;

  constructor(private readonly code: string) {
    if (!/^\d+$/.test(code) || code.length < DEV_CODE_MIN_LENGTH) {
      throw new Error(`[OTP] DevOTPProvider code must be at least ${DEV_CODE_MIN_LENGTH} digits`);
    }
  }

  private warnOnce(): void {
    if (DevOTPProvider.warned) return;
    DevOTPProvider.warned = true;
    // eslint-disable-next-line no-console
    console.warn('[OTP] DevOTPProvider is in use — NOT FOR PRODUCTION');
  }

  async send(_phone: string): Promise<OTPSendResult> {
    this.warnOnce();
    return { devHint: this.code };
  }

  async verify(_phone: string, code: string): Promise<boolean> {
    this.warnOnce();
    return code === this.code;
  }
}

interface MockOTPEntry {
  code: string;
  expiresAt: number;
}

/**
 * 記憶體內的一次性驗證碼 provider（預設）。
 *
 * 不適合正式環境：重啟即失效、沒有發送頻率限制，也沒有真的寄簡訊。
 */
export class MockOTPProvider implements OTPProvider {
  static readonly CODE_LENGTH = 6;
  static readonly TTL_MS = 5 * 60 * 1000;

  private store = new Map<string, MockOTPEntry>();

  private generateCode(): string {
    const max = 10 ** MockOTPProvider.CODE_LENGTH;
    const n = Math.floor(Math.random() * max);
    return n.toString().padStart(MockOTPProvider.CODE_LENGTH, '0');
  }

  async send(phone: string): Promise<OTPSendResult> {
    const code = this.generateCode();
    this.store.set(phone, {
      code,
      expiresAt: Date.now() + MockOTPProvider.TTL_MS,
    });
    return { devHint: code };
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const entry = this.store.get(phone);
    if (!entry) return false;
    // One-time: remove on access regardless of outcome so a guess attempt
    // also consumes the code (avoids brute-force replay).
    this.store.delete(phone);
    if (entry.expiresAt < Date.now()) return false;
    return entry.code === code;
  }
}

let cached: OTPProvider | null = null;

/**
 * 依環境變數 `OTP_PROVIDER` 取得 provider：
 *   - 未設定或 `mock` → MockOTPProvider（一次性隨機碼）
 *   - `dev` → DevOTPProvider，驗證碼取自 `OTP_DEV_CODE`（必填、至少 6 位數）
 * 其他值、或在 NODE_ENV=production 使用 dev／mock 時直接丟錯，讓錯誤設定在啟動時就失敗。
 */
export function getOTPProvider(): OTPProvider {
  if (cached) return cached;
  const choice = (process.env.OTP_PROVIDER ?? 'mock').toLowerCase();
  if ((choice === 'mock' || choice === 'dev') && process.env.NODE_ENV === 'production') {
    throw new Error(
      `[OTP] OTP_PROVIDER='${choice}' is not allowed in production. ` +
        'Configure a real SMS provider (FR-085) before enabling member login.',
    );
  }
  switch (choice) {
    case 'mock':
      cached = new MockOTPProvider();
      return cached;
    case 'dev': {
      const code = process.env.OTP_DEV_CODE;
      if (!code) {
        throw new Error('[OTP] OTP_PROVIDER=dev requires OTP_DEV_CODE (no built-in default code).');
      }
      cached = new DevOTPProvider(code);
      return cached;
    }
    default:
      throw new Error(
        `[OTP] Unknown OTP_PROVIDER='${choice}'. Supported: mock, dev. ` +
          `Add a new case here when introducing a real SMS provider.`,
      );
  }
}

/**
 * Test-only: forget the cached provider so the next `getOTPProvider()` call
 * re-reads the environment. Production code should never need this.
 */
export function __resetOTPProviderForTests(): void {
  cached = null;
}
