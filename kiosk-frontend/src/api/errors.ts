/**
 * 把後端下單錯誤代碼(PricingErrorCode)轉成顧客看得懂的訊息。
 */
import { ApiError } from './client';

const ORDER_ERROR_MESSAGES: Record<string, string> = {
  ORDER_001: '購物車是空的,請先選擇餐點',
  CART_001: '餐點數量不正確,請調整後再試',
  PRODUCT_001: '有餐點的價格資料異常,請洽店員',
  ITEM_NOT_FOUND: '有餐點已下架,請從購物車移除後再結帳',
  ITEM_UNAVAILABLE: '有餐點已下架或售完,請從購物車移除後再結帳',
  ITEM_OUT_OF_STOCK: '有餐點庫存不足或已售完,請調整數量或移除後再結帳',
  OPTION_INVALID: '有餐點的客製化選項已變更,請移除後重新選擇',
  OPTION_UNAVAILABLE: '有客製化選項目前無法提供,請移除後重新選擇',
  OPTION_REQUIRED: '有餐點尚未選擇必選項目,請移除後重新選擇',
  COUPON_INVALID: '這張優惠券無法使用(可能已使用或過期)',
};

export function orderErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const code =
      e.body && typeof e.body === 'object' ? (e.body as Record<string, unknown>).code : undefined;
    if (typeof code === 'string' && ORDER_ERROR_MESSAGES[code]) return ORDER_ERROR_MESSAGES[code];
    if (e.status === 0) return '無法連線到伺服器,請稍後再試或洽店員';
  }
  return '建立訂單失敗,請稍後再試或洽店員';
}
