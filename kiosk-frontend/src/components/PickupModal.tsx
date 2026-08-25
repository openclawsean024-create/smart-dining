/**
 * PickupModal — 取餐進度 modal(由 Sidebar 觸發)。
 *
 * 顯示「目前 active 訂單進度」。
 * 若 useUIStore.latestOrderNo 存在,呼叫 getOrder;否則顯示「尚無進行中訂單」。
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useUIStore } from '../store/uiStore';
import { getOrder } from '../api/orders';
import { PROGRESS_STAGE_MAP } from '@smart-dining/contracts';
import type { Order, ProgressStage } from '@smart-dining/contracts';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PickupModal() {
  const open = useUIStore((s) => s.pickupModalOpen);
  const close = useUIStore((s) => s.closePickupModal);
  const orderNo = useUIStore((s) => s.latestOrderNo);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!orderNo) {
      setOrder(null);
      return;
    }
    setLoading(true);
    getOrder(orderNo)
      .then((res) => setOrder(res.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [open, orderNo]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const stages = (['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY'] as ProgressStage[])
    .map((s) => ({ stage: s, meta: PROGRESS_STAGE_MAP[s] }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="取餐進度"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-kiosk-2xl text-gray-900">取餐進度</h2>
          <button
            type="button"
            onClick={close}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl text-gray-500 btn-press"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {loading && (
          <p className="text-kiosk-base text-gray-500 py-10 text-center">
            讀取訂單中…
          </p>
        )}

        {!loading && !orderNo && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3" aria-hidden="true">
              🍱
            </div>
            <p className="font-bold text-kiosk-base text-gray-500">
              目前沒有進行中的訂單
            </p>
            <p className="mt-2 text-sm text-gray-400">
              完成結帳後,訂單進度會顯示於此
            </p>
          </div>
        )}

        {!loading && order && (
          <div>
            <div className="bg-primary text-white rounded-2xl p-5 text-center mb-4">
              <div className="text-sm font-bold uppercase tracking-widest opacity-90">
                取餐號碼
              </div>
              <div
                className="font-black"
                style={{ fontSize: '64px', lineHeight: 1 }}
              >
                A{String(order.pickupNumber).padStart(3, '0')}
              </div>
              {order.estimatedReadyAt && (
                <div className="mt-2 text-kiosk-base font-bold opacity-90">
                  預計 {formatTime(order.estimatedReadyAt)} 可取餐
                </div>
              )}
            </div>

            {/* 階段 chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {stages.map(({ stage, meta }) => {
                const reached =
                  order.status === 'COMPLETED' ||
                  order.status === 'CANCELLED' ||
                  // 用 percentage 判斷先後
                  (order.status === 'READY') ||
                  (stage !== 'READY' &&
                    stages.findIndex((s) => s.stage === order.status) >=
                      stages.findIndex((s) => s.stage === stage));
                const current = order.status === stage;
                return (
                  <div
                    key={stage}
                    className={clsx(
                      'px-3 py-2 rounded-full font-bold text-sm border-2',
                      current
                        ? 'bg-secondary text-white border-secondary animate-pulse'
                        : reached
                          ? 'bg-secondary-50 text-secondary-700 border-secondary-200'
                          : 'bg-gray-100 text-gray-400 border-gray-100',
                    )}
                  >
                    {meta.displayName}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
