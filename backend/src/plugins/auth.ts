/**
 * JWT 驗證與授權（AC-011）。
 *
 * 兩種 token：
 *   - 會員：{ kind: 'member', sub: memberId, phone, tier }（舊 token 沒有 kind，視為會員）
 *   - 員工：{ kind: 'staff', sub: staffId, role, name }
 *
 * 提供的 preHandler：
 *   - app.authenticate                     任何有效 token
 *   - app.requireStaff(...roles)           員工 token，且角色在名單內（不給角色＝任何員工）
 *   - app.requireMemberSelfOrStaff(param, ...roles)
 *                                          本人會員（token.sub === params[param]）或指定角色的員工
 * 規則：沒有或無效 token → 401；身分或角色不符 → 403。
 */
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { JwtPayload, StaffJwtPayload, StaffRole } from '../../../shared-contracts/src/index.js';
import { env } from '../config/env.js';

export const MEMBER_TOKEN_TTL = '30d';
export const STAFF_TOKEN_TTL = '12h';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireStaff: (...roles: StaffRole[]) => preHandlerAsyncHookHandler;
    requireMemberSelfOrStaff: (param: string, ...roles: StaffRole[]) => preHandlerAsyncHookHandler;
  }
}

export function isStaffClaims(user: JwtPayload | undefined): user is StaffJwtPayload {
  return !!user && user.kind === 'staff';
}

export default fp(async (app) => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  /** 驗證 token；失敗時已回 401，回傳 false。 */
  async function verify(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    try {
      await request.jwtVerify();
      return true;
    } catch {
      await reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
  }

  /** 員工 token 另外確認帳號仍存在且啟用，角色以資料庫為準（停用或改角色立即生效）。 */
  async function loadActiveStaff(request: FastifyRequest, reply: FastifyReply): Promise<StaffRole | null> {
    const staff = await app.prisma.staff.findUnique({ where: { id: request.user.sub } });
    if (!staff || !staff.active) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return null;
    }
    return staff.role as StaffRole;
  }

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    await verify(request, reply);
  });

  app.decorate('requireStaff', (...roles: StaffRole[]): preHandlerAsyncHookHandler => {
    return async (request, reply) => {
      if (!(await verify(request, reply))) return;
      if (!isStaffClaims(request.user)) {
        await reply.code(403).send({ error: 'Forbidden: staff only' });
        return;
      }
      const role = await loadActiveStaff(request, reply);
      if (!role) return;
      if (roles.length > 0 && !roles.includes(role)) {
        await reply.code(403).send({ error: 'Forbidden: insufficient role' });
        return;
      }
      request.user.role = role;
    };
  });

  app.decorate('requireMemberSelfOrStaff', (param: string, ...roles: StaffRole[]): preHandlerAsyncHookHandler => {
    return async (request, reply) => {
      if (!(await verify(request, reply))) return;
      const user = request.user;
      if (isStaffClaims(user)) {
        const role = await loadActiveStaff(request, reply);
        if (!role) return;
        if (!roles.includes(role)) {
          await reply.code(403).send({ error: 'Forbidden: insufficient role' });
          return;
        }
        user.role = role;
        return;
      }
      const target = (request.params as Record<string, string | undefined>)[param];
      if (!target || user.sub !== target) {
        await reply.code(403).send({ error: 'Forbidden: not your account' });
      }
    };
  });
});
