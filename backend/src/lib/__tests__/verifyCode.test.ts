import { describe, it, expect, beforeEach } from 'vitest';
import {
  DevOTPProvider,
  MockOTPProvider,
  getOTPProvider,
  __resetOTPProviderForTests,
  verifyCode,
  DEMO_VERIFY_CODE,
} from '../verifyCode.js';

describe('DevOTPProvider', () => {
  const provider = new DevOTPProvider();

  it('send() returns devHint=1234 for any phone', async () => {
    const result = await provider.send('0912345678');
    expect(result.devHint).toBe('1234');
  });

  it('verify() accepts 1234 and rejects other codes', async () => {
    expect(await provider.verify('0912345678', '1234')).toBe(true);
    expect(await provider.verify('0912345678', '0000')).toBe(false);
    expect(await provider.verify('0912345678', '')).toBe(false);
  });
});

describe('MockOTPProvider', () => {
  let provider: MockOTPProvider;

  beforeEach(() => {
    provider = new MockOTPProvider();
  });

  it('send() returns a 6-digit numeric devHint', async () => {
    const result = await provider.send('0912345678');
    expect(result.devHint).toMatch(/^\d{6}$/);
  });

  it('verify() accepts the code sent to the same phone exactly once', async () => {
    const { devHint } = await provider.send('0912345678');
    expect(devHint).toBeDefined();
    expect(await provider.verify('0912345678', devHint!)).toBe(true);
    // Second attempt with the same code must fail (one-time consumption).
    expect(await provider.verify('0912345678', devHint!)).toBe(false);
  });

  it('verify() rejects a different code', async () => {
    await provider.send('0912345678');
    expect(await provider.verify('0912345678', '000000')).toBe(false);
  });
});

describe('getOTPProvider()', () => {
  beforeEach(() => {
    __resetOTPProviderForTests();
    delete process.env.OTP_PROVIDER;
  });

  it('defaults to DevOTPProvider when OTP_PROVIDER is unset', () => {
    expect(getOTPProvider()).toBeInstanceOf(DevOTPProvider);
  });

  it('returns MockOTPProvider when OTP_PROVIDER=mock', () => {
    process.env.OTP_PROVIDER = 'mock';
    expect(getOTPProvider()).toBeInstanceOf(MockOTPProvider);
  });

  it('still returns DevOTPProvider for explicit OTP_PROVIDER=dev', () => {
    process.env.OTP_PROVIDER = 'dev';
    expect(getOTPProvider()).toBeInstanceOf(DevOTPProvider);
  });
});

describe('backwards-compatible helpers', () => {
  it('verifyCode accepts the demo code', () => {
    expect(verifyCode('1234')).toBe(true);
  });

  it('verifyCode rejects other codes', () => {
    expect(verifyCode('0000')).toBe(false);
  });

  it('DEMO_VERIFY_CODE remains "1234"', () => {
    expect(DEMO_VERIFY_CODE).toBe('1234');
  });
});
