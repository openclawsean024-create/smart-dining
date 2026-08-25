/**
 * App — routes
 *
 * 路由:
 *   /                → DashboardPage(主畫面,3 欄 + 底部客製化 + checkout/pickup modal)
 *   /checkout        → CheckoutPage(也作為 modal 開啟,當 modal 開啟時顯示)
 *   /complete/:orderNo → CompletePage
 *   /admin           → AdminPanel(門市端推進狀態,測試用)
 *   *                → NotFoundPage
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CompletePage } from './pages/CompletePage';
import { AdminPanel } from './pages/AdminPanel';
import { NotFoundPage } from './pages/NotFoundPage';
import { PickupModal } from './components/PickupModal';
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

export default function App() {
  return (
    <BrowserRouter>
      {/* 全域 modal:PickupModal 與 CheckoutModal 本身依 store 自動 mount */}
      <PickupModal />
      <CheckoutPage />
      <CheckoutRouteListener />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/checkout" element={<DashboardPage />} />
        <Route path="/complete/:orderNo" element={<CompletePage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
