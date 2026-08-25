import type { Coupon } from '@smart-dining/contracts';

interface Props {
  coupon: Coupon;
}

function formatValue(c: Coupon) {
  return c.type === 'PERCENTAGE' ? `${c.value}% OFF` : `折抵 NT$ ${c.value}`;
}

function isExpired(c: Coupon) {
  return new Date(c.expiresAt).getTime() < Date.now();
}

function isUsed(c: Coupon) {
  return Boolean(c.usedAt);
}

export function CouponCard({ coupon }: Props) {
  const expired = isExpired(coupon);
  const used = isUsed(coupon);
  const inactive = expired || used;

  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl border p-4 flex items-stretch gap-3',
        inactive
          ? 'bg-ink-100 border-ink-100 text-ink-500'
          : 'bg-gradient-to-r from-brand-50 to-brand-100 border-brand-200',
      ].join(' ')}
    >
      <div
        className={[
          'flex flex-col items-center justify-center rounded-xl w-20 text-white shrink-0',
          inactive ? 'bg-ink-300' : 'bg-brand-500',
        ].join(' ')}
      >
        <div className="number-display text-xl font-extrabold leading-tight">
          {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `$${coupon.value}`}
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-90">
          {coupon.type === 'PERCENTAGE' ? '折扣' : '折抵'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm tracking-wider">{coupon.code}</div>
        <div className="text-sm mt-1">{formatValue(coupon)}</div>
        <div className="text-xs mt-1 opacity-70">
          到期 {new Date(coupon.expiresAt).toLocaleDateString('zh-TW')}
        </div>
        {used && <div className="mt-1 text-xs font-semibold">已使用</div>}
        {expired && !used && <div className="mt-1 text-xs font-semibold">已過期</div>}
      </div>
    </div>
  );
}
