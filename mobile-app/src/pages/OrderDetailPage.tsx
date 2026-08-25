import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PROGRESS_STAGE_MAP, type OrderItem } from '@smart-dining/contracts';
import { useOrderTracking } from '../hooks/useOrderTracking';
import { useTrackStore } from '../store/trackStore';
import { PickupNumberCard } from '../components/PickupNumberCard';
import { ProgressBar } from '../components/ProgressBar';
import { StageTimeline } from '../components/StageTimeline';
import { ETACountdown } from '../components/ETACountdown';
import { MemberOfferCard } from '../components/MemberOfferCard';
import { useAuthStore } from '../store/authStore';

export function OrderDetailPage() {
  const params = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const orderNo = params.orderNo ? decodeURIComponent(params.orderNo) : null;
  const setCurrent = useTrackStore((s) => s.setCurrent);
  const vibrate = useTrackStore((s) => s.vibrateOnReady);
  const setVibrate = useTrackStore((s) => s.setVibrate);
  const member = useAuthStore((s) => s.member);
  const [itemsOpen, setItemsOpen] = useState(false);

  useEffect(() => {
    if (orderNo) setCurrent(orderNo);
    return () => setCurrent(null);
  }, [orderNo, setCurrent]);

  const tracking = useOrderTracking(orderNo);
  const { order, stage, percentage, estimatedReadyAt, isReady, isConnected, error } = tracking;
  const stageMeta = stage ? PROGRESS_STAGE_MAP[stage] : null;

  const totalItems = useMemo<OrderItem[]>(() => order?.items ?? [], [order]);

  if (!orderNo) {
    return (
      <div className="p-6 text-center text-ink-500">
        未提供訂單編號
        <div className="mt-4">
          <Link to="/" className="text-brand-500 underline">回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-28 max-w-md mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-ink-500 text-sm flex items-center gap-1"
        aria-label="返回"
      >
        <span aria-hidden>‹</span> 返回
      </button>

      {!order && !error && (
        <div className="mt-6 text-center text-ink-500 py-16">載入中…</div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-warn/40 bg-warn/5 text-warn p-4 text-sm">
          取得訂單失敗:{error.message}
          <div className="mt-2 text-xs text-ink-500">將以輪詢方式持續嘗試連線</div>
        </div>
      )}

      {order && (
        <div className="mt-3 space-y-5">
          <PickupNumberCard
            pickupNumber={order.pickupNumber}
            orderNo={order.orderNo}
            isReady={isReady}
          />

          <ProgressBar currentStage={stage} />

          <div className="text-center">
            <div className="number-display text-[72px] leading-none font-extrabold text-brand-500">
              {percentage}%
            </div>
            <div className="mt-1 text-ink-700">
              {stageMeta?.displayName ?? '處理中'}
            </div>
          </div>

          <ETACountdown estimatedReadyAt={estimatedReadyAt} isReady={isReady} />

          <MemberOfferCard member={member} />

          <ConnectionPill connected={isConnected} ready={isReady} />

          <button
            type="button"
            onClick={() => setVibrate(!vibrate)}
            className={[
              'w-full rounded-2xl border-2 py-3 font-bold flex items-center justify-center gap-2',
              vibrate ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-ink-100 text-ink-700',
            ].join(' ')}
          >
            <span aria-hidden>{vibrate ? '🔔' : '🔕'}</span>
            <span>可取餐時{vibrate ? '震動通知(已啟用)' : '震動通知(已關閉)'}</span>
          </button>

          <section className="rounded-2xl border border-ink-100 bg-white">
            <button
              onClick={() => setItemsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="font-semibold">訂單明細</span>
              <span className="text-xs text-ink-500">
                {order.items.length} 項 ・ NT$ {order.totalAmount}{' '}
                <span aria-hidden>{itemsOpen ? '▾' : '▸'}</span>
              </span>
            </button>
            {itemsOpen && (
              <ul className="px-4 pb-4 space-y-3">
                {totalItems.map((item) => (
                  <li key={item.id} className="border-t border-ink-100 pt-3 first:border-0 first:pt-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-ink-500">x{item.quantity}</span>
                    </div>
                    {item.customizations?.length ? (
                      <ul className="mt-1 text-xs text-ink-500 space-y-0.5">
                        {item.customizations.map((c) => (
                          <li key={c.groupId}>・{c.groupName}:{c.choiceNames.join(', ')}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-1 text-xs text-ink-500">NT$ {item.subtotal}</div>
                  </li>
                ))}
                <li className="border-t border-ink-100 pt-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>小計</span><span>NT$ {order.subtotal}</span></div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-brand-500">
                      <span>折扣</span><span>-NT$ {order.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>總計</span><span>NT$ {order.totalAmount}</span>
                  </div>
                </li>
              </ul>
            )}
          </section>

          {order.statusLog && order.statusLog.length > 0 && (
            <section className="rounded-2xl border border-ink-100 bg-white p-4">
              <h3 className="font-semibold mb-2">階段時間軸</h3>
              <StageTimeline currentStage={stage} logs={order.statusLog} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionPill({ connected, ready }: { connected: boolean; ready: boolean }) {
  if (ready) return null;
  return (
    <div className="flex justify-center">
      <span
        className={[
          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs',
          connected ? 'bg-success/10 text-success' : 'bg-warn/10 text-warn',
        ].join(' ')}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-warn'}`} />
        {connected ? '即時連線中' : '連線中斷,以輪詢更新'}
      </span>
    </div>
  );
}
