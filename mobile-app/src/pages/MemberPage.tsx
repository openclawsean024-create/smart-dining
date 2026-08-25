import { Link, useNavigate } from 'react-router-dom';
import type { MemberTier } from '@smart-dining/contracts';
import { useAuthStore } from '../store/authStore';
import { useMember } from '../hooks/useMember';

const tierStyles: Record<MemberTier, { label: string; cls: string }> = {
  BRONZE: { label: '一般會員', cls: 'bg-ink-100 text-ink-700' },
  SILVER: { label: '銀級', cls: 'bg-ink-100 text-ink-700' },
  GOLD: { label: '金級 VIP', cls: 'bg-warn/15 text-warn' },
  PLATINUM: { label: '白金 VIP', cls: 'bg-brand-50 text-brand-700' },
};

export function MemberPage() {
  const member = useAuthStore((s) => s.member);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const { data: fresh } = useMember(member?.id ?? null);

  const m = fresh ?? member;
  if (!m) return null;

  const tier = tierStyles[m.tier] ?? tierStyles.BRONZE;
  const initial = (m.name ?? m.phone).slice(0, 2);
  const discountValue = Math.floor(m.points); // 1 點 = NT$ 1

  function handleLogout() {
    if (!confirm('確定要登出嗎?')) return;
    clear();
    navigate('/', { replace: true });
  }

  return (
    <div className="px-5 pt-8 pb-28 max-w-md mx-auto">
      <h1 className="sr-only">會員中心</h1>
      <section className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-brand-500 text-white flex items-center justify-center text-2xl font-extrabold">
          {initial}
        </div>
        <div>
          <div className="text-2xl font-extrabold text-ink-900">{m.name ?? '訪客會員'}</div>
          <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.cls}`}>
            {tier.label}
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 text-white p-6 shadow-lg shadow-brand-500/30">
        <div className="text-xs uppercase tracking-widest opacity-90">可用點數</div>
        <div className="number-display text-[72px] leading-none font-extrabold mt-2">{m.points}</div>
        <div className="mt-2 text-sm opacity-95">= NT$ {discountValue} 可折抵</div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/member/coupons" className="rounded-2xl bg-white border border-ink-100 p-4 active:scale-[.98] transition-transform">
          <div className="text-2xl">🎟</div>
          <div className="mt-2 font-bold text-ink-900">查看優惠券</div>
          <div className="text-xs text-ink-500 mt-1">可用 / 已使用</div>
        </Link>
        <Link to="/history" className="rounded-2xl bg-white border border-ink-100 p-4 active:scale-[.98] transition-transform">
          <div className="text-2xl">📋</div>
          <div className="mt-2 font-bold text-ink-900">訂單歷史</div>
          <div className="text-xs text-ink-500 mt-1">最近 20 筆</div>
        </Link>
      </section>

      <section className="mt-6 rounded-2xl bg-white border border-ink-100 p-4 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">手機</span><span className="font-mono">{m.phone}</span></div>
        <div className="mt-2 flex justify-between"><span className="text-ink-500">加入日期</span><span>{new Date(m.createdAt).toLocaleDateString('zh-TW')}</span></div>
      </section>

      <button
        onClick={handleLogout}
        className="mt-10 w-full rounded-2xl border border-ink-100 py-3 text-ink-500 font-semibold"
      >
        登出
      </button>
    </div>
  );
}
