/**
 * CustomizationGroup — chip 風格(SINGLE 為 radio 樣式、MULTI 為 checkbox 樣式)。
 * 用於 Dashboard 底部客製化面板。
 */
import clsx from 'clsx';
import type { CustomizationGroup as Group } from '@smart-dining/contracts';

interface CustomizationGroupViewProps {
  group: Group;
  /** 已選的 choice ids */
  selected: string[];
  /** 變更回呼 */
  onChange: (groupId: string, choiceIds: string[]) => void;
}

export function CustomizationGroupView({
  group,
  selected,
  onChange,
}: CustomizationGroupViewProps) {
  const isSingle = group.type === 'SINGLE';

  function toggle(choiceId: string) {
    if (!group.choices.find((c) => c.id === choiceId)?.available) return;
    if (isSingle) {
      onChange(group.id, [choiceId]);
      return;
    }
    const set = new Set(selected);
    if (set.has(choiceId)) set.delete(choiceId);
    else set.add(choiceId);
    onChange(group.id, Array.from(set));
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-black text-kiosk-base text-gray-900">{group.groupName}</h3>
        <span className="text-xs text-gray-500 font-bold">
          {isSingle ? '單選' : '可多選'}
        </span>
        {group.required && (
          <span className="px-2 py-0.5 rounded bg-primary text-white text-xs font-bold">
            必選
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.choices.map((c) => {
          const active = selected.includes(c.id);
          const disabled = !c.available;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(c.id)}
              className={clsx(
                'min-h-[40px] px-4 py-2 rounded-full text-kiosk-sm font-bold btn-press transition-colors',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                active
                  ? 'bg-gray-900 text-white border-2 border-gray-900'
                  : 'bg-gray-100 text-gray-700 border-2 border-gray-100 hover:bg-gray-200',
                disabled && 'opacity-40 line-through cursor-not-allowed',
              )}
              aria-pressed={active}
            >
              <span>{c.name}</span>
              {c.priceDelta !== 0 && (
                <span className={clsx('ml-2 text-sm', active ? 'text-white/80' : 'text-gray-500')}>
                  {c.priceDelta > 0 ? '+' : ''}NT$ {c.priceDelta}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
