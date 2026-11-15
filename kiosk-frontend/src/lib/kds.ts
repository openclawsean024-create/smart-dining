/**
 * KDS 用的純函式(改寫自 restaurant-kiosk `web/src/pages/KdsPage.tsx`;SPEC §12.1 #2)。
 * 原版是 localStorage＋中文 4 段狀態;這裡改接主 repo 的訂單模型與 7 段狀態機。
 */
import type { AdminOrder, CartCustomizationSelection, OrderStatus, StaffRole } from '@smart-dining/contracts';

/** KDS 上的狀態短標 */
export const KDS_STATUS_LABEL: Record<OrderStatus, string> = {
  QUEUED: '待製作',
  PREPARING: '準備中',
  COOKING: '製作中',
  PLATING: '盛盤中',
  READY: '可取餐',
  COMPLETED: '已取餐',
  CANCELLED: '已取消',
};

const NEXT_STAGE: Partial<Record<OrderStatus, OrderStatus>> = {
  QUEUED: 'PREPARING',
  PREPARING: 'COOKING',
  COOKING: 'PLATING',
  PLATING: 'READY',
};

/** 下一個製作階段;READY 之後沒有(改走「完成取餐」)。 */
export function nextKdsStage(status: OrderStatus): OrderStatus | null {
  return NEXT_STAGE[status] ?? null;
}

/** 取餐號顯示:A001 */
export function pickupLabel(pickupNumber: number): string {
  return 'A' + String(pickupNumber).padStart(3, '0');
}

/** 等待時間文字(與原版 KDS 相同的級距):剛剛／N 分鐘前／H 小時 M 分前 */
export function elapsedLabel(createdAtMs: number, nowMs: number): string {
  const min = Math.floor(Math.max(0, nowMs - createdAtMs) / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  return `${Math.floor(min / 60)} 小時 ${min % 60} 分前`;
}

/** 等待超過這個分鐘數就以警示色顯示 */
export const KDS_LATE_MINUTES = 10;

export function isLate(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs >= KDS_LATE_MINUTES * 60000;
}

/** 依等待時間排序:最舊的在最前面(同時間以訂單號排序,結果穩定)。 */
export function sortByWaiting<T extends Pick<AdminOrder, 'createdAt' | 'orderNo'>>(orders: readonly T[]): T[] {
  return [...orders].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.orderNo.localeCompare(b.orderNo),
  );
}

/** 客製化明細一行文字:白飯 / 辣油 / 薯條 */
export function customizationText(customizations: readonly CartCustomizationSelection[] | undefined): string {
  return (customizations ?? [])
    .flatMap((c) => c.choiceNames)
    .filter(Boolean)
    .join(' / ');
}

export type KdsAction =
  | { kind: 'advance'; label: string; enabled: boolean }
  | { kind: 'complete'; label: string; enabled: boolean };

/**
 * 一張訂單卡在目前角色下的按鈕(與後端的角色限制一致,AC-011):
 *   - 製作階段:店長、內場可推進
 *   - 可取餐:店長、收銀可按「完成取餐」;內場只能看
 */
export function kdsAction(status: OrderStatus, role: StaffRole): KdsAction {
  const next = nextKdsStage(status);
  if (next) {
    const enabled = role === 'MANAGER' || role === 'KITCHEN';
    return {
      kind: 'advance',
      enabled,
      label: enabled ? `推進 → ${KDS_STATUS_LABEL[next]}` : '僅內場／店長可推進',
    };
  }
  const enabled = role === 'MANAGER' || role === 'CASHIER';
  return { kind: 'complete', enabled, label: enabled ? '完成取餐' : '已可取餐,等待取餐' };
}
