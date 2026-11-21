import type { Prisma, PrismaClient } from '@prisma/client';
import { taipeiDay } from './taipeiTime.js';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * 下一個取餐號（AC-003）：同一台灣日（Asia/Taipei）內由 1 遞增，
 * 每次呼叫即時計算當日範圍，跨日不需重啟服務。
 */
export async function nextPickupNumber(db: Db, now: Date = new Date()): Promise<number> {
  const { start, end } = taipeiDay(now);
  const result = await db.order.aggregate({
    where: { createdAt: { gte: start, lt: end } },
    _max: { pickupNumber: true },
  });
  return (result._max.pickupNumber ?? 0) + 1;
}
