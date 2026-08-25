import type { FastifyPluginAsync } from 'fastify';
import { PROGRESS_STAGE_MAP, getNextStage } from '../../../../shared-contracts/src/realtime/stages.js';
import { orderRoom } from '../../../../shared-contracts/src/realtime/events.js';

const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/admin/orders/:orderNo/advance
   * 門市出餐人員推進訂單到下一階段(QUEUED → PREPARING → COOKING → PLATING → READY)
   * 同時:寫 OrderStatusLog、廣播 WebSocket 三個事件(order:statusChanged / order:progress / order:ready)
   */
  app.post('/api/admin/orders/:orderNo/advance', async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string };

    const current = await app.prisma.order.findUnique({ where: { orderNo } });
    if (!current) return reply.code(404).send({ error: 'order not found' });
    if (current.status === 'READY' || current.status === 'CANCELLED') {
      return { order: current, advanced: false, reason: 'order already ' + current.status };
    }

    const next = getNextStage(current.status as any);
    if (!next) return { order: current, advanced: false, reason: 'no next stage' };

    // 更新狀態(本端點只推進 QUEUED → READY 五個製作階段,不處理 COMPLETED)
    const updateData: any = { status: next };

    const order = await app.prisma.order.update({
      where: { orderNo },
      data: updateData,
      include: { items: true, statusLogs: true },
    });

    // 寫 OrderStatusLog(明確分開寫,避免 Prisma nested write 的 P2025)
    await app.prisma.orderStatusLog.create({
      data: { orderId: order.id, status: next, changedBy: 'admin' },
    });

    // 廣播 WebSocket 事件到對應訂單房間
    const timestamp = new Date().toISOString();
    const io = app.io.of('/tracking');
    const room = orderRoom(orderNo);

    // 1. order:statusChanged — 所有狀態變更都發
    io.to(room).emit('order:statusChanged', {
      orderNo,
      status: next,
      pickupNumber: order.pickupNumber,
      timestamp,
      stage: next,
    });

    // 2. order:progress — 中間階段發
    if (['PREPARING', 'COOKING', 'PLATING', 'READY'].includes(next)) {
      const meta = PROGRESS_STAGE_MAP[next as keyof typeof PROGRESS_STAGE_MAP];
      io.to(room).emit('order:progress', {
        orderNo,
        stage: next,
        percentage: meta.percentage,
        estimatedReadyAt: order.estimatedReadyAt.toISOString(),
      });
    }

    // 3. order:ready — READY 時觸發
    if (next === 'READY') {
      io.to(room).emit('order:ready', {
        orderNo,
        pickupNumber: order.pickupNumber,
        timestamp,
      });
    }

    return { order, advanced: true, previousStatus: current.status, newStatus: next };
  });
};

export default adminRoutes;
