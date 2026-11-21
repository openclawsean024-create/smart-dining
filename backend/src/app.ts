import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import socketPlugin from './plugins/socket.js';
import authRoutes from './modules/auth/routes.js';
import staffRoutes from './modules/staff/routes.js';
import menuRoutes from './modules/menu/routes.js';
import orderRoutes from './modules/orders/routes.js';
import memberRoutes from './modules/members/routes.js';
import adminRoutes from './modules/admin/routes.js';
import adminMenuRoutes from './modules/admin/menuRoutes.js';
import { getOTPProvider } from './lib/verifyCode.js';

export interface BuildAppOptions {
  /** 關閉 logger（測試用）。預設開啟。 */
  logger?: boolean;
  /** 覆寫資料庫連線（測試用的獨立 SQLite 檔）。未指定時使用環境變數 DATABASE_URL。 */
  databaseUrl?: string;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  // 在 Railway 等反向代理之後才信任 X-Forwarded-For（員工登入的 IP 限制要用到真實 IP）
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: env.TRUST_PROXY });
  // OTP 設定錯誤（例如正式環境尚未接真實簡訊）只停用會員登入（/api/auth/* 回 503），
  // 不讓整個後端起不來；啟動時先記錄警告方便發現。
  try {
    getOTPProvider();
  } catch (e) {
    app.log.warn({ err: e }, '[OTP] member login disabled');
  }
  await app.register(cors, { origin: env.CORS_ORIGIN.split(',') });
  await app.register(prismaPlugin, { databaseUrl: opts.databaseUrl });
  await app.register(authPlugin);
  await app.register(socketPlugin);
  await app.register(authRoutes);
  await app.register(staffRoutes);
  await app.register(menuRoutes);
  await app.register(orderRoutes);
  await app.register(memberRoutes);
  await app.register(adminRoutes);
  await app.register(adminMenuRoutes);
  app.get('/healthz', async () => ({ ok: true }));
  return app;
}
