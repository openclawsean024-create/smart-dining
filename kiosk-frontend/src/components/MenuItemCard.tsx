/**
 * MenuItemCard — 大卡(200×140 圖、名、價、+)。
 * 用於 Dashboard 中央菜單區「第一列」三張大卡。
 */
import clsx from 'clsx';
import type { FlatItem } from '../hooks/useMenu';

interface MenuItemCardProps {
  item: FlatItem;
  /** 加入購物車回呼(已含合併邏輯於 cartStore) */
  onAdd?: (item: FlatItem) => void;
  /** 開啟客製化面板回呼(用於 Dashboard 流程) */
  onCustomize?: (item: FlatItem) => void;
}

const PLACEHOLDER_EMOJI: Record<string, string> = {
  招牌: '🍗',
  套餐: '🍱',
  飲料: '🥤',
  甜點: '🍰',
  主餐: '🍚',
  配餐: '🍟',
  早餐: '🥐',
  沙拉: '🥗',
  湯: '🍲',
  牛肉: '🍔',
  雞: '🍗',
  椒麻: '🌶️',
  塔香: '🌿',
};

function pickEmoji(name: string, categoryName: string): string {
  for (const k of Object.keys(PLACEHOLDER_EMOJI)) {
    if (name.includes(k) || categoryName.includes(k)) return PLACEHOLDER_EMOJI[k]!;
  }
  return '🍽️';
}

export function MenuItemCard({ item, onAdd, onCustomize }: MenuItemCardProps) {
  const hasCustomizations =
    item.customizationGroups && item.customizationGroups.length > 0;
  const unavailable = !item.available;

  function handleClick() {
    if (unavailable) return;
    if (hasCustomizations) {
      onCustomize?.(item);
    } else {
      onAdd?.(item);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={unavailable}
      className={clsx(
        'group h-full w-full text-left bg-white rounded-2xl shadow-sm border-2 overflow-hidden flex flex-col transition-all btn-press',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
        unavailable
          ? 'border-gray-200 opacity-60 cursor-not-allowed'
          : 'border-gray-100 hover:border-primary hover:shadow-md',
      )}
    >
      {/* 圖 200 × 140 */}
      <div className="relative w-full h-[140px] bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-7xl" aria-hidden="true">
            {pickEmoji(item.name, item.categoryName)}
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-black text-kiosk-lg text-gray-900 line-clamp-2 leading-tight">
          {item.name}
        </h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="font-black text-kiosk-2xl text-primary leading-none">
            ${item.basePrice.toLocaleString()}
          </span>
          <span
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white text-2xl font-black transition-transform group-active:scale-95"
            aria-hidden="true"
          >
            +
          </span>
        </div>
      </div>
    </button>
  );
}
