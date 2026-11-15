import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export interface PrismaPluginOptions {
  /** 覆寫連線字串；未指定時由 Prisma 讀取環境變數 DATABASE_URL。 */
  databaseUrl?: string;
}

export default fp<PrismaPluginOptions>(async (app, opts) => {
  const prisma = opts.databaseUrl
    ? new PrismaClient({ datasourceUrl: opts.databaseUrl })
    : new PrismaClient();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => prisma.$disconnect());
});
