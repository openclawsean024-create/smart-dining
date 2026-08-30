import type { FastifyPluginAsync } from 'fastify';
import { getOTPProvider } from '../../lib/verifyCode.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/login', async (request, reply) => {
    const { phone } = request.body as { phone: string };
    if (!phone) return reply.code(400).send({ error: 'phone required' });

    const provider = getOTPProvider();
    const result = await provider.send(phone);

    return {
      // In dev/mock mode the provider surfaces the code via `devHint` so
      // local testing stays trivial. Real SMS providers (Twilio etc.) will
      // not set `devHint`, so `code` will be `undefined` in production.
      code: result.devHint,
      message: 'Verification code sent',
    };
  });

  app.post('/api/auth/verify', async (request, reply) => {
    const { phone, code } = request.body as { phone: string; code: string };
    const provider = getOTPProvider();
    const ok = await provider.verify(phone, code);
    if (!ok) return reply.code(401).send({ error: 'Invalid code' });

    const member = await app.prisma.member.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });
    const token = await reply.jwtSign({
      sub: member.id,
      phone: member.phone,
      tier: member.tier,
    });
    return { token, member };
  });
};

export default authRoutes;
