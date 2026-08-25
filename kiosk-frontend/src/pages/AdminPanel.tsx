/**
 * AdminPanel — 門市後台(測試用)。
 *
 * 顯示所有 QUEUED/PREPARING/COOKING/PLATING/READY 訂單清單,
 * 每筆:取餐號、品項摘要、建立時間、目前狀態 chip、「下一階段」按鈕。
 * 點擊按鈕 → POST /api/admin/orders/:orderNo/advance
 *
 * 主要給 demo 與 QA 用。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { PROGRESS_STAGE_MAP } from '@smart-dining/contracts';
import type { Order, OrderStatus } from '@smart-dining/contracts';
import { advanceOrder, listActiveOrders } from '../api/admin';

interface BoardOrder extends Order {
  // 由後端擴充欄位(若有)
  itemSummary?: string;
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  QUEUED: 'bg-primary-50 text-primary-700 border-primary-200',
  PREPARING: 'bg-primary text-white border-primary',
  COOKING: 'bg-accent text-accent-900 border-accent',
  PLATING: 'bg-accent/40 text-accent-800 border-accent-300',
  READY: 'bg-secondary text-white border-secondary',
  COMPLETED: 'bg-gray-200 text-gray-600 border-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function nextStage(current: OrderStatus): OrderStatus | null {
  const order: OrderStatus[] = ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY'];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1]!;
}

// 範例示範資料:當後端尚未提供 list endpoint 時使用
const DEMO_ORDERS: BoardOrder[] = [
  // 為 typying,保留 optional;實際應由 API 回傳
  {
    id: 'demo-1',
    orderNo: 'SD-20260101-0001',
    memberId: null,
    totalAmount: 268,
    subtotal: 268,
    discount: 0,
    status: 'QUEUED',
    pickupNumber: 128,
    estimatedReadyAt: new Date(Date.now() + 4 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 60_000).toISOString(),
    items: [],
    itemSummary: '經典脆雞 x 1 · 可樂(中) x 1',
  } as BoardOrder,
];

export function AdminPanel() {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listActiveOrders();
      // 將 admin active item 轉成 BoardOrder(填入欄位)
      const mapped: BoardOrder[] = res.map((r) => ({
        id: r.orderNo,
        orderNo: r.orderNo,
        memberId: null,
        totalAmount: r.totalAmount,
        subtotal: r.totalAmount,
        discount: 0,
        status: r.status,
        pickupNumber: r.pickupNumber,
        estimatedReadyAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        createdAt: r.createdAt,
        items: [],
        itemSummary: r.itemSummary,
      }));
      setOrders(mapped);
      setUseDemoFallback(mapped.length === 0);
    } catch {
      setUseDemoFallback(true);
      setOrders(DEMO_ORDERS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleAdvance(o: BoardOrder) {
    if (busy) return;
    setBusy(o.orderNo);
    setError(null);
    try {
      const res = await advanceOrder(o.orderNo);
      setOrders((prev) =>
        prev.map((x) =>
          x.orderNo === res.order.orderNo
            ? ({ ...x, ...res.order } as BoardOrder)
            : x,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '推進失敗 — 請確認後端 /api/admin/orders/:orderNo/advance 已啟用',
      );
      // 即使失敗,樂觀推進本地狀態(若 next stage 可推進)
      const ns = nextStage(o.status);
      if (ns) {
        setOrders((prev) =>
          prev.map((x) =>
            x.orderNo === o.orderNo ? { ...x, status: ns } : x,
          ),
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-screen w-screen bg-gray-50 overflow-y-auto">
      <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary text-white font-black text-xl flex items-center justify-center">
            🍳
          </div>
          <h1 className="font-black text-2xl text-gray-900">門市後台</h1>
          {useDemoFallback && (
            <span className="ml-3 px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
              DEMO 模式
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="h-12 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          >
            重新整理
          </button>
          <Link
            to="/"
            className="h-12 px-5 rounded-xl bg-primary text-white font-black flex items-center btn-press hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          >
            回到 KIOSK
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-kiosk-base text-gray-600 mb-6">
          顯示所有{' '}
          <span className="font-black text-primary">QUEUED / PREPARING / COOKING / PLATING / READY</span>{' '}
          訂單。點擊「下一階段」推進狀態。
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-kiosk-base text-gray-500 py-10 text-center">
            載入中…
          </p>
        ) : orders.length === 0 ? (
          <div className="text-center text-kiosk-base text-gray-400 py-16">
            目前沒有進行中的訂單
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const ns = nextStage(o.status);
              const stageMeta =
                o.status === 'QUEUED' ||
                o.status === 'PREPARING' ||
                o.status === 'COOKING' ||
                o.status === 'PLATING' ||
                o.status === 'READY'
                  ? PROGRESS_STAGE_MAP[o.status]
                  : null;
              return (
                <div
                  key={o.orderNo}
                  className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between gap-4 flex-wrap"
                >
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-black text-kiosk-2xl text-gray-900">
                        取餐 A
                        {String(o.pickupNumber).padStart(3, '0')}
                      </span>
                      <span
                        className={clsx(
                          'px-3 py-1 rounded-full border-2 font-black text-sm',
                          STATUS_BADGE[o.status as OrderStatus],
                        )}
                      >
                        {stageMeta?.displayName ?? o.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTime(o.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-kiosk-base text-gray-700 truncate">
                      <span className="font-bold text-gray-900">
                        {o.itemSummary ??
                          o.items
                            .slice(0, 3)
                            .map((it) => `${it.name} x ${it.quantity}`)
                            .join(' · ')}
                      </span>
                      <span className="ml-2 font-black text-primary">
                        NT$ {o.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 font-mono">
                      {o.orderNo}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ns || busy === o.orderNo}
                    onClick={() => void handleAdvance(o)}
                    className={clsx(
                      'h-touch px-6 rounded-2xl font-black text-kiosk-base btn-press shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                      ns
                        ? 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed',
                    )}
                  >
                    {busy === o.orderNo
                      ? '推進中…'
                      : ns
                        ? '下一階段 → ' + (PROGRESS_STAGE_MAP[ns as keyof typeof PROGRESS_STAGE_MAP].displayName)
                        : '已是最後階段'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
