/**
 * StaffLayout — 後台共用外框:導覽列(KDS／菜單管理)、目前登入的員工、登出。
 * 內容區由巢狀路由(<Outlet />)決定。
 */
import { Link, NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { STAFF_ROLE_LABEL } from '@smart-dining/contracts';
import { useStaffStore } from '../../store/staffStore';

const navClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'h-11 px-4 rounded-xl font-black flex items-center btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
    isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  );

export function StaffLayout() {
  const staff = useStaffStore((s) => s.staff);
  const clear = useStaffStore((s) => s.clear);

  return (
    <div className="h-screen w-screen bg-gray-50 overflow-y-auto">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-black text-2xl text-gray-900 mr-2">門市後台</span>
          <nav className="flex items-center gap-2" aria-label="後台導覽">
            <NavLink to="/admin/kds" className={navClass} data-testid="nav-kds">
              廚房顯示 KDS
            </NavLink>
            {staff?.role === 'MANAGER' && (
              <NavLink to="/admin/menu" className={navClass} data-testid="nav-menu">
                菜單管理
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {staff && (
            <span className="text-sm font-bold text-gray-600" data-testid="staff-badge">
              {STAFF_ROLE_LABEL[staff.role]} · {staff.name}
            </span>
          )}
          <button
            type="button"
            onClick={clear}
            className="h-11 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold btn-press focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            data-testid="staff-logout"
          >
            登出
          </button>
          <Link
            to="/"
            className="h-11 px-4 rounded-xl bg-primary text-white font-black flex items-center btn-press hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          >
            回到 KIOSK
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
