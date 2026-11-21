/**
 * Vitest globalSetup — 建立測試用 SQLite 範本資料庫（空資料、最新 schema）。
 * 每個整合測試再複製一份，彼此不共用資料。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { BACKEND_ROOT, REPO_ROOT, TEST_DB_DIR, TEMPLATE_DB_PATH } from './paths.js';

export default function setup() {
  rmSync(TEST_DB_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DB_DIR, { recursive: true });
  const prismaBin = resolve(REPO_ROOT, 'node_modules', '.bin', 'prisma');
  execFileSync(prismaBin, ['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: 'file:' + TEMPLATE_DB_PATH },
    stdio: 'pipe',
  });
  return () => {
    rmSync(TEST_DB_DIR, { recursive: true, force: true });
  };
}
