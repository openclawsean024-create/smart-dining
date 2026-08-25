/**
 * cartStore — Zustand + persist(localStorage)
 *
 * 儲存:
 *   - lines: CartLine[]
 *   - appliedCoupon: SelectedCoupon | null
 *   - editingMenuItemId: 使用者在 Dashboard 客製化面板中「正在編輯」的 menuItemId
 *   - pendingSelections: 該 menuItem 暫存中的客製化選擇(groupId → choiceIds)
 *
 * 提供:
 *   - addLine / updateQuantity / removeLine
 *   - clear
 *   - subtotal / itemCount / setCoupon / clearCoupon
 *   - startEditing(menuItemId) / setSelection(groupId, choiceIds) / confirmPending() / cancelPending()
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartLine, AddToCartInput, SelectedCoupon } from '../types';

function genLineId(): string {
  return 'l_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 計算一個客製化選擇下的單價(basePrice + Σ priceDelta)。
 */
export function calcUnitPrice(
  basePrice: number,
  customizations: Record<string, string[]>,
  groups: import('@smart-dining/contracts').CustomizationGroup[],
): number {
  let price = basePrice;
  for (const g of groups) {
    const ids = customizations[g.id] ?? [];
    for (const choiceId of ids) {
      const choice = g.choices.find((c) => c.id === choiceId);
      if (choice && choice.available) {
        price += choice.priceDelta;
      }
    }
  }
  return Math.max(0, price);
}

interface CartState {
  lines: CartLine[];
  appliedCoupon: SelectedCoupon | null;
  /** Dashboard 客製化面板中,目前正在編輯的 menu item id(注意:這裡存 menuItem.id,而非 lineId) */
  editingMenuItemId: string | null;
  /** 與 editingMenuItemId 配對的暫存選擇 */
  pendingSelections: Record<string, string[]>;

  addLine: (input: AddToCartInput) => void;
  updateQuantity: (lineId: string, delta: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  setCoupon: (coupon: SelectedCoupon | null) => void;

  /** 進入「正在編輯」狀態;若 itemId 與目前不同,會清空 pendingSelections。 */
  startEditing: (menuItemId: string) => void;
  /** 暫存某群組的選擇 */
  setSelection: (groupId: string, choiceIds: string[]) => void;
  /** 把 pendingSelections 變成一個新的 CartLine 加入(lines) */
  confirmPending: (
    menuItem: import('@smart-dining/contracts').MenuItem & {
      customizationGroups?: import('@smart-dining/contracts').CustomizationGroup[];
    },
  ) => void;
  /** 取消編輯 */
  cancelPending: () => void;

  // selectors
  getSubtotal: () => number;
  getItemCount: () => number;
}

function keyOf(c: Record<string, string[]>): string {
  return Object.keys(c)
    .sort()
    .map((k) => k + ':' + [...(c[k] ?? [])].sort().join(','))
    .join('|');
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      appliedCoupon: null,
      editingMenuItemId: null,
      pendingSelections: {},

      addLine: (input) => {
        const { menuItem, quantity, customizations } = input;
        const groups = menuItem.customizationGroups ?? [];
        const unitPrice = calcUnitPrice(menuItem.basePrice, customizations, groups);

        const newKey = keyOf(customizations);
        const existing = get().lines.find(
          (l) => l.menuItemId === menuItem.id && keyOf(l.customizations) === newKey,
        );
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.lineId === existing.lineId ? { ...l, quantity: l.quantity + quantity } : l,
            ),
          });
          return;
        }

        const newLine: CartLine = {
          lineId: genLineId(),
          menuItemId: menuItem.id,
          name: menuItem.name,
          basePrice: menuItem.basePrice,
          imageUrl: menuItem.imageUrl ?? null,
          quantity,
          customizations,
          customizationGroups: groups,
          unitPrice,
        };
        set({ lines: [...get().lines, newLine] });
      },

      updateQuantity: (lineId, delta) => {
        set({
          lines: get()
            .lines.map((l) => {
              if (l.lineId !== lineId) return l;
              const next = l.quantity + delta;
              return next < 1 ? null : { ...l, quantity: next };
            })
            .filter((l): l is CartLine => l !== null),
        });
      },

      removeLine: (lineId) => {
        set({ lines: get().lines.filter((l) => l.lineId !== lineId) });
      },

      clear: () => {
        set({
          lines: [],
          appliedCoupon: null,
          editingMenuItemId: null,
          pendingSelections: {},
        });
      },

      setCoupon: (coupon) => set({ appliedCoupon: coupon }),

      startEditing: (menuItemId) => {
        const cur = get().editingMenuItemId;
        if (cur === menuItemId) return; // 已經在編輯這個,不重置
        set({ editingMenuItemId: menuItemId, pendingSelections: {} });
      },

      setSelection: (groupId, choiceIds) => {
        set((s) => ({
          pendingSelections: { ...s.pendingSelections, [groupId]: choiceIds },
        }));
      },

      confirmPending: (menuItem) => {
        const { pendingSelections } = get();
        const groups = menuItem.customizationGroups ?? [];
        // 若 all required groups 都沒選,允許加入(不擋),但若是空客製化會以 keyOf('{}') 與既有合併
        get().addLine({
          menuItem,
          quantity: 1,
          customizations: pendingSelections,
        });
        set({ editingMenuItemId: null, pendingSelections: {} });
      },

      cancelPending: () => {
        set({ editingMenuItemId: null, pendingSelections: {} });
      },

      getSubtotal: () => {
        return get()
          .lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
      },

      getItemCount: () => {
        return get().lines.reduce((sum, l) => sum + l.quantity, 0);
      },
    }),
    {
      name: 'kiosk-cart-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lines: state.lines,
        appliedCoupon: state.appliedCoupon,
        // 不持久化 editingMenuItemId / pendingSelections(暫存性質)
      }),
      version: 1,
    },
  ),
);

/**
 * 計算折扣(由前端做最簡試算,最終以伺服器回傳為準)。
 */
export function computeDiscount(
  subtotal: number,
  coupon: SelectedCoupon | null,
): number {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.type === 'PERCENTAGE') {
    const v = Math.max(0, Math.min(100, coupon.value));
    return Math.round(subtotal * (v / 100));
  }
  return Math.max(0, Math.min(subtotal, coupon.value));
}
