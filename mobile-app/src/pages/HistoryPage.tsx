import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useMemberOrders } from '../hooks/useMember';

const statusLabel: Record<string, string> = {
  QUEUED: '排隊中',
  PREPARING: '準備中',
  COOKING: '製作中',
  PLATING: '盛盤中',
  READY: '可取餐',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const statusClass: Record<string, string> = {
  READY: 'bg-success/15 text-success',
  COMPLETED: 'bg-ink-100 text-ink-500',
  CANCELLED: 'bg-ink-100 text-ink-500',
};

export function HistoryPage() {
  const member = useAuthStore((s) => s.member);
  const { data: orders, isLoading } = useMemberOrders(member?.id ?? null);

  return (
    <div className="px-5 pt-6 pb-28 max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold text-ink-900">訂單歷史</h1>

      {isLoading && <div className="mt-8 text-center text-ink-500">載入中…</div>}

      {orders && orders.length === 0 && (
        <div className="mt-10 text-center text-ink-500 text-sm">尚無訂單紀錄</div>
      )}

      <ul className="mt-4 space-y-3">
        {orders?.map((o) => {
          const label = statusLabel[o.status] ?? o.status;
          const cls = statusClass[o.status] ?? 'bg-brand-50 text-brand-600';
          return (
            <li key={o.id}>
              <Link
                to={`/track/${encodeURIComponent(o.orderNo)}`}
                className="block rounded-2xl bg-white border border-ink-100 p-4 active:scale-[.99] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <span className="number-display text-3xl font-extrabold text-brand-500">
                      #{String(o.pickupNumber).padStart(3, '0')}
                    </span>
                    <span className="font-mono text-xs text-ink-500">{o.orderNo}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-ink-700">
                  <span>{new Date(o.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="font-bold">NT$ {o.totalAmount}</span>
                </div>
                <div className="mt-1 text-xs text-ink-500">{o.items.length} 項商品</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
