import { Link } from 'react-router-dom';
import type { Member } from '@smart-dining/contracts';

interface Props {
  member: Member | null;
}

/**
 * 會員優惠 CTA 卡片 — 對齊 design-spec 第 3.2 節
 * - 未登入:顯示「登入會員享優惠」+ 登入按鈕
 * - VIP (GOLD/PLATINUM):橘→金漸層,顯示「9 折優惠」+ 查看優惠券
 * - 一般會員:顯示升等提示
 */
export function MemberOfferCard({ member }: Props) {
  if (!member) {
    return (
      <div className="mx-4 mt-2 rounded-2xl bg-orange-50 border-2 border-orange-200 p-4">
        <div className="text-sm text-ink-700 mb-1">會員專屬優惠</div>
        <div className="text-lg font-bold text-ink-900 mb-3">登入會員享優惠</div>
        <Link
          to="/login"
          className="block w-full bg-brand-500 text-white text-center rounded-xl py-3 font-bold active:scale-[.98] transition-transform"
        >
          立即登入
        </Link>
      </div>
    );
  }

  const isVip = member.tier === 'GOLD' || member.tier === 'PLATINUM';

  if (isVip) {
    return (
      <div className="mx-4 mt-2 rounded-2xl bg-gradient-to-r from-brand-500 to-[#FFB627] p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">👑</span>
          <span className="text-sm opacity-90">VIP 會員獨享</span>
        </div>
        <div className="text-2xl font-bold mb-3">9 折優惠</div>
        <Link
          to="/member/coupons"
          className="block w-full bg-white text-brand-500 text-center rounded-xl py-2.5 font-bold text-sm active:scale-[.98] transition-transform"
        >
          查看優惠券 →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2 rounded-2xl bg-ink-100 p-4">
      <div className="text-sm text-ink-500 mb-1">一般會員</div>
      <div className="text-base font-bold text-ink-900 mb-1">累積消費升等 VIP</div>
      <div className="text-xs text-ink-500">目前 {member.points} 點 ・ 再累積 {Math.max(0, 1000 - member.points)} 點升等</div>
    </div>
  );
}
