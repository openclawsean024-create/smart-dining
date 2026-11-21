/**
 * 訂單的 API 輸出格式。
 *
 * OrderItem.customizations 在資料庫是 JSON 字串；對外一律轉成陣列
 * （shared-contracts 的 CartCustomizationSelection[]），KDS、手機追蹤頁可直接使用。
 * statusLogs 另外以契約上的名稱 statusLog 提供。
 */
import type { CartCustomizationSelection } from '../../../shared-contracts/src/index.js';

interface RawItem {
  customizations: string;
  [key: string]: unknown;
}

interface RawOrder {
  items?: RawItem[];
  statusLogs?: unknown[];
  [key: string]: unknown;
}

/** 解析客製化 JSON；容忍舊資料（{ groupName, choice }）與壞資料（回傳空陣列）。 */
export function parseCustomizations(raw: unknown): CartCustomizationSelection[] {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const result: CartCustomizationSelection[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const choiceNames = strings(e.choiceNames);
    if (choiceNames.length === 0 && typeof e.choice === 'string') choiceNames.push(e.choice);
    result.push({
      groupId: typeof e.groupId === 'string' ? e.groupId : '',
      groupName: typeof e.groupName === 'string' ? e.groupName : '',
      choiceIds: strings(e.choiceIds),
      choiceNames,
    });
  }
  return result;
}

export function serializeOrder<T extends RawOrder>(order: T) {
  const { items, statusLogs, ...rest } = order;
  return {
    ...rest,
    ...(items ? { items: items.map((it) => ({ ...it, customizations: parseCustomizations(it.customizations) })) } : {}),
    ...(statusLogs ? { statusLogs, statusLog: statusLogs } : {}),
  };
}
