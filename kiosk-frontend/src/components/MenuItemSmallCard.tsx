/**
 * MenuItemSmallCard — 小卡(80×80 圖、名、價),用於 Dashboard 第二列。
 */
import clsx from 'clsx';
import type { FlatItem } from '../hooks/useMenu';

interface MenuItemSmallCardProps {
  item: FlatItem;
  onAdd?: (item: FlatItem) => void;
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
};

function pickEmoji(name: string, categoryName: string): string {
  for (const k of Object.keys(PLACEHOLDER_EMOJI)) {
    if (name.includes(k) || categoryName.includes(k)) return PLACEHOLDER_EMOJI[k]!;
  }
  return '🍽️';
}

export function MenuItemSmallCard({ item, onAdd, onCustomize }: MenuItemSmallCardProps) {
  const hasCustomizations =
    item.customizationGroups && item.customizationGroups.length > 0;
  const unavailable = !item.available;

  function handleClick() {
    if (unavailable) return;
    if (hasCustomizations) onCustomize?.(item);
    else onAdd?.(item);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={unavailable}
      className={clsx(
        'group h-full w-full text-left bg-white rounded-xl shadow-sm border-2 overflow-hidden flex items-center gap-3 p-2 btn-press transition-all',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
        unavailable
          ? 'border-gray-200 opacity-60 cursor-not-allowed'
          : 'border-gray-100 hover:border-primary',
      )}
    >
      <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center text-3xl overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden="true">{pickEmoji(item.name, item.categoryName)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-black text-kiosk-base text-gray-900 truncate">{item.name}</h3>
        <span className="font-black text-kiosk-lg text-primary">
          ${item.basePrice.toLocaleString()}
        </span>
      </div>
      <span
        className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-lg font-black ml-auto"
        aria-hidden="true"
      >
        +
      </span>
    </button>
  );
}
