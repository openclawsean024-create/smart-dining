/**
 * KdsPage — 廚房顯示系統(AC-004 / FR-062)。
 *
 * 改寫自 restaurant-kiosk `web/src/pages/KdsPage.tsx`(SPEC §12.1 #2):
 *   - 資料來源改為後端 GET /api/admin/orders(原版讀 localStorage)
 *   - 以 Socket.IO /kds 通知即時更新,另每 10 秒輪詢備援(原版每 2 秒重讀 localStorage)
 *   - 狀態改用主 repo 的製作階段(QUEUED → PREPARING → COOKING → PLATING → READY)
 * 保留原版的行為:依等待時間排序(最舊在前)、顯示等待時間、一鍵推進、空狀態。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { AdminOrder, OrderStatus } from '@smart-dining/contracts';
import { advanceOrder, completeOrder, listActiveOrders } from '../../api/admin';
import { ApiError } from '../../api/client';
import { subscribeKds } from '../../realtime/kdsSocket';
import { useStaffStore } from '../../store/staffStore';
import {
  customizationText, elapsedLabel, isLate, kdsAction, KDS_STATUS_LABEL, pickupLabel, sortByWaiting,
} from '../../lib/kds';

/** 輪詢間隔(Socket 通知之外的備援) */
export const KDS_POLL_MS = 10_000;
/** 等待時間文字的更新間隔 */
const TICK_MS = 5_000;

const STATUS_STYLE: Record<OrderStatus, string> = {
  QUEUED: 'border-blue-500 bg-blue-50',
  PREPARING: 'border-amber-500 bg-amber-50',
  COOKING: 'border-primary bg-primary-50',
  PLATING: 'border-accent-600 bg-accent-50',
  READY: 'border-secondary bg-secondary-50',
  COMPLETED: 'border-gray-300 bg-gray-100',
  CANCELLED: 'border-gray-300 bg-gray-100',
};

export function KdsPage() {
  const token = useStaffStore((s) => s.token);
  const role = useStaffStore((s) => s.staff?.role);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  /** 伺服器時間 − 本機時間;等待時間以伺服器時間為準 */
  const [clockSkew, setClockSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await listActiveOrders();
      if (!mounted.current) return;
      setOrders(res.orders);
      // 偏差與「現在」用同一個本機時間點更新，否則等待時間會少算
      const localNow = Date.now();
      setClockSkew(new Date(res.serverTime).getTime() - localNow);
      setNow(localNow);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      // 401 時 API client 已清除登入狀態,畫面會回到登入頁
      if (!(e instanceof ApiError && e.status === 401)) {
        setError('無法取得訂單,將自動重試');
      }
    } finally {
      if (mounted.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const poll = setInterval(() => void refresh(), KDS_POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      mounted.current = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const sub = subscribeKds(token, {
      onChange: () => void refresh(),
      onConnectionChange: setLive,
    });
    return () => sub.close();
  }, [token, refresh]);

  const sorted = useMemo(() => sortByWaiting(orders), [orders]);
  const serverNow = now + clockSkew;

  async function handleAction(order: AdminOrder) {
    if (busy || !role) return;
    const action = kdsAction(order.status, role);
    if (!action.enabled) return;
    setBusy(order.orderNo);
    setError(null);
    try {
      if (action.kind === 'advance') await advanceOrder(order.orderNo);
      else await completeOrder(order.orderNo);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setError('這個帳號的角色不能執行此操作');
      else if (!(e instanceof ApiError && e.status === 401)) setError('操作失敗,請再試一次');
    } finally {
      // 不做樂觀更新:一律以後端回傳的最新清單為準
      await refresh();
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-3xl font-black text-gray-900">廚房顯示系統(KDS)</h1>
        <div className="text-sm text-gray-500 font-bold" data-testid="kds-stats">
          進行中 {sorted.length} 單 ·{' '}
          <span className={live ? 'text-secondary' : 'text-gray-500'}>
            {live ? '即時連線中' : `每 ${KDS_POLL_MS / 1000} 秒更新`}
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold">
          {error}
        </div>
      )}

      {!loaded && <div className="text-center text-gray-400 py-20 text-xl">載入中…</div>}

      {loaded && sorted.length === 0 && (
        <div className="text-center text-gray-400 py-20 text-xl" data-testid="kds-empty">
          目前沒有待製作訂單
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="kds-grid">
        {sorted.map((o) => {
          const createdAt = new Date(o.createdAt).getTime();
          const late = o.status !== 'READY' && isLate(createdAt, serverNow);
          const action = role ? kdsAction(o.status, role) : null;
          return (
            <article
              key={o.orderNo}
              data-testid={`kds-order-${o.orderNo}`}
              data-status={o.status}
              className={clsx('border-l-8 rounded-xl p-4 shadow-sm', STATUS_STYLE[o.status])}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-4xl font-black text-gray-900" data-testid={`kds-pickup-${o.orderNo}`}>
                  {pickupLabel(o.pickupNumber)}
                </span>
                <span
                  className={clsx(
                    'text-sm font-black px-2 py-1 rounded-lg whitespace-nowrap',
                    late ? 'bg-red-600 text-white' : 'bg-white/70 text-gray-700',
                  )}
                  data-testid={`kds-elapsed-${o.orderNo}`}
                >
                  ⏱ {elapsedLabel(createdAt, serverNow)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-mono">{o.orderNo}</span>
                <span className="text-sm font-black text-gray-700" data-testid={`kds-status-${o.orderNo}`}>
                  {KDS_STATUS_LABEL[o.status]}
                </span>
              </div>

              <ul className="space-y-2 mb-4">
                {o.items.map((line, idx) => {
                  const custom = customizationText(line.customizations);
                  return (
                    <li key={line.id ?? idx} data-testid={`kds-item-${o.orderNo}-${idx}`}>
                      <div className="font-black text-xl text-gray-900">
                        {line.name}
                        <span className="ml-2 text-primary-600">x{line.quantity}</span>
                      </div>
                      {custom && <div className="text-sm text-gray-600 font-bold">• {custom}</div>}
                    </li>
                  );
                })}
              </ul>

              {action && (
                <button
                  type="button"
                  onClick={() => void handleAction(o)}
                  disabled={!action.enabled || busy === o.orderNo}
                  className={clsx(
                    'w-full min-h-[56px] px-3 py-2 rounded-xl font-black text-lg btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                    action.kind === 'complete'
                      ? 'bg-secondary text-white hover:bg-secondary-600'
                      : 'bg-primary text-white hover:bg-primary-600',
                    'disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed',
                  )}
                  data-testid={`kds-advance-${o.orderNo}`}
                >
                  {busy === o.orderNo ? '處理中…' : action.label}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
