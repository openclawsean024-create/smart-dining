import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomInt } from 'node:crypto';
import {
  DevOTPProvider,
  MockOTPProvider,
  getOTPProvider,
  __resetOTPProviderForTests,
} from '../verifyCode.js';

/** 每次執行隨機產生的 8 位數驗證碼（repo 內不寫死任何驗證碼）。 */
const randomCode = () => String(randomInt(10_000_000, 99_999_999));

describe('DevOTPProvider', () => {
  const code = randomCode();
  const provider = new DevOTPProvider(code);

  it('send() returns the configured code as devHint for any phone', async () => {
    const result = await provider.send('0900000001');
    expect(result.devHint).toBe(code);
  });

  it('verify() accepts the configured code and rejects other codes', async () => {
    expect(await provider.verify('0900000001', code)).toBe(true);
    expect(await provider.verify('0900000001', '0000')).toBe(false);
    expect(await provider.verify('0900000001', '')).toBe(false);
  });
});

describe('MockOTPProvider', () => {
  let provider: MockOTPProvider;

  beforeEach(() => {
    provider = new MockOTPProvider();
  });

  it('send() returns a 6-digit numeric devHint', async () => {
    const result = await provider.send('0900000001');
    expect(result.devHint).toMatch(/^\d{6}$/);
  });

  it('verify() accepts the code sent to the same phone exactly once', async () => {
    const { devHint } = await provider.send('0900000001');
    expect(devHint).toBeDefined();
    expect(await provider.verify('0900000001', devHint!)).toBe(true);
    // Second attempt with the same code must fail (one-time consumption).
    expect(await provider.verify('0900000001', devHint!)).toBe(false);
  });

  it('verify() rejects a different code', async () => {
    await provider.send('0900000001');
    expect(await provider.verify('0900000001', '000000')).toBe(false);
  });
});

describe('getOTPProvider()', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    __resetOTPProviderForTests();
    delete process.env.OTP_PROVIDER;
    delete process.env.OTP_DEV_CODE;
  });

  afterEach(() => {
    process.env = { ...saved };
    __resetOTPProviderForTests();
  });

  // AC-011：預設不再是固定碼的 DevOTPProvider（原斷言 "defaults to DevOTPProvider" 依規格變更改寫）
  it('AC-011 defaults to the one-time MockOTPProvider when OTP_PROVIDER is unset', () => {
    expect(getOTPProvider()).toBeInstanceOf(MockOTPProvider);
  });

  it('returns MockOTPProvider when OTP_PROVIDER=mock', () => {
    process.env.OTP_PROVIDER = 'mock';
    expect(getOTPProvider()).toBeInstanceOf(MockOTPProvider);
  });

  it('still returns DevOTPProvider for explicit OTP_PROVIDER=dev with OTP_DEV_CODE', () => {
    process.env.OTP_PROVIDER = 'dev';
    process.env.OTP_DEV_CODE = randomCode();
    expect(getOTPProvider()).toBeInstanceOf(DevOTPProvider);
  });

  it('AC-011 OTP_PROVIDER=dev without OTP_DEV_CODE throws (no built-in default code)', () => {
    process.env.OTP_PROVIDER = 'dev';
    expect(() => getOTPProvider()).toThrow(/OTP_DEV_CODE/);
  });

  it('AC-011 refuses dev and mock providers in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.OTP_PROVIDER = 'mock';
    expect(() => getOTPProvider()).toThrow(/not allowed in production/);
    __resetOTPProviderForTests();
    process.env.OTP_PROVIDER = 'dev';
    process.env.OTP_DEV_CODE = randomCode();
    expect(() => getOTPProvider()).toThrow(/not allowed in production/);
  });

  it('rejects unknown providers', () => {
    process.env.OTP_PROVIDER = 'sms-from-nowhere';
    expect(() => getOTPProvider()).toThrow(/Unknown OTP_PROVIDER/);
  });
});

// AC-011：原本的 "backwards-compatible helpers" 三個 case 斷言固定碼 '1234' 可以通過；
// GOAL AC-011 要求移除 1234 這類明碼預設值，因此改寫為斷言它不再可用。
describe('AC-011 no fixed demo code', () => {
  it('AC-011 the default provider rejects 1234', async () => {
    __resetOTPProviderForTests();
    const provider = getOTPProvider();
    await provider.send('0900000001');
    expect(await provider.verify('0900000001', '1234')).toBe(false);
  });

  it('AC-011 DevOTPProvider refuses short or non-numeric codes such as 1234', () => {
    expect(() => new DevOTPProvider('1234')).toThrow(/at least 6 digits/);
    expect(() => new DevOTPProvider('abcdef')).toThrow();
  });

  it('AC-011 the module no longer exports a demo code or the legacy verifyCode helper', async () => {
    const mod = await import('../verifyCode.js');
    expect(mod).not.toHaveProperty('DEMO_VERIFY_CODE');
    expect(mod).not.toHaveProperty('verifyCode');
  });
});
