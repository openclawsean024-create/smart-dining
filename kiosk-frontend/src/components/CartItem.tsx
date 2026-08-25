import { useCartStore } from '../store/cartStore';
import type { CartLine } from '../types';

interface CartItemRowProps {
  line: CartLine;
}

function summarize(line: CartLine): string {
  const groups = line.customizationGroups;
  const parts: string[] = [];
  for (const [gid, ids] of Object.entries(line.customizations)) {
    if (!ids || ids.length === 0) continue;
    const group = groups.find((g) => g.id === gid);
    if (!group) continue;
    const names = ids
      .map((cid) => group.choices.find((c) => c.id === cid)?.name)
      .filter(Boolean);
    if (names.length) parts.push(group.groupName + ': ' + names.join('、'));
  }
  return parts.join(' · ');
}

export function CartItemRow({ line }: CartItemRowProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const summary = summarize(line);
  const subtotal = line.unitPrice * line.quantity;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex gap-4 items-start">
      <div className="w-20 h-20 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center text-4xl overflow-hidden">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt={line.name} className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden="true">🍽️</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-black text-kiosk-lg text-gray-900 truncate">{line.name}</h4>
        {summary && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{summary}</p>
        )}
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-gray-700 font-bold">
            NT$ {line.unitPrice.toLocaleString()}
            <span className="text-gray-400 font-normal text-sm"> / 份</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateQuantity(line.lineId, -1)}
              className="w-12 h-12 rounded-xl bg-gray-100 active:bg-gray-200 font-black text-2xl btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              aria-label={'減少 ' + line.name}
            >
              −
            </button>
            <span
              className="w-12 text-center font-black text-kiosk-xl text-gray-900"
              aria-label={'數量 ' + line.quantity}
            >
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(line.lineId, 1)}
              className="w-12 h-12 rounded-xl bg-primary text-white active:bg-primary-700 font-black text-2xl btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              aria-label={'增加 ' + line.name}
            >
              +
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-primary font-black text-kiosk-xl">
            NT$ {subtotal.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => removeLine(line.lineId)}
            className="text-sm text-gray-400 hover:text-primary font-bold underline btn-press"
          >
            移除
          </button>
        </div>
      </div>
    </div>
  );
}
