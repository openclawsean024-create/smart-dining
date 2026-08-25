/**
 * CompletePage — 完成畫面(全頁覆蓋,背景白色)。
 *
 * 中央卡片(寬 60%):
 *   - 取餐號碼(A128,120px,橘底白字,粗體,圓角 16px)
 *   - 副標「訂單編號 SD-YYYYMMDD-XXXX」
 *   - 「預計 XX:XX 可取餐」(28px)
 *   - 製作階段 chip(目前 QUEUED → 「已成立訂單,排隊中」)
 *   - QR code(80×80):內容 web/track/{orderNo}
 *   - 「列印取餐單」+「新訂單」雙按鈕
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCode } from '../components/QRCode';
import { useCartStore } from '../store/cartStore';
import { PROGRESS_STAGE_MAP } from '@smart-dining/contracts';
import type { Order } from '@smart-dining/contracts';
import { getOrder } from '../api/orders';

function formatReadyTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 把 orderNo 轉成 SD-YYYYMMDD-XXXX 形式(若已是就直接回傳)。 */
function prettyOrderNo(orderNo: string): string {
  return orderNo; // 後端已經是 SD-YYYYMMDD-XXXX 格式
}

export function CompletePage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const clearCart = useCartStore((s) => s.clear);

  const passedOrder = (location.state as { order?: Order } | null)?.order;
  const [order, setOrder] = useState<Order | null>(passedOrder ?? null);
  const [loading, setLoading] = useState(!passedOrder);

  useEffect(() => {
    if (passedOrder || !orderNo) return;
    let cancelled = false;
    getOrder(orderNo)
      .then((res) => {
        if (!cancelled) setOrder(res.order);
      })
      .catch(() => {
        /* 後端可能尚未實作,容錯 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderNo, passedOrder]);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  const pickupNumber = order?.pickupNumber ?? 0;
  const pickupLabel = 'A' + String(pickupNumber).padStart(3, '0');
  const stageMeta =
    order &&
    (order.status === 'QUEUED' ||
      order.status === 'PREPARING' ||
      order.status === 'COOKING' ||
      order.status === 'PLATING' ||
      order.status === 'READY')
      ? PROGRESS_STAGE_MAP[order.status]
      : null;
  const trackUrl =
    window.location.origin + '/track/' + encodeURIComponent(orderNo ?? '');

  function startNewOrder() {
    navigate('/');
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 print-area">
        <p className="text-kiosk-base text-secondary font-bold mb-3 no-print">
          訂單已成立 🎉
        </p>

        {loading ? (
          <p className="text-kiosk-xl text-gray-500">載入訂單中…</p>
        ) : (
          <div className="w-[60%] max-w-3xl bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
            {/* 取餐號 */}
            <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
              取餐號碼
            </div>
            <div
              className="inline-block bg-primary text-white font-black leading-none px-10 py-6 rounded-2xl shadow-lg"
              style={{ fontSize: '120px' }}
              aria-label={'取餐號碼 ' + pickupLabel}
            >
              {pickupLabel}
            </div>

            {/* 副標 */}
            <div className="mt-6">
              <div className="text-sm font-bold text-gray-500 mb-1">訂單編號</div>
              <div className="font-black text-kiosk-2xl text-gray-900 tracking-wide font-mono">
                {orderNo ? prettyOrderNo(orderNo) : '—'}
              </div>
            </div>

            {/* 預計 + 階段 */}
            <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
              {order?.estimatedReadyAt && (
                <div className="text-kiosk-xl font-black text-gray-900">
                  預計 {formatReadyTime(order.estimatedReadyAt)} 可取餐
                </div>
              )}
              {stageMeta && (
                <span
                  className={
                    'px-4 py-2 rounded-full font-black text-kiosk-base shadow-sm ' +
                    (stageMeta.stage === 'READY'
                      ? 'bg-secondary text-white'
                      : 'bg-accent/20 text-accent-700')
                  }
                >
                  {stageMeta.displayName}
                </span>
              )}
            </div>

            {/* QR */}
            <div className="mt-6 flex justify-center">
              <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                <QRCode value={trackUrl} size={80} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400 break-all max-w-md mx-auto no-print">
              {trackUrl}
            </p>

            {/* 雙按鈕 */}
            <div className="mt-8 flex gap-3 no-print justify-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-touch px-6 rounded-2xl bg-white border-2 border-gray-300 text-gray-700 font-black text-kiosk-base btn-press hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              >
                列印取餐單
              </button>
              <button
                type="button"
                onClick={startNewOrder}
                className="h-touch px-8 rounded-2xl bg-primary text-white font-black text-kiosk-base btn-press hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              >
                新訂單
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
