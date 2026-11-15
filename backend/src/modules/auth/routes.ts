import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getOTPProvider } from '../../lib/verifyCode.js';
import { parseOr400 } from '../../lib/http.js';
import { MEMBER_TOKEN_TTL } from '../../plugins/auth.js';

const phoneSchema = z.string().trim().regex(/^09\d{8}$/, 'phone must be a 10-digit mobile number');
const loginSchema = z.object({ phone: phoneSchema });
const verifySchema = z.object({ phone: phoneSchema, code: z.string().min(1).max(12) });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/login', async (request, reply) => {
    const body = parseOr400(loginSchema, request.body, reply);
    if (!body) return;

    const provider = getOTPProvider();
    const result = await provider.send(body.phone);

    return {
      // In dev/mock mode the provider surfaces the code via `devHint` so
      // local testing stays trivial. Real SMS providers (Twilio etc.) will
      // not set `devHint`, so `code` will be `undefined` in production.
      code: result.devHint,
      message: 'Verification code sent',
    };
  });

  app.post('/api/auth/verify', async (request, reply) => {
    const body = parseOr400(verifySchema, request.body, reply);
    if (!body) return;
    const provider = getOTPProvider();
    const ok = await provider.verify(body.phone, body.code);
    if (!ok) return reply.code(401).send({ error: 'Invalid code' });

    const member = await app.prisma.member.upsert({
      where: { phone: body.phone },
      update: {},
      create: { phone: body.phone },
    });
    const token = await reply.jwtSign(
      { kind: 'member', sub: member.id, phone: member.phone, tier: member.tier },
      { expiresIn: MEMBER_TOKEN_TTL },
    );
    return { token, member };
  });
};

export default authRoutes;
