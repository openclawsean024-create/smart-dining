/**
 * CartSidebar — 右側購物車(220px 寬)。
 * - 標題「我的餐點」+ 清空 icon
 * - 品項清單
 * - 底部固定區塊:小計 + 「前往結帳」CTA
 */
import clsx from 'clsx';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import type { CartLine } from '../../types';

function summarize(line: CartLine): string {
  const parts: string[] = [];
  for (const [gid, ids] of Object.entries(line.customizations)) {
    if (!ids || ids.length === 0) continue;
    const group = line.customizationGroups.find((g) => g.id === gid);
    if (!group) continue;
    const names = ids
      .map((cid) => group.choices.find((c) => c.id === cid)?.name)
      .filter(Boolean);
    if (names.length) parts.push(names.join('・'));
  }
  return parts.join(' · ');
}

export function CartSidebar() {
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const itemCount = useCartStore((s) => s.getItemCount());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const clear = useCartStore((s) => s.clear);
  const openCheckoutModal = useUIStore((s) => s.openCheckoutModal);

  return (
    <aside
      className="w-[220px] flex-shrink-0 h-full bg-white border-l border-gray-200 flex flex-col shadow-sm"
      aria-label="我的餐點"
    >
      {/* 標題列 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-black text-kiosk-base text-gray-900">我的餐點</h2>
        <button
          type="button"
          onClick={() => {
            if (lines.length === 0) return;
            if (confirm('確認清空所有品項?')) clear();
          }}
          className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 btn-press disabled:opacity-30"
          aria-label="清空購物車"
          title="清空購物車"
          disabled={lines.length === 0}
        >
          🗑️
        </button>
      </div>

      {/* 品項清單 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-2">
            <div className="text-5xl mb-2" aria-hidden="true">
              🍽️
            </div>
            <p className="font-bold text-kiosk-sm">尚未選擇餐點</p>
          </div>
        ) : (
          lines.map((line) => {
            const summary = summarize(line);
            return (
              <div
                key={line.lineId}
                className="bg-gray-50 rounded-xl p-2 flex gap-2 items-start border border-gray-100"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center text-2xl overflow-hidden">
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt={line.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">🍽️</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-kiosk-sm text-gray-900 truncate">
                    {line.name}
                  </h3>
                  {summary && (
                    <p className="text-xs text-gray-500 line-clamp-1">{summary}</p>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-black text-kiosk-sm text-primary">
                      ${(line.unitPrice * line.quantity).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, -1)}
                        className={clsx(
                          'w-7 h-7 rounded-md font-black text-lg btn-press',
                          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                          line.quantity <= 1
                            ? 'bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600'
                            : 'bg-gray-200 text-gray-800',
                        )}
                        aria-label={
                          line.quantity <= 1
                            ? '移除 ' + line.name
                            : '減少 ' + line.name
                        }
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-black text-kiosk-sm">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, 1)}
                        className="w-7 h-7 rounded-md bg-primary text-white font-black text-lg btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
                        aria-label={'增加 ' + line.name}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    className="mt-1 text-xs text-gray-400 hover:text-red-500 font-bold underline btn-press"
                  >
                    移除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部固定區塊 */}
      <div className="border-t border-gray-100 p-3 bg-white">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-kiosk-sm text-gray-500 font-medium">
            小計{itemCount > 0 && ` · ${itemCount} 項`}
          </span>
          <span className="font-black text-kiosk-2xl text-primary">
            ${subtotal.toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          disabled={lines.length === 0}
          onClick={openCheckoutModal}
          className="w-full h-[64px] rounded-2xl bg-gray-900 text-white font-black text-kiosk-lg btn-press hover:bg-gray-800 active:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        >
          前往結帳 →
        </button>
      </div>
    </aside>
  );
}
