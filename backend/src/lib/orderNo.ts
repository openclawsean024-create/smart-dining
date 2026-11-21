import type { Prisma, PrismaClient } from '@prisma/client';
import { taipeiDay } from './taipeiTime.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const ORDER_NO_PREFIX = 'SD';

/** 訂單號前綴：SD-<台灣日期 YYYYMMDD>-。 */
export function orderNoPrefix(now: Date = new Date()): string {
  return `${ORDER_NO_PREFIX}-${taipeiDay(now).dateKey}-`;
}

/**
 * 產生訂單號 SD-YYYYMMDD-NNNN（AC-003）。
 * 日期為台灣時區（Asia/Taipei）；流水號取「同一台灣日」既有訂單號的最大值＋1，
 * 每次呼叫即時計算，跨日自動從 0001 開始。
 */
export async function generateOrderNo(db: Db, now: Date = new Date()): Promise<string> {
  const prefix = orderNoPrefix(now);
  const orders = await db.order.findMany({
    where: { orderNo: { startsWith: prefix } },
    select: { orderNo: true },
  });
  let max = 0;
  for (const o of orders) {
    const n = Number(o.orderNo.slice(prefix.length));
    if (Number.isInteger(n)) max = Math.max(max, n);
  }
  return prefix + String(max + 1).padStart(4, '0');
}
