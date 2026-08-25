import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMemberCoupons } from '../hooks/useMember';
import { CouponCard } from '../components/CouponCard';

export function CouponsPage() {
  const member = useAuthStore((s) => s.member);
  const { data: coupons, isLoading, error } = useMemberCoupons(member?.id ?? null);

  const { active, used, expired } = useMemo(() => {
    const list = coupons ?? [];
    const now = Date.now();
    return {
      active: list.filter((c) => !c.usedAt && new Date(c.expiresAt).getTime() >= now),
      used: list.filter((c) => c.usedAt),
      expired: list.filter((c) => !c.usedAt && new Date(c.expiresAt).getTime() < now),
    };
  }, [coupons]);

  return (
    <div className="px-5 pt-6 pb-28 max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold text-ink-900">優惠券</h1>

      {isLoading && <div className="mt-8 text-center text-ink-500">載入中…</div>}
      {error && <div className="mt-8 rounded-xl bg-warn/10 text-warn p-3 text-sm">讀取失敗</div>}

      <Section title={`可使用 (${active.length})`} empty="目前沒有可使用的優惠券">
        {active.map((c) => <CouponCard key={c.id} coupon={c} />)}
      </Section>

      <Section title={`已使用 (${used.length})`} empty={null} hidden={used.length === 0}>
        {used.map((c) => <CouponCard key={c.id} coupon={c} />)}
      </Section>

      <Section title={`已過期 (${expired.length})`} empty={null} hidden={expired.length === 0}>
        {expired.map((c) => <CouponCard key={c.id} coupon={c} />)}
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  empty: string | null;
  hidden?: boolean;
  children: React.ReactNode;
}

function Section({ title, empty, hidden, children }: SectionProps) {
  if (hidden) return null;
  const arr = Array.isArray(children) ? children : [children];
  const hasContent = arr.filter(Boolean).length > 0;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-ink-700 mb-2">{title}</h2>
      {hasContent ? (
        <div className="space-y-3">{children}</div>
      ) : (
        empty && <div className="text-sm text-ink-500 px-2 py-4">{empty}</div>
      )}
    </section>
  );
}
