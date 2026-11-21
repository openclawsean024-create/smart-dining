/**
 * AC-005 E2E：後台下架 → KIOSK 菜單不顯示；新增品項 → KIOSK 菜單顯示。
 */
import { expect, test, type Page } from '@playwright/test';
import { KIOSK_URL, STAFF, staffLogin } from './helpers';

const BUBBLE_TEA = 'item-bubble-tea'; // seed 的「珍珠奶茶」（飲料分類）

/** KIOSK 首頁切到「飲品」分類。 */
async function openDrinks(page: Page) {
  await page.goto(KIOSK_URL + '/');
  await page.getByRole('button', { name: /飲品/ }).click();
  await expect(page.getByRole('heading', { name: '飲料' })).toBeVisible();
}

test('AC-005 後台下架 → KIOSK 菜單不顯示；重新上架後恢復', async ({ browser }) => {
  const kioskContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const kiosk = await kioskContext.newPage();
  await openDrinks(kiosk);
  await expect(kiosk.getByRole('button', { name: /珍珠奶茶/ })).toBeVisible();

  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const admin = await adminContext.newPage();
  await admin.goto(KIOSK_URL + '/admin/menu');
  await staffLogin(admin, STAFF.manager);
  await expect(admin.getByTestId(`menu-status-${BUBBLE_TEA}`)).toHaveText('上架');
  await admin.getByTestId(`menu-toggle-${BUBBLE_TEA}`).click();
  await expect(admin.getByTestId(`menu-status-${BUBBLE_TEA}`)).toHaveText('下架');

  // KIOSK 重新載入菜單後不再顯示
  await openDrinks(kiosk);
  await expect(kiosk.getByRole('button', { name: /可樂/ })).toBeVisible();
  await expect(kiosk.getByRole('button', { name: /珍珠奶茶/ })).toHaveCount(0);

  // 重新上架
  await admin.getByTestId(`menu-toggle-${BUBBLE_TEA}`).click();
  await expect(admin.getByTestId(`menu-status-${BUBBLE_TEA}`)).toHaveText('上架');
  await openDrinks(kiosk);
  await expect(kiosk.getByRole('button', { name: /珍珠奶茶/ })).toBeVisible();

  await kioskContext.close();
  await adminContext.close();
});

test('AC-005 後台新增品項 → KIOSK 菜單顯示；庫存設 0 → 不顯示', async ({ browser }) => {
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const admin = await adminContext.newPage();
  await admin.goto(KIOSK_URL + '/admin/menu');
  await staffLogin(admin, STAFF.manager);

  await admin.getByTestId('menu-new').click();
  await admin.getByTestId('menu-form-name').fill('測試檸檬茶');
  await admin.getByTestId('menu-form-category').selectOption({ label: '飲料' });
  await admin.getByTestId('menu-form-price').fill('45');
  await admin.getByTestId('menu-form-cost').fill('15');
  await admin.getByTestId('menu-form-stock').fill('8');
  await admin.getByTestId('menu-form-save').click();
  const row = admin.getByTestId('menu-table').locator('tr', { hasText: '測試檸檬茶' });
  await expect(row).toContainText('NT$ 45');
  await expect(row).toContainText('66.7%');

  const kioskContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const kiosk = await kioskContext.newPage();
  await openDrinks(kiosk);
  await expect(kiosk.getByRole('button', { name: /測試檸檬茶/ })).toBeVisible();

  // 庫存改成 0 → KIOSK 不顯示
  await row.getByRole('button', { name: '編輯' }).click();
  await admin.getByTestId('menu-form-stock').fill('0');
  await admin.getByTestId('menu-form-save').click();
  await expect(row).toContainText('低庫存');
  await openDrinks(kiosk);
  await expect(kiosk.getByRole('button', { name: /可樂/ })).toBeVisible();
  await expect(kiosk.getByRole('button', { name: /測試檸檬茶/ })).toHaveCount(0);

  await kioskContext.close();
  await adminContext.close();
});
