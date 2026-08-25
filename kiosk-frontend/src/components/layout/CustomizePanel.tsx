/**
 * CustomizePanel — 底部客製化面板(展開式,固定底部,展開時佔底部 30% 高度)。
 * - 預設摺疊:只顯示標題 + 箭頭
 * - 展開:目前編輯的品項名稱 + 三群組 chips + 「完成客製 → 加入購物車」CTA
 */
import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useMenu } from '../../hooks/useMenu';
import { useCartStore, calcUnitPrice } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { CustomizationGroupView } from '../CustomizationGroup';
import type { MenuItem, CustomizationGroup } from '@smart-dining/contracts';

export function CustomizePanel() {
  const { allItems } = useMenu();
  const open = useUIStore((s) => s.customizePanelOpen);
  const toggle = useUIStore((s) => s.toggleCustomizePanel);
  const close = useUIStore((s) => s.closeCustomizePanel);

  const editingMenuItemId = useCartStore((s) => s.editingMenuItemId);
  const pendingSelections = useCartStore((s) => s.pendingSelections);
  const setSelection = useCartStore((s) => s.setSelection);
  const confirmPending = useCartStore((s) => s.confirmPending);
  const cancelPending = useCartStore((s) => s.cancelPending);

  const editingItem: (MenuItem & { customizationGroups: CustomizationGroup[] }) | undefined =
    useMemo(() => {
      if (!editingMenuItemId) return undefined;
      const it = allItems.find((x) => x.id === editingMenuItemId);
      if (!it) return undefined;
      return it as MenuItem & { customizationGroups: CustomizationGroup[] };
    }, [editingMenuItemId, allItems]);

  // 自動開啟/關閉:有 editingItem 時自動展開,反之摺疊
  useEffect(() => {
    if (editingMenuItemId && !open) {
      useUIStore.getState().openCustomizePanel();
    }
    if (!editingMenuItemId && open) {
      useUIStore.getState().closeCustomizePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMenuItemId]);

  function handleConfirm() {
    if (!editingItem) return;
    confirmPending(editingItem);
  }

  const previewPrice = useMemo(() => {
    if (!editingItem) return 0;
    return calcUnitPrice(
      editingItem.basePrice,
      pendingSelections,
      editingItem.customizationGroups ?? [],
    );
  }, [editingItem, pendingSelections]);

  return (
    <section
      className={clsx(
        'absolute left-0 right-0 bottom-0 z-30 bg-white shadow-[0_-4px_30px_rgba(0,0,0,0.12)] border-t border-gray-200 transition-all duration-300 ease-out',
        open && editingItem ? 'h-[30%] min-h-[280px]' : 'h-[56px]',
      )}
      aria-label="客製化面板"
    >
      {/* 標題列(永遠可見) */}
      <button
        type="button"
        onClick={toggle}
        className={clsx(
          'w-full h-[56px] px-6 flex items-center justify-between btn-press',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
          open && editingItem ? 'border-b border-gray-100' : '',
        )}
        aria-expanded={open && !!editingItem}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl" aria-hidden="true">
            🛠️
          </span>
          <span className="font-black text-kiosk-base text-gray-900">客製化選項</span>
          {editingItem && (
            <span className="font-bold text-kiosk-sm text-primary truncate">
              · {editingItem.name}
            </span>
          )}
          {!editingItem && (
            <span className="text-kiosk-sm text-gray-400">
              · 點上方品項的 + 自訂
            </span>
          )}
        </div>
        <span
          className={clsx(
            'text-2xl transition-transform',
            open && editingItem ? 'rotate-180' : '',
          )}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* 展開內容 */}
      {open && editingItem && (
        <div className="absolute inset-x-0 top-[56px] bottom-0 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto">
            {editingItem.customizationGroups.length === 0 ? (
              <p className="text-gray-500">此品項無客製化選項</p>
            ) : (
              <>
                {editingItem.customizationGroups.map((g) => (
                  <CustomizationGroupView
                    key={g.id}
                    group={g}
                    selected={pendingSelections[g.id] ?? []}
                    onChange={setSelection}
                  />
                ))}
              </>
            )}
            <div className="sticky bottom-0 -mx-6 -mb-4 px-6 pt-3 pb-4 bg-white border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  cancelPending();
                  close();
                }}
                className="flex-shrink-0 h-[60px] px-6 rounded-2xl bg-gray-100 text-gray-800 font-black text-kiosk-base btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 h-[60px] rounded-2xl bg-primary text-white font-black text-kiosk-lg btn-press hover:bg-primary-600 active:bg-primary-700 shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              >
                完成客製 → 加入購物車 · ${previewPrice.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
