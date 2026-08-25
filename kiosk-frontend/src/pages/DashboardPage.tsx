/**
 * DashboardPage — 三欄式 Dashboard(/)
 * - 左:140px Sidebar
 * - 中:菜單區
 * - 右:220px CartSidebar
 * - 底部(絕對定位):CustomizePanel(展開式)
 * - 中間覆蓋:CheckoutModal / PickupModal
 */
import { useMemo } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { CartSidebar } from '../components/layout/CartSidebar';
import { CustomizePanel } from '../components/layout/CustomizePanel';
import { MenuItemCard } from '../components/MenuItemCard';
import { MenuItemSmallCard } from '../components/MenuItemSmallCard';
import { useMenu, type FlatItem } from '../hooks/useMenu';
import { useCartStore } from '../store/cartStore';
import { useUIStore, SIDEBAR_CATEGORIES } from '../store/uiStore';
import type { Category } from '@smart-dining/contracts';

/** 是否是「推薦 / 人氣」標籤(以 tag 字串包含特定關鍵字判斷)。 */
function matchesTags(item: FlatItem, keywords: string[]): boolean {
  if (!item.tags) return false;
  const set = new Set(
    item.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  return keywords.some((k) => set.has(k));
}

function pickFeatured(allItems: FlatItem[], keywords: string[]): FlatItem[] {
  const tagged = allItems.filter((it) => it.available && matchesTags(it, keywords));
  return tagged.length > 0 ? tagged : allItems.filter((it) => it.available).slice(0, 6);
}

export function DashboardPage() {
  const { categories, itemsByCategory, allItems, isLoading, error } = useMenu();
  const activeCategory = useUIStore((s) => s.activeCategory);
  const startEditing = useCartStore((s) => s.startEditing);
  const addLine = useCartStore((s) => s.addLine);

  // 為後端 category 建立 fallback 名稱對應(若 backendCategoryId 命中直接回傳,否則比對 name)
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const headerTitle = useMemo(() => {
    const meta = SIDEBAR_CATEGORIES.find((c) => c.id === activeCategory);
    if (!meta) return '推薦餐點';
    if (meta.backendCategoryId) {
      const c = categoryById.get(meta.backendCategoryId);
      if (c) return c.name;
      // fallback:以名稱模糊比對
      const found = categories.find(
        (c) =>
          c.name.includes(meta.name) ||
          ['主餐', '配餐', '飲品', '甜點'].some((kw) =>
            c.name.includes(kw) && meta.name.includes(kw),
          ),
      );
      return found?.name ?? meta.name;
    }
    return meta.name;
  }, [activeCategory, categoryById, categories]);

  // 目前分類的菜單
  const currentItems: FlatItem[] = useMemo(() => {
    const meta = SIDEBAR_CATEGORIES.find((c) => c.id === activeCategory);
    if (!meta) return [];
    const available = allItems.filter((it) => it.available);
    if (activeCategory === 'recommended') {
      return pickFeatured(available, ['recommended', '招牌', 'new', 'editor']);
    }
    if (activeCategory === 'popular') {
      return pickFeatured(available, ['popular', 'hot', 'best']);
    }
    if (activeCategory === 'member') {
      return available;
    }
    // 真實分類
    if (meta.backendCategoryId && itemsByCategory[meta.backendCategoryId]) {
      return itemsByCategory[meta.backendCategoryId].filter((it) => it.available);
    }
    // fallback:用 name 模糊比對
    const fuzzy = categories.find((c) => c.name.includes(meta.name));
    if (fuzzy && itemsByCategory[fuzzy.id]) {
      return itemsByCategory[fuzzy.id].filter((it) => it.available);
    }
    return available;
  }, [activeCategory, allItems, itemsByCategory, categories]);

  const bigCards = currentItems.slice(0, 3);
  const smallCards = currentItems.slice(3, 7);

  function handleAdd(item: FlatItem) {
    addLine({ menuItem: item, quantity: 1, customizations: {} });
  }
  function handleCustomize(item: FlatItem) {
    startEditing(item.id);
  }

  return (
    <div className="h-screen w-screen flex bg-gray-50 overflow-hidden">
      <Sidebar />

      {/* 中央菜單區 */}
      <main className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl shadow">
              餐
            </div>
            <span className="font-black text-2xl text-gray-900">餐飲點餐快手</span>
          </div>
          <button
            type="button"
            onClick={() => window.open('https://example.com', '_blank')}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 btn-press"
            aria-label="購物車捷徑"
          >
            <span className="text-xl" aria-hidden="true">🛒</span>
            <span className="font-bold text-gray-700">購物車</span>
          </button>
        </header>

        {/* 內容區:標題 + 大卡 + 小卡 */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* 標題列 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-black text-kiosk-2xl text-gray-900">
              {headerTitle}
            </h1>
            <button
              type="button"
              className="font-bold text-kiosk-sm text-primary underline btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 rounded-lg px-3 py-1"
              onClick={() => {
                /* 純示範按鈕:demo 版不展開,後續接查全部頁 */
              }}
            >
              查看全部 →
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-700 font-bold">
              菜單載入失敗,請聯絡店員。
            </div>
          )}
          {isLoading && (
            <div className="text-center text-kiosk-base text-gray-500 py-12">
              載入菜單中…
            </div>
          )}

          {!isLoading && bigCards.length === 0 && (
            <div className="text-center text-kiosk-base text-gray-400 py-12">
              此分類尚無品項
            </div>
          )}

          {/* 大卡 3 欄 */}
          {bigCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {bigCards.map((it) => (
                <MenuItemCard
                  key={it.id}
                  item={it}
                  onAdd={handleAdd}
                  onCustomize={handleCustomize}
                />
              ))}
            </div>
          )}

          {/* 小卡 4 欄 */}
          {smallCards.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {smallCards.map((it) => (
                <MenuItemSmallCard
                  key={it.id}
                  item={it}
                  onAdd={handleAdd}
                  onCustomize={handleCustomize}
                />
              ))}
            </div>
          )}

          {/* 為 CustomizePanel 預留底部空間 */}
          <div className="h-24" />
        </div>

        {/* 底部 CustomizePanel(絕對定位) */}
        <CustomizePanel />
      </main>

      <CartSidebar />
    </div>
  );
}
