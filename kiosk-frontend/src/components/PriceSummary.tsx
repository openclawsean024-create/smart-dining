import { useCartStore, computeDiscount } from '../store/cartStore';
import type { SelectedCoupon } from '../types';

interface PriceSummaryProps {
  /** 若由 props 傳入,優先使用(用於 checkout 即時顯示) */
  subtotal?: number;
  discount?: number;
  coupon?: SelectedCoupon | null;
  /** 隱藏折扣列(購物車頁面用) */
  hideDiscount?: boolean;
}

export function PriceSummary({
  subtotal: subtotalProp,
  discount: discountProp,
  coupon: couponProp,
  hideDiscount = false,
}: PriceSummaryProps) {
  const storeSubtotal = useCartStore((s) => s.getSubtotal());
  const storeCoupon = useCartStore((s) => s.appliedCoupon);

  const subtotal = subtotalProp ?? storeSubtotal;
  const coupon = couponProp !== undefined ? couponProp : storeCoupon;
  const discount = discountProp ?? computeDiscount(subtotal, coupon);
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div className="flex justify-between items-center py-2 text-kiosk-base">
        <span className="text-gray-600 font-medium">小計</span>
        <span className="font-bold text-gray-900">NT$ {subtotal.toLocaleString()}</span>
      </div>
      {!hideDiscount && discount > 0 && (
        <div className="flex justify-between items-center py-2 text-kiosk-base border-t border-gray-200">
          <span className="text-secondary font-medium">
            折扣{coupon ? ' (' + coupon.label + ')' : ''}
          </span>
          <span className="font-bold text-secondary">-NT$ {discount.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-gray-300">
        <span className="font-black text-kiosk-xl text-gray-900">總計</span>
        <span className="font-black text-kiosk-3xl text-primary">NT$ {total.toLocaleString()}</span>
      </div>
    </div>
  );
}
