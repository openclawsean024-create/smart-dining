import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import socketPlugin from './plugins/socket.js';
import authRoutes from './modules/auth/routes.js';
import menuRoutes from './modules/menu/routes.js';
import orderRoutes from './modules/orders/routes.js';
import memberRoutes from './modules/members/routes.js';
import adminRoutes from './modules/admin/routes.js';

export interface BuildAppOptions {
  /** 關閉 logger（測試用）。預設開啟。 */
  logger?: boolean;
  /** 覆寫資料庫連線（測試用的獨立 SQLite 檔）。未指定時使用環境變數 DATABASE_URL。 */
  databaseUrl?: string;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });
  await app.register(cors, { origin: env.CORS_ORIGIN.split(',') });
  await app.register(prismaPlugin, { databaseUrl: opts.databaseUrl });
  await app.register(authPlugin);
  await app.register(socketPlugin);
  await app.register(authRoutes);
  await app.register(menuRoutes);
  await app.register(orderRoutes);
  await app.register(memberRoutes);
  await app.register(adminRoutes);
  app.get('/healthz', async () => ({ ok: true }));
  return app;
}
