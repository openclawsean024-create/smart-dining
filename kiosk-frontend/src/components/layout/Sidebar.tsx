/**
 * Sidebar — 左側導航(140px 寬)。
 * - 橘底 logo + 「餐飲快手」
 * - 7 個分類導航
 * - 底部「取餐進度」CTA
 */
import clsx from 'clsx';
import {
  SIDEBAR_CATEGORIES,
  useUIStore,
  type SidebarCategoryId,
} from '../../store/uiStore';

export function Sidebar() {
  const activeCategory = useUIStore((s) => s.activeCategory);
  const setActiveCategory = useUIStore((s) => s.setActiveCategory);
  const openPickupModal = useUIStore((s) => s.openPickupModal);
  const latestOrderNo = useUIStore((s) => s.latestOrderNo);

  function handleClick(id: SidebarCategoryId) {
    setActiveCategory(id);
  }

  return (
    <aside
      className="w-[140px] flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col shadow-sm"
      aria-label="分類導航"
    >
      {/* logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-100">
        <div
          className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow"
          aria-hidden="true"
        >
          餐
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-black text-gray-900 text-base">餐飲</span>
          <span className="font-black text-primary text-sm">快手</span>
        </div>
      </div>

      {/* 分類清單 */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {SIDEBAR_CATEGORIES.map((c) => {
          const active = c.id === activeCategory;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleClick(c.id)}
              className={clsx(
                'w-full flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl font-bold text-sm btn-press transition-colors',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                active
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'text-gray-700 hover:bg-primary-50',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-2xl" aria-hidden="true">
                {c.icon}
              </span>
              <span className="text-center leading-tight">{c.name}</span>
            </button>
          );
        })}
      </nav>

      {/* 取餐進度 CTA */}
      <div className="p-3 border-t border-gray-100">
        <button
          type="button"
          onClick={openPickupModal}
          className="w-full h-touch rounded-xl bg-secondary text-white font-black text-kiosk-base btn-press flex flex-col items-center justify-center gap-1 shadow hover:bg-secondary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-secondary/40"
          aria-label="查看取餐進度"
        >
          <span className="text-xl" aria-hidden="true">📍</span>
          <span>{latestOrderNo ? '查看進度' : '取餐進度'}</span>
        </button>
      </div>
    </aside>
  );
}
