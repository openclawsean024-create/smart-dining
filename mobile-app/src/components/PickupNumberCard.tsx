interface Props {
  pickupNumber: number;
  orderNo: string;
  isReady?: boolean;
}

/**
 * 取餐號碼大卡 — 對齊 design-spec 第 3.2 節
 * - 橘底白字(#FF6B35)、圓角 20px、96px 粗體
 * - 號碼格式: A + 3 位數(例 A001, A128)
 */
export function PickupNumberCard({ pickupNumber, orderNo, isReady }: Props) {
  const formatted = 'A' + String(pickupNumber).padStart(3, '0');
  return (
    <div
      className={[
        'rounded-[20px] text-white shadow-lg px-6 py-8 text-center mx-4',
        isReady ? 'bg-success shadow-success/20' : 'bg-brand-500 shadow-brand-500/20',
      ].join(' ')}
    >
      <div className="text-xs uppercase tracking-widest opacity-90">取餐號碼</div>
      <div
        className="number-display text-[96px] leading-none font-extrabold mt-2"
        style={{ letterSpacing: '-0.02em' }}
        aria-label={`取餐號碼 ${formatted}`}
      >
        {formatted}
      </div>
      <div className="mt-3 text-xs opacity-90 font-mono">
        訂單編號 {orderNo}
      </div>
    </div>
  );
}
