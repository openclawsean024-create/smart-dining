import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seedData.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding smart-dining database...');
  await seedDatabase(prisma, { log: (m) => console.log(m) });
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
