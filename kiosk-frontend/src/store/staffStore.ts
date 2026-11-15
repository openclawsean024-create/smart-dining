/**
 * staffStore — 員工登入狀態（AC-011）。
 *
 * 只保存員工 JWT 與公開的員工資料（不含密碼）；放在 sessionStorage，關閉分頁即登出。
 * 後台、KDS、菜單管理的 API 都以這個 token 呼叫。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Staff } from '@smart-dining/contracts';

interface StaffState {
  token: string | null;
  staff: Staff | null;
  setSession: (token: string, staff: Staff) => void;
  clear: () => void;
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set) => ({
      token: null,
      staff: null,
      setSession: (token, staff) => set({ token, staff }),
      clear: () => set({ token: null, staff: null }),
    }),
    {
      name: 'kiosk-staff-session-v1',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
