/**
 * RequireStaff — 後台路由守門(AC-011)。
 *
 * - 未登入:顯示員工登入表單
 * - 已登入但角色不在允許名單:顯示「權限不足」
 * 前端只負責畫面;真正的授權由後端每支 API 的員工 JWT 與角色檢查把關。
 */
import type { ReactNode } from 'react';
import { STAFF_ROLE_LABEL } from '@smart-dining/contracts';
import type { StaffRole } from '@smart-dining/contracts';
import { useStaffStore } from '../../store/staffStore';
import { StaffLoginForm } from './StaffLoginForm';

interface RequireStaffProps {
  /** 允許的角色;未指定代表任何員工 */
  roles?: StaffRole[];
  children: ReactNode;
}

export function RequireStaff({ roles, children }: RequireStaffProps) {
  const staff = useStaffStore((s) => s.staff);
  const token = useStaffStore((s) => s.token);
  const clear = useStaffStore((s) => s.clear);

  if (!token || !staff) {
    return <StaffLoginForm />;
  }

  if (roles && roles.length > 0 && !roles.includes(staff.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" data-testid="staff-forbidden">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center border border-gray-200">
          <h1 className="font-black text-2xl text-gray-900 mb-2">權限不足</h1>
          <p className="text-gray-600 mb-6">
            目前登入的是「{STAFF_ROLE_LABEL[staff.role]}」{staff.name},這個畫面需要
            {roles.map((r) => STAFF_ROLE_LABEL[r]).join('或')}權限。
          </p>
          <button
            type="button"
            onClick={clear}
            className="h-12 px-6 rounded-xl bg-primary text-white font-black btn-press hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          >
            改用其他帳號登入
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
