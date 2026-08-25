/**
 * CheckoutPage — 結帳 modal(覆蓋在 Dashboard 上)。
 *
 * 上半部:PriceSummary
 * 中間:會員登入(電話 + 驗證碼)
 * 優惠券選擇下拉
 * 底部:「確認結帳 $XXX」大按鈕
 * 結帳成功 → 跳 CompletePage
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { PriceSummary } from '../components/PriceSummary';
import { NumberPad } from '../components/NumberPad';
import { useCartStore, computeDiscount } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';
import { login as apiLogin, verify as apiVerify } from '../api/auth';
import { createOrder } from '../api/orders';
import type { Coupon, CartCustomizationSelection, Member } from '@smart-dining/contracts';
import type { SelectedCoupon, AuthSession } from '../types';

type Step = 'phone' | 'code' | 'idle';

const AVAILABLE_COUPONS: Coupon[] = [
  {
    id: 'cp-1',
    code: 'WELCOME10',
    type: 'PERCENTAGE',
    value: 10,
    expiresAt: '2099-12-31T23:59:59.000Z',
    usedAt: null,
    memberId: null,
  },
  {
    id: 'cp-2',
    code: 'SAVE50',
    type: 'AMOUNT',
    value: 50,
    expiresAt: '2099-12-31T23:59:59.000Z',
    usedAt: null,
    memberId: null,
  },
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const open = useUIStore((s) => s.checkoutModalOpen);
  const close = useUIStore((s) => s.closeCheckoutModal);
  const setLatestOrderNo = useUIStore((s) => s.setLatestOrderNo);

  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const clearCart = useCartStore((s) => s.clear);

  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<Member | null>(() => {
    try {
      const raw = localStorage.getItem('kiosk_session');
      return raw ? (JSON.parse(raw) as AuthSession).member : null;
    } catch {
      return null;
    }
  });

  const discount = useMemo(
    () => computeDiscount(subtotal, appliedCoupon),
    [subtotal, appliedCoupon],
  );
  const total = Math.max(0, subtotal - discount);

  const isEmpty = lines.length === 0;
  const canSubmit = !isEmpty && !busy;

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // 開啟時不滾動背景
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [open]);

  function startLogin() {
    setStep('phone');
    setError(null);
    setHint(null);
    setCode('');
  }

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('請輸入完整的手機號碼');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiLogin(phone.replace(/\D/g, ''));
      setHint(res.message + (res.code ? ' (本次驗證碼:' + res.code + ')' : ''));
      setStep('code');
      if (res.code) {
        // 方便 demo:自動填入驗證碼
        setCode(res.code);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '發送驗證碼失敗');
    } finally {
      setBusy(false);
    }
  }

  async function doVerify() {
    if (code.length < 4) {
      setError('請輸入驗證碼');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiVerify(phone.replace(/\D/g, ''), code);
      const s: AuthSession = { token: res.token, member: res.member };
      setMember(res.member);
      localStorage.setItem('kiosk_session', JSON.stringify(s));
      localStorage.setItem('kiosk_token', res.token);
      setStep('idle');
      setHint('登入成功:' + (res.member.name || res.member.phone));
    } catch (e) {
      setError(e instanceof Error ? e.message : '驗證失敗');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setMember(null);
    localStorage.removeItem('kiosk_session');
    localStorage.removeItem('kiosk_token');
    setHint(null);
    setPhone('');
    setCode('');
  }

  function applyCoupon(c: Coupon | null) {
    if (!c) {
      setCoupon(null);
      return;
    }
    const sel: SelectedCoupon = {
      code: c.code,
      type: c.type,
      value: c.value,
      label:
        c.type === 'PERCENTAGE'
          ? '折扣 ' + c.value + '%'
          : '折抵 NT$ ' + c.value,
    };
    setCoupon(sel);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const cartItems = lines.map((l) => {
        const customizations: CartCustomizationSelection[] = l.customizationGroups
          .map((g) => {
            const ids = l.customizations[g.id] ?? [];
            const choiceNames = ids
              .map((cid) => g.choices.find((c) => c.id === cid)?.name ?? '')
              .filter(Boolean);
            return {
              groupId: g.id,
              groupName: g.groupName,
              choiceIds: ids,
              choiceNames,
            };
          })
          .filter((sel) => sel.choiceIds.length > 0);

        return {
          menuItemId: l.menuItemId,
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          customizations,
        };
      });

      const payload = {
        cart: { items: cartItems },
        memberId: member?.id,
        couponCode: appliedCoupon?.code,
      };
      const res = await createOrder(payload);
      clearCart();
      setLatestOrderNo(res.order.orderNo);
      close();
      navigate('/complete/' + encodeURIComponent(res.order.orderNo), {
        state: { order: res.order },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立訂單失敗');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="結帳"
    >
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-kiosk-2xl text-gray-900">結帳</h2>
          <button
            type="button"
            onClick={close}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl text-gray-500 btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            aria-label="關閉結帳"
          >
            ×
          </button>
        </div>

        {/* 內容區 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* PriceSummary */}
          <PriceSummary
            subtotal={subtotal}
            discount={discount}
            coupon={appliedCoupon}
          />

          {/* 會員登入 */}
          <section className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-kiosk-lg text-gray-900">會員登入</h3>
              {member && (
                <button
                  type="button"
                  onClick={logout}
                  className="text-sm text-gray-500 underline btn-press"
                >
                  登出
                </button>
              )}
            </div>

            {member ? (
              <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-gray-100">
                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-lg flex items-center justify-center">
                  {(member.name || member.phone).slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-kiosk-base text-gray-900 truncate">
                    {member.name || '訪客'}
                  </div>
                  <div className="text-sm text-gray-500 truncate">{member.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 font-bold">點數</div>
                  <div className="font-black text-kiosk-lg text-accent-700">
                    {member.points.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : step === 'phone' || step === 'code' ? (
              <div className="space-y-3">
                {step === 'phone' && (
                  <>
                    <label className="block">
                      <span className="font-bold text-sm text-gray-700">
                        手機號碼
                      </span>
                      <div className="mt-1 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-kiosk-lg text-gray-900">
                        {phone || '____  ____  ____'}
                      </div>
                    </label>
                    <NumberPad
                      value={phone}
                      onChange={setPhone}
                      mode="phone"
                      maxLength={10}
                      disabled={busy}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep('idle')}
                        className="h-touch px-6 rounded-xl bg-gray-100 text-gray-800 font-bold btn-press"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={busy || phone.replace(/\D/g, '').length < 10}
                        onClick={sendCode}
                        className="flex-1 h-touch rounded-xl bg-primary text-white font-black text-kiosk-base btn-press hover:bg-primary-600 disabled:bg-gray-300 shadow"
                      >
                        {busy ? '發送中…' : '取得驗證碼'}
                      </button>
                    </div>
                  </>
                )}
                {step === 'code' && (
                  <>
                    <label className="block">
                      <span className="font-bold text-sm text-gray-700">
                        驗證碼(Demo:1234)
                      </span>
                      <div className="mt-1 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-kiosk-2xl text-gray-900 tracking-widest">
                        {code || '____'}
                      </div>
                    </label>
                    <NumberPad
                      value={code}
                      onChange={setCode}
                      mode="code"
                      maxLength={4}
                      disabled={busy}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep('phone')}
                        className="h-touch px-6 rounded-xl bg-gray-100 text-gray-800 font-bold btn-press"
                      >
                        重填電話
                      </button>
                      <button
                        type="button"
                        disabled={busy || code.length < 4}
                        onClick={doVerify}
                        className="flex-1 h-touch rounded-xl bg-primary text-white font-black text-kiosk-base btn-press hover:bg-primary-600 disabled:bg-gray-300 shadow"
                      >
                        {busy ? '驗證中…' : '登入'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={startLogin}
                className="w-full h-touch rounded-xl bg-white border-2 border-primary text-primary font-black text-kiosk-base btn-press hover:bg-primary-50 shadow-sm"
              >
                以手機登入 / 加入會員
              </button>
            )}

            {hint && (
              <p className="mt-2 text-sm text-secondary font-bold">{hint}</p>
            )}
          </section>

          {/* 優惠券 */}
          <section className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
            <h3 className="font-black text-kiosk-lg text-gray-900 mb-3">優惠券</h3>
            <select
              className="w-full h-touch rounded-xl bg-white border-2 border-gray-200 px-4 font-bold text-kiosk-base text-gray-900 focus:outline-none focus:border-primary"
              value={appliedCoupon?.code ?? ''}
              onChange={(e) => {
                const code = e.target.value;
                if (!code) {
                  applyCoupon(null);
                  return;
                }
                const c = AVAILABLE_COUPONS.find((cp) => cp.code === code);
                if (c) applyCoupon(c);
              }}
            >
              <option value="">不使用優惠券</option>
              {AVAILABLE_COUPONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ·{' '}
                  {c.type === 'PERCENTAGE'
                    ? `折扣 ${c.value}%`
                    : `折抵 NT$ ${c.value}`}
                </option>
              ))}
            </select>
          </section>

          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 font-bold px-4 py-3 rounded-xl"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {/* 底部 CTA */}
        <div className="border-t border-gray-100 p-4 bg-white">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className={clsx(
              'w-full h-[72px] rounded-2xl font-black text-kiosk-2xl btn-press shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
              !canSubmit
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700',
            )}
          >
            {busy ? '送出中…' : `確認結帳 $${total.toLocaleString()}`}
          </button>
          {isEmpty && (
            <p className="mt-2 text-center text-sm text-gray-400 font-bold">
              購物車為空,請先選擇餐點
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
