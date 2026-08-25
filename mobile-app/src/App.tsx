import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { TrackPage } from './pages/TrackPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { LoginPage } from './pages/LoginPage';
import { MemberPage } from './pages/MemberPage';
import { CouponsPage } from './pages/CouponsPage';
import { HistoryPage } from './pages/HistoryPage';
import { BottomNav } from './components/BottomNav';
import { MemberRequired } from './components/MemberRequired';
import { useAuthStore } from './store/authStore';
import { setAuthTokenGetter } from './api/client';

export function App() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setAuthTokenGetter(() => useAuthStore.getState().token);
  }, []);

  useEffect(() => {
    // 當 token 變動時(背景同步機制可在此擴充)
    document.documentElement.dataset.authed = token ? '1' : '0';
  }, [token]);

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 5_000,
      }}
    >
      <BrowserRouter>
        <div className="min-h-screen bg-ink-100">
          <Routes>
            <Route path="/" element={<TrackPage />} />
            <Route path="/track/:orderNo" element={<OrderDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/member"
              element={
                <MemberRequired>
                  <MemberPage />
                </MemberRequired>
              }
            />
            <Route
              path="/member/coupons"
              element={
                <MemberRequired>
                  <CouponsPage />
                </MemberRequired>
              }
            />
            <Route
              path="/history"
              element={
                <MemberRequired>
                  <HistoryPage />
                </MemberRequired>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </SWRConfig>
  );
}
