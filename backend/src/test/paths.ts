import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = resolve(here, '..', '..');
export const REPO_ROOT = resolve(BACKEND_ROOT, '..');
/** 測試用 SQLite 檔所在目錄（已列入 .gitignore）。 */
export const TEST_DB_DIR = resolve(BACKEND_ROOT, '.test-db');
/** globalSetup 以 prisma db push 建好 schema 的空白範本，每個測試 app 複製一份使用。 */
export const TEMPLATE_DB_PATH = resolve(TEST_DB_DIR, 'template.db');
