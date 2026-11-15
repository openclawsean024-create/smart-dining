/**
 * App — routes
 *
 * 路由:
 *   /                  → DashboardPage(主畫面,3 欄 + 底部客製化 + checkout/pickup modal)
 *   /checkout          → CheckoutPage(也作為 modal 開啟,當 modal 開啟時顯示)
 *   /complete/:orderNo → CompletePage
 *   /admin             → 後台(需員工登入,AC-011);預設導向 /admin/kds
 *   /admin/kds         → KdsPage 廚房顯示系統(AC-004)
 *   /admin/menu        → MenuAdminPage 菜單管理(AC-005;只有店長)
 *   *                  → NotFoundPage
 */
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CompletePage } from './pages/CompletePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { KdsPage } from './pages/admin/KdsPage';
import { MenuAdminPage } from './pages/admin/MenuAdminPage';
import { PickupModal } from './components/PickupModal';
import { RequireStaff } from './components/staff/RequireStaff';
import { useUIStore } from './store/uiStore';

/** 監聽 location,當路徑為 /checkout 時自動開啟 modal。 */
function CheckoutRouteListener() {
  const location = useLocation();
  const openCheckoutModal = useUIStore((s) => s.openCheckoutModal);
  const closeCheckoutModal = useUIStore((s) => s.closeCheckoutModal);

  useEffect(() => {
    if (location.pathname === '/checkout') {
      openCheckoutModal();
    } else if (location.pathname !== '/checkout') {
      closeCheckoutModal();
    }
  }, [location.pathname, openCheckoutModal, closeCheckoutModal]);
  return null;
}

/** 路由本體(不含 Router),測試時可包在 MemoryRouter 內。 */
export function AppRoutes() {
  return (
    <>
      {/* 全域 modal:PickupModal 與 CheckoutModal 本身依 store 自動 mount */}
      <PickupModal />
      <CheckoutPage />
      <CheckoutRouteListener />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/checkout" element={<DashboardPage />} />
        <Route path="/complete/:orderNo" element={<CompletePage />} />
        <Route
          path="/admin"
          element={
            <RequireStaff>
              <AdminLayout />
            </RequireStaff>
          }
        >
          <Route index element={<Navigate to="/admin/kds" replace />} />
          <Route path="kds" element={<KdsPage />} />
          <Route
            path="menu"
            element={
              <RequireStaff roles={['MANAGER']}>
                <MenuAdminPage />
              </RequireStaff>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
