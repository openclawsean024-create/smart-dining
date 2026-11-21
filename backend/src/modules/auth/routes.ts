import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getOTPProvider, type OTPProvider } from '../../lib/verifyCode.js';

function request_log(app: FastifyInstance, e: unknown) {
  app.log.warn({ err: e }, '[OTP] member login unavailable');
}
import { parseOr400 } from '../../lib/http.js';
import { MEMBER_TOKEN_TTL } from '../../plugins/auth.js';

const phoneSchema = z.string().trim().regex(/^09\d{8}$/, 'phone must be a 10-digit mobile number');
const loginSchema = z.object({ phone: phoneSchema });
const verifySchema = z.object({ phone: phoneSchema, code: z.string().min(1).max(12) });

/**
 * 是否在 login 回應中附上驗證碼提示：只有明確設定 OTP_EXPOSE_HINT=1（本機開發、自動化測試）
 * 且不是正式環境時才回傳。staging／demo 站預設不回傳，否則任何人都能取得任一手機的驗證碼。
 */
export function shouldExposeOtpHint(): boolean {
  return process.env.OTP_EXPOSE_HINT === '1' && process.env.NODE_ENV !== 'production';
}

const LOGIN_UNAVAILABLE = { error: 'member login is not available', code: 'OTP_UNAVAILABLE' };

export const authRoutes: FastifyPluginAsync = async (app) => {
  /** 取得 OTP provider；設定不允許（例如正式環境尚未接真實簡訊）時回 503，不影響其他 API。 */
  function providerOr503(reply: FastifyReply): OTPProvider | undefined {
    try {
      return getOTPProvider();
    } catch (e) {
      request_log(app, e);
      void reply.code(503).send(LOGIN_UNAVAILABLE);
      return undefined;
    }
  }

  app.post('/api/auth/login', async (request, reply) => {
    const body = parseOr400(loginSchema, request.body, reply);
    if (!body) return;

    const provider = providerOr503(reply);
    if (!provider) return;
    const result = await provider.send(body.phone);

    return {
      code: shouldExposeOtpHint() ? result.devHint : undefined,
      message: 'Verification code sent',
    };
  });

  app.post('/api/auth/verify', async (request, reply) => {
    const body = parseOr400(verifySchema, request.body, reply);
    if (!body) return;
    const provider = providerOr503(reply);
    if (!provider) return;
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
