/**
 * AC-003／AC-005：建單交易依序執行（避免 SQLite 寫入鎖競爭造成並行下單 500）。
 */
import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serialQueue.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('AC-003 createSerialQueue', () => {
  it('AC-003 同時排入的工作依序執行，不會重疊', async () => {
    const enqueue = createSerialQueue();
    const log: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const task = (name: string, ms: number) => async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      log.push('start ' + name);
      await sleep(ms);
      log.push('end ' + name);
      running -= 1;
      return name;
    };
    const results = await Promise.all([enqueue(task('a', 30)), enqueue(task('b', 5)), enqueue(task('c', 10))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(maxRunning).toBe(1);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('AC-003 前一個工作失敗時，錯誤回給它自己，後面的工作照常執行', async () => {
    const enqueue = createSerialQueue();
    const failing = enqueue(async () => {
      throw new Error('boom');
    });
    const next = enqueue(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});
