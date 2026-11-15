/**
 * Vitest setupFile — 在每個測試檔載入任何程式之前設定環境變數。
 *
 * JWT_SECRET 每次執行隨機產生，不寫入版本庫。
 * DATABASE_URL 只是為了通過 env 驗證；整合測試一律以 createTestApp() 指定獨立的 SQLite 檔。
 */
import { randomBytes } from 'node:crypto';
import { TEMPLATE_DB_PATH } from './paths.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.DATABASE_URL = 'file:' + TEMPLATE_DB_PATH;
