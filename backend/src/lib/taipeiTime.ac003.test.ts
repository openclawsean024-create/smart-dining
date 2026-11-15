/**
 * AC-003：台灣時區的營業日計算（純函式）。
 */
import { describe, expect, it } from 'vitest';
import { taipeiDay } from './taipeiTime.js';
import { orderNoPrefix } from './orderNo.js';

describe('AC-003 taipeiDay', () => {
  it('AC-003 台灣時間 23:59 仍是當天', () => {
    const d = taipeiDay(new Date('2026-03-10T15:59:00Z')); // 台灣 03/10 23:59
    expect(d.dateKey).toBe('20260310');
    expect(d.start.toISOString()).toBe('2026-03-09T16:00:00.000Z');
    expect(d.end.toISOString()).toBe('2026-03-10T16:00:00.000Z');
  });

  it('AC-003 台灣時間 00:00 整就是新的一天', () => {
    expect(taipeiDay(new Date('2026-03-10T16:00:00Z')).dateKey).toBe('20260311');
    expect(taipeiDay(new Date('2026-03-10T15:59:59.999Z')).dateKey).toBe('20260310');
  });

  it('AC-003 台灣時間 07:59（UTC 還在前一天）用台灣日期', () => {
    const now = new Date('2026-03-10T23:59:00Z'); // 台灣 03/11 07:59
    expect(now.toISOString().slice(0, 10)).toBe('2026-03-10'); // UTC 日期是前一天
    expect(taipeiDay(now).dateKey).toBe('20260311');
    expect(orderNoPrefix(now)).toBe('SD-20260311-');
  });

  it('AC-003 跨月、跨年也正確', () => {
    expect(taipeiDay(new Date('2026-01-31T16:30:00Z')).dateKey).toBe('20260201');
    expect(taipeiDay(new Date('2026-12-31T16:00:00Z')).dateKey).toBe('20270101');
    expect(taipeiDay(new Date('2028-02-28T16:00:00Z')).dateKey).toBe('20280229'); // 閏年
  });

  it('AC-003 每個營業日恰好 24 小時，且包含傳入的時間點', () => {
    for (const iso of ['2026-03-10T15:59:00Z', '2026-03-10T16:00:00Z', '2026-07-01T03:21:00Z']) {
      const now = new Date(iso);
      const d = taipeiDay(now);
      expect(d.end.getTime() - d.start.getTime()).toBe(86_400_000);
      expect(now.getTime()).toBeGreaterThanOrEqual(d.start.getTime());
      expect(now.getTime()).toBeLessThan(d.end.getTime());
    }
  });
});
