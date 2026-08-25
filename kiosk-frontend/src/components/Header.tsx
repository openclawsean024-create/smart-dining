import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

interface HeaderProps {
  /** 是否顯示返回首頁連結(預設顯示) */
  showHomeLink?: boolean;
}

export function Header({ showHomeLink = true }: HeaderProps) {
  const itemCount = useCartStore((s) => s.getItemCount());

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6 h-16 flex-shrink-0 no-print">
      <div className="flex items-center gap-4">
        {showHomeLink && (
          <Link
            to="/"
            className="flex items-center gap-2 btn-press focus:outline-none"
            aria-label="回首頁"
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black text-xl">
              餐
            </div>
            <span className="font-black text-2xl text-gray-900">餐飲點餐快手</span>
          </Link>
        )}
      </div>

      <Link
        to="/cart"
        className="relative flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 btn-press"
        aria-label={'購物車,共 ' + itemCount + ' 項'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="font-bold text-gray-700 text-lg hidden md:inline">購物車</span>
        {itemCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[28px] h-7 px-2 rounded-full bg-primary text-white text-base font-black flex items-center justify-center shadow"
            aria-hidden="true"
          >
            {itemCount}
          </span>
        )}
      </Link>
    </header>
  );
}
