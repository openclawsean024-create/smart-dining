/**
 * 員工帳號與角色（AC-011 / FR-067）
 */

export const STAFF_ROLES = ['MANAGER', 'CASHIER', 'KITCHEN'] as const;

/** MANAGER＝店長、CASHIER＝收銀、KITCHEN＝內場 */
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  MANAGER: '店長',
  CASHIER: '收銀',
  KITCHEN: '內場',
};

/** 對外回傳的員工資料；永遠不包含密碼雜湊。 */
export interface Staff {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
}
