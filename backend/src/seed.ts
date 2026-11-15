import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seedData.js';
import { MIN_PASSWORD_LENGTH } from './lib/password.js';

const prisma = new PrismaClient();

/**
 * 示範員工密碼（AC-011）：repo 內沒有任何預設密碼。
 * - 有設定環境變數 SEED_STAFF_PASSWORD 就使用它（不會印出來）
 * - 否則每次 seed 隨機產生一組，只在終端機顯示一次；資料庫只存 bcrypt 雜湊
 */
function resolveStaffPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SEED_STAFF_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`SEED_STAFF_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return { password: fromEnv, generated: false };
  }
  return { password: randomBytes(12).toString('base64url'), generated: true };
}

async function main() {
  console.log('🌱 Seeding smart-dining database...');
  const staff = resolveStaffPassword();
  await seedDatabase(prisma, { staffPassword: staff.password, log: (m) => console.log(m) });
  if (staff.generated) {
    console.log('🔑 本次隨機產生的示範員工密碼（只顯示這一次，三個帳號共用）：' + staff.password);
  } else {
    console.log('🔑 示範員工密碼來自環境變數 SEED_STAFF_PASSWORD（不顯示）');
  }
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
