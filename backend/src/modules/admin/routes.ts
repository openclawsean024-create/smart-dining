import type { FastifyPluginAsync } from 'fastify';
import { getNextStage, type ProgressStage } from '../../../../shared-contracts/src/realtime/stages.js';
import { broadcastStatusChange } from '../../lib/orderEvents.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/admin/orders/:orderNo/advance
   * 內場／店長推進訂單到下一階段（QUEUED → PREPARING → COOKING → PLATING → READY）。
   * 需員工 JWT（AC-011）；寫 OrderStatusLog 並廣播 WebSocket 事件。
   */
  app.post(
    '/api/admin/orders/:orderNo/advance',
    { preHandler: app.requireStaff('MANAGER', 'KITCHEN') },
    async (request, reply) => {
      const { orderNo } = request.params as { orderNo: string };

      const current = await app.prisma.order.findUnique({ where: { orderNo } });
      if (!current) return reply.code(404).send({ error: 'order not found' });

      const next = getNextStage(current.status as ProgressStage);
      if (!next) {
        return { order: current, advanced: false, reason: 'order already ' + current.status };
      }

      const order = await app.prisma.$transaction(async (tx) => {
        await tx.orderStatusLog.create({
          data: { orderId: current.id, status: next, changedBy: 'staff:' + request.user.sub },
        });
        return tx.order.update({
          where: { orderNo },
          data: { status: next },
          include: { items: true, statusLogs: true },
        });
      });

      broadcastStatusChange(app, order, next);
      return { order, advanced: true, previousStatus: current.status, newStatus: next };
    },
  );
};

export default adminRoutes;
