import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Node 25 以上內建一個（未指定檔案時不可用的）globalThis.localStorage，
 * 會蓋掉 jsdom 提供的實作；這裡改回 jsdom 視窗的 localStorage，讓測試在 Node 20～26 行為一致。
 */
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow && !globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomWindow.localStorage,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});
