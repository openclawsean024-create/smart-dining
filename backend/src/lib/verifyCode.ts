/**
 * OTP Provider abstraction for the smart-dining backend.
 *
 * The legacy implementation hardcoded `'1234'` for every phone number.
 * That was fine for a single-store demo, but it cannot ship to production:
 *   - No real SMS delivery.
 *   - One universal code is a security hole (anyone who knows it can sign in
 *     as anyone).
 *
 * This module defines an `OTPProvider` interface that the auth routes depend
 * on, plus a development-only implementation (`DevOTPProvider`) that preserves
 * the demo behaviour for local hacking, and a `MockOTPProvider` that does an
 * in-memory one-time-code flow useful for staging and tests.
 *
 * Adding Twilio / Every8d / 三竹資訊 later means writing one more class that
 * satisfies the interface and adding a `case` in `getOTPProvider()`. No
 * auth-route changes required.
 */

export interface OTPSendResult {
  /** Identifier returned by the upstream provider (e.g. Twilio SID). */
  providerMessageId?: string;
  /**
   * Short hint shown to the developer in dev/mock mode. NEVER trust this
   * in production — real SMS providers must NOT set this.
   */
  devHint?: string;
}

export interface OTPProvider {
  /** Send a one-time code to `phone`. The provider decides the code. */
  send(phone: string): Promise<OTPSendResult>;
  /** Verify that `code` matches the most-recent code sent to `phone`. */
  verify(phone: string, code: string): Promise<boolean>;
}

/**
 * Development-only provider. Always issues the same code (`'1234'`) so the
 * demo flow stays runnable without SMS infrastructure.
 *
 * Loudly warns on first use — anyone seeing the warning in production logs
 * should know to swap providers before merging.
 */
export class DevOTPProvider implements OTPProvider {
  static readonly DEMO_CODE = '1234';
  private static warned = false;

  private warnOnce(): void {
    if (DevOTPProvider.warned) return;
    DevOTPProvider.warned = true;
    // eslint-disable-next-line no-console
    console.warn('[OTP] DevOTPProvider is in use — NOT FOR PRODUCTION');
  }

  async send(_phone: string): Promise<OTPSendResult> {
    this.warnOnce();
    return { devHint: DevOTPProvider.DEMO_CODE };
  }

  async verify(_phone: string, code: string): Promise<boolean> {
    this.warnOnce();
    return code === DevOTPProvider.DEMO_CODE;
  }
}

interface MockOTPEntry {
  code: string;
  expiresAt: number;
}

/**
 * In-memory provider used for tests and local demos that want to see real
 * 6-digit codes flow through the system without standing up SMS.
 *
 * Not for production: codes are lost on restart, there is no rate limiting,
 * and the store is unbounded.
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
 * Resolve the configured provider based on the `OTP_PROVIDER` environment
 * variable. Defaults to `DevOTPProvider` so the local demo flow keeps
 * working without configuration.
 *
 * Supported values:
 *   - `dev`  → DevOTPProvider (default)
 *   - `mock` → MockOTPProvider
 *
 * Any other value throws so a misconfigured production deploy fails fast
 * instead of silently sending codes to the demo provider.
 */
export function getOTPProvider(): OTPProvider {
  if (cached) return cached;
  const choice = (process.env.OTP_PROVIDER ?? 'dev').toLowerCase();
  switch (choice) {
    case 'dev':
      cached = new DevOTPProvider();
      return cached;
    case 'mock':
      cached = new MockOTPProvider();
      return cached;
    default:
      throw new Error(
        `[OTP] Unknown OTP_PROVIDER='${choice}'. Supported: dev, mock. ` +
          `Add a new case here when introducing a real SMS provider.`,
      );
  }
}

/**
 * Test-only: forget the cached provider so the next `getOTPProvider()` call
 * re-reads `process.env.OTP_PROVIDER`. Production code should never need this.
 */
export function __resetOTPProviderForTests(): void {
  cached = null;
}

/**
 * Backwards-compatible helper for callers that still ask "is this code the
 * demo code?". Internally stateless — safe to call without going through the
 * provider cache.
 *
 * @deprecated Call `getOTPProvider().verify(phone, code)` from the auth
 * routes instead. Kept exported only so older imports keep compiling.
 */
export function verifyCode(code: string): boolean {
  return code === DevOTPProvider.DEMO_CODE;
}

export const DEMO_VERIFY_CODE = DevOTPProvider.DEMO_CODE;
