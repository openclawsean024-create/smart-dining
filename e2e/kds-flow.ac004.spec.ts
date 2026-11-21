/**
 * AC-004 E2E：KIOSK 下單 → KDS 推進到 READY → 手機追蹤頁顯示可取餐。
 */
import { expect, test } from '@playwright/test';
import { KIOSK_URL, MOBILE_URL, STAFF, placeKioskOrder, staffLogin } from './helpers';

test('AC-004 KIOSK 下單 → KDS 推進到 READY → 手機追蹤頁顯示可取餐', async ({ browser }) => {
  // --- KIOSK（1024×768）下單 ---
  const kioskContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const kiosk = await kioskContext.newPage();
  const orderNo = await placeKioskOrder(kiosk);

  // --- 手機（375×812）開啟追蹤頁：剛下單是排隊中 ---
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const phone = await phoneContext.newPage();
  await phone.goto(`${MOBILE_URL}/track/${encodeURIComponent(orderNo)}`);
  await expect(phone.getByText('訂單編號 ' + orderNo)).toBeVisible();
  await expect(phone.getByTestId('track-stage')).toHaveText('已成立訂單,排隊中');
  await expect(phone.getByTestId('track-percentage')).toHaveText('10%');

  // --- KDS：內場登入，看到這張單與客製化 ---
  const kdsContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const kds = await kdsContext.newPage();
  await kds.goto(KIOSK_URL + '/admin/kds');
  await staffLogin(kds, STAFF.kitchen);

  const card = kds.getByTestId(`kds-order-${orderNo}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText('經典脆雞');
  await expect(card).toContainText('x1');
  await expect(card).toContainText('白飯 / 醬油');
  await expect(kds.getByTestId(`kds-elapsed-${orderNo}`)).toContainText('剛剛');

  // --- 一鍵推進四次到 READY；手機端不重新整理，靠 Socket 事件更新 ---
  const advance = kds.getByTestId(`kds-advance-${orderNo}`);
  const steps = [
    { button: '推進 → 準備中', kdsStatus: '準備中', phoneStage: '廚房準備中', percentage: '30%' },
    { button: '推進 → 製作中', kdsStatus: '製作中', phoneStage: '製作中', percentage: '60%' },
    { button: '推進 → 盛盤中', kdsStatus: '盛盤中', phoneStage: '盛盤中', percentage: '85%' },
    { button: '推進 → 可取餐', kdsStatus: '可取餐', phoneStage: '可取餐', percentage: '100%' },
  ];
  for (const step of steps) {
    await expect(advance).toHaveText(step.button);
    await advance.click();
    await expect(kds.getByTestId(`kds-status-${orderNo}`)).toHaveText(step.kdsStatus);
    await expect(phone.getByTestId('track-stage')).toHaveText(step.phoneStage);
    await expect(phone.getByTestId('track-percentage')).toHaveText(step.percentage);
  }

  // 內場在可取餐之後不能再推進
  await expect(advance).toBeDisabled();

  await kioskContext.close();
  await phoneContext.close();
  await kdsContext.close();
});

test('AC-004 KDS 需員工登入；新訂單不需重新整理就出現在 KDS', async ({ browser }) => {
  const kdsContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const kds = await kdsContext.newPage();
  await kds.goto(KIOSK_URL + '/admin/kds');
  // 未登入只看到登入表單
  await expect(kds.getByTestId('staff-login-form')).toBeVisible();
  await expect(kds.getByTestId('kds-grid')).toHaveCount(0);
  await staffLogin(kds, STAFF.kitchen);
  await expect(kds.getByTestId('kds-grid')).toBeVisible();

  const kioskContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const kiosk = await kioskContext.newPage();
  const orderNo = await placeKioskOrder(kiosk);

  // KDS 頁面沒有重新整理；透過 /kds 通知（或輪詢備援）自動出現
  await expect(kds.getByTestId(`kds-order-${orderNo}`)).toBeVisible({ timeout: 15_000 });

  await kioskContext.close();
  await kdsContext.close();
});
