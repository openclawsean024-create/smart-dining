/**
 * 會員 API（AC-011）：只允許本人（會員 JWT）或店長存取；加點數只允許店長。
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOr400 } from '../../lib/http.js';

const addPointsSchema = z.object({
  delta: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, 'delta must not be 0'),
  reason: z.string().trim().min(1).max(200),
  orderId: z.string().min(1).optional(),
});

const memberRoutes: FastifyPluginAsync = async (app) => {
  const selfOrManager = app.requireMemberSelfOrStaff('id', 'MANAGER');

  app.get('/api/members/:id', { preHandler: selfOrManager }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const member = await app.prisma.member.findUnique({ where: { id } });
    if (!member) return reply.code(404).send({ error: 'not found' });
    return { member };
  });

  app.get('/api/members/:id/coupons', { preHandler: selfOrManager }, async (request) => {
    const { id } = request.params as { id: string };
    const coupons = await app.prisma.coupon.findMany({
      where: { memberId: id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    return { coupons };
  });

  // 手動調整點數：只有店長可以；會員不能替自己加點數。
  app.post('/api/members/:id/points/add', { preHandler: app.requireStaff('MANAGER') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseOr400(addPointsSchema, request.body, reply);
    if (!body) return;

    const existing = await app.prisma.member.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (existing.points + body.delta < 0) {
      return reply.code(400).send({ error: 'points cannot go below 0' });
    }

    const member = await app.prisma.$transaction(async (tx) => {
      await tx.pointsTransaction.create({
        data: {
          memberId: id,
          delta: body.delta,
          reason: `${body.reason} (staff:${request.user.sub})`,
          orderId: body.orderId,
        },
      });
      return tx.member.update({ where: { id }, data: { points: { increment: body.delta } } });
    });
    return { member };
  });
};

export default memberRoutes;
