import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: ReactNode;
}

export function MemberRequired({ children }: Props) {
  const member = useAuthStore((s) => s.member);
  const token = useAuthStore((s) => s.token);
  if (!token || !member) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function MemberOnlyBanner() {
  const isAuthed = useAuthStore((s) => Boolean(s.token && s.member));
  if (isAuthed) return null;
  return (
    <Link
      to="/login"
      className="block rounded-2xl bg-brand-50 border border-brand-100 px-4 py-3 text-brand-700 text-sm"
    >
      ✨ 登入會員享優惠、回顧訂單 <span className="font-semibold underline">立即登入</span>
    </Link>
  );
}
