/**
 * 員工登入（AC-011 / FR-067）。
 * 密碼以 bcrypt 雜湊比對；回應永遠不包含 passwordHash。
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Staff, StaffRole } from '../../../../shared-contracts/src/index.js';
import { parseOr400 } from '../../lib/http.js';
import { getDummyHash, verifyPassword } from '../../lib/password.js';
import { LoginThrottle } from '../../lib/loginThrottle.js';
import { STAFF_TOKEN_TTL } from '../../plugins/auth.js';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export function toPublicStaff(s: { id: string; username: string; name: string; role: string }): Staff {
  return { id: s.id, username: s.username, name: s.name, role: s.role as StaffRole };
}

const staffRoutes: FastifyPluginAsync = async (app) => {
  const throttle = new LoginThrottle();

  app.post('/api/staff/login', async (request, reply) => {
    const body = parseOr400(loginSchema, request.body, reply);
    if (!body) return;
    const key = body.username.toLowerCase();
    if (throttle.isBlocked(key)) {
      return reply.code(429).send({ error: 'too many failed attempts, try again later' });
    }

    const staff = await app.prisma.staff.findUnique({ where: { username: body.username } });
    // 帳號不存在時仍做一次比對，避免由回應時間判斷帳號是否存在。
    const ok = await verifyPassword(body.password, staff?.passwordHash ?? (await getDummyHash()));
    if (!staff || !staff.active || !ok) {
      throttle.recordFailure(key);
      return reply.code(401).send({ error: 'invalid credentials' });
    }
    throttle.recordSuccess(key);

    const token = await reply.jwtSign(
      { kind: 'staff', sub: staff.id, role: staff.role as StaffRole, name: staff.name },
      { expiresIn: STAFF_TOKEN_TTL },
    );
    return { token, staff: toPublicStaff(staff) };
  });

  app.get('/api/staff/me', { preHandler: app.requireStaff() }, async (request, reply) => {
    const staff = await app.prisma.staff.findUnique({ where: { id: request.user.sub } });
    if (!staff) return reply.code(401).send({ error: 'Unauthorized' });
    return { staff: toPublicStaff(staff) };
  });
};

export default staffRoutes;
