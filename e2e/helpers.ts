import { expect, type Page } from '@playwright/test';

export const KIOSK_URL = process.env.E2E_KIOSK_URL!;
export const MOBILE_URL = process.env.E2E_MOBILE_URL!;
export const BACKEND_URL = process.env.E2E_BACKEND_URL!;

/** seed 建立的示範員工帳號；密碼為本次執行隨機產生（見 playwright.config.ts）。 */
export const STAFF = {
  manager: 'manager01',
  cashier: 'cashier01',
  kitchen: 'kitchen01',
} as const;

export function staffPassword(): string {
  const value = process.env.E2E_STAFF_PASSWORD;
  if (!value) throw new Error('E2E_STAFF_PASSWORD is not set');
  return value;
}

/** 在後台登入表單登入員工。 */
export async function staffLogin(page: Page, username: string): Promise<void> {
  await expect(page.getByTestId('staff-login-form')).toBeVisible();
  await page.getByTestId('staff-username').fill(username);
  await page.getByTestId('staff-password').fill(staffPassword());
  await page.getByTestId('staff-login-submit').click();
  await expect(page.getByTestId('staff-badge')).toBeVisible();
}

/**
 * 在 KIOSK 點一份「經典脆雞」（必選：主食＝白飯、醬料＝醬油）並結帳，回傳訂單號。
 */
export async function placeKioskOrder(page: Page): Promise<string> {
  await page.goto(KIOSK_URL + '/');
  await page.getByRole('button', { name: /經典脆雞/ }).first().click();

  const confirm = page.getByTestId('customize-confirm');
  await expect(confirm).toBeDisabled(); // 必選群組還沒選
  await page.getByRole('button', { name: '白飯', exact: true }).click();
  await page.getByRole('button', { name: '醬油', exact: true }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await page.getByRole('button', { name: /前往結帳/ }).click();
  await page.getByRole('button', { name: /確認結帳/ }).click();

  await page.waitForURL(/\/complete\/SD-\d{8}-\d{4}$/);
  const orderNo = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);
  await expect(page.getByText(orderNo, { exact: true })).toBeVisible();
  return orderNo;
}
