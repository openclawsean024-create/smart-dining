import type { FastifyPluginAsync } from 'fastify';
import { ACTIVE_ORDER_STATUSES } from '../../../../shared-contracts/src/index.js';
import { getNextStage, type ProgressStage } from '../../../../shared-contracts/src/realtime/stages.js';
import { broadcastStatusChange } from '../../lib/orderEvents.js';
import { serializeOrder } from '../../lib/orderSerializer.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/admin/orders（AC-004 / FR-061）
   * 進行中訂單（QUEUED～READY），依建立時間由舊到新；給後台與 KDS 使用。
   * 任何員工角色皆可查看；回應不含會員手機等個資。
   * serverTime 讓前端計算等待時間時不受裝置時鐘誤差影響。
   */
  app.get('/api/admin/orders', { preHandler: app.requireStaff() }, async () => {
    const orders = await app.prisma.order.findMany({
      where: { status: { in: [...ACTIVE_ORDER_STATUSES] } },
      orderBy: [{ createdAt: 'asc' }, { orderNo: 'asc' }],
      include: { items: true },
    });
    return {
      orders: orders.map((o) => ({
        ...serializeOrder(o),
        itemSummary: o.items.map((it) => `${it.name} x ${it.quantity}`).join(' · '),
      })),
      serverTime: new Date().toISOString(),
    };
  });

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

      const current = await app.prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
      if (!current) return reply.code(404).send({ error: 'order not found' });

      const next = getNextStage(current.status as ProgressStage);
      if (!next) {
        return { order: serializeOrder(current), advanced: false, reason: 'order already ' + current.status };
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
      return { order: serializeOrder(order), advanced: true, previousStatus: current.status, newStatus: next };
    },
  );
};

export default adminRoutes;
