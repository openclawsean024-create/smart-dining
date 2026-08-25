import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Tab {
  to: string;
  label: string;
  icon: JSX.Element;
  match?: (path: string) => boolean;
}

const trackTab: Tab = {
  to: '/',
  label: '追蹤',
  icon: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  match: (p) => p === '/' || p.startsWith('/track') || p.startsWith('/order'),
};

const memberTab: Tab = {
  to: '/member',
  label: '會員',
  icon: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  match: (p) => p.startsWith('/member'),
};

const historyTab: Tab = {
  to: '/history',
  label: '訂單',
  icon: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  ),
  match: (p) => p.startsWith('/history'),
};

export function BottomNav() {
  const location = useLocation();
  const isLoggedIn = useAuthStore((s) => Boolean(s.token && s.member));
  const tabs: Tab[] = [trackTab, memberTab, historyTab];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-ink-100 bg-white/95 backdrop-blur pb-safe"
      aria-label="主要導覽"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.match ? tab.match(location.pathname) : false;
          const requiresAuth = tab.to !== '/' && tab.to !== '/track';
          const disabled = requiresAuth && !isLoggedIn;
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={disabled ? '/login' : tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors',
                    active || isActive ? 'text-brand-500' : 'text-ink-500',
                    disabled ? 'opacity-50' : '',
                  ].join(' ')
                }
                aria-current={active ? 'page' : undefined}
              >
                <span>{tab.icon}</span>
                <span className="leading-none">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
