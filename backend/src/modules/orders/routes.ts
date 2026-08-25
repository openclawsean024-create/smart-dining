import type { FastifyPluginAsync } from 'fastify';
import { nextPickupNumber } from '../../lib/pickupNumber.js';
import { generateOrderNo } from '../../lib/orderNo.js';
import { orderRoom } from '../../../../shared-contracts/src/realtime/events.js';
import { PROGRESS_STAGE_MAP, getNextStage } from '../../../../shared-contracts/src/realtime/stages.js';
const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/orders', async (request, reply) => {
    const { cart, memberId, couponCode } = request.body as any;
    if (!cart?.items?.length) return reply.code(400).send({ error: 'cart required' });
    const ids = cart.items.map((x: any) => x.menuItemId);
    const menu = await app.prisma.menuItem.findMany({ where: { id: { in: ids }, available: true } });
    if (menu.length !== new Set(ids).size) return reply.code(400).send({ error: 'invalid menu item' });
    const byId = new Map(menu.map((x) => [x.id, x]));
    let subtotal = 0;
    const lines = cart.items.map((x: any) => {
      const base = byId.get(x.menuItemId)!;
      const unitPrice = base.basePrice;
      subtotal += unitPrice * x.quantity;
      return { menuItemId: x.menuItemId, name: x.name, quantity: x.quantity, unitPrice, customizations: JSON.stringify(x.customizations ?? []), subtotal: unitPrice * x.quantity };
    });
    let discount = 0;
    let coupon: Awaited<ReturnType<typeof app.prisma.coupon.findUnique>>;
    if (couponCode) {
      coupon = await app.prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || coupon.usedAt || coupon.expiresAt < new Date()) return reply.code(400).send({ error: 'invalid coupon' });
      discount = coupon.type === 'PERCENTAGE' ? subtotal * coupon.value / 100 : Math.min(subtotal, coupon.value);
    }
    const orderNo = await generateOrderNo(app.prisma);
    const pickupNumber = await nextPickupNumber(app.prisma);
    const order = await app.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: { orderNo, memberId, totalAmount: subtotal - discount, subtotal, discount, pickupNumber, estimatedReadyAt: new Date(Date.now() + 195000), items: { create: lines }, statusLogs: { create: { status: 'QUEUED', changedBy: 'system' } } } });
      if (coupon) await tx.coupon.update({ where: { id: coupon.id }, data: { usedAt: new Date() } });
      if (memberId) await tx.member.update({ where: { id: memberId }, data: { points: { increment: Math.floor(subtotal) } } });
      return created;
    });
    return reply.code(201).send({ order });
  });
  app.get('/api/orders/:orderNo', async (request, reply) => {
    const { orderNo } = request.params as any;
    const order = await app.prisma.order.findUnique({ where: { orderNo }, include: { items: true, statusLogs: { orderBy: { changedAt: 'asc' } } } });
    if (!order) return reply.code(404).send({ error: 'not found' });
    return { order };
  });
  app.get('/api/orders/member/:memberId', async (request) => {
    const { memberId } = request.params as any;
    const limit = Math.min(Number((request.query as any).limit ?? 20), 100);
    const orders = await app.prisma.order.findMany({ where: { memberId }, orderBy: { createdAt: 'desc' }, take: limit, include: { items: true, statusLogs: true } });
    return { orders };
  });
  app.patch('/api/orders/:orderNo/status', async (request, reply) => {
    const { orderNo } = request.params as any;
    const { status, changedBy } = request.body as any;
    const updateData: any = { status };
    if (status === 'COMPLETED') updateData.completedAt = new Date();
    const order = await app.prisma.order.update({ where: { orderNo }, data: updateData, include: { items: true, statusLogs: true } });
    await app.prisma.orderStatusLog.create({ data: { orderId: order.id, status, changedBy } });
    const timestamp = new Date().toISOString();
    app.io.of('/tracking').to(orderRoom(orderNo)).emit('order:statusChanged', { orderNo, status, pickupNumber: order.pickupNumber, timestamp, stage: status });
    if (['PREPARING', 'COOKING', 'PLATING'].includes(status)) {
      const meta = PROGRESS_STAGE_MAP[status as keyof typeof PROGRESS_STAGE_MAP];
      app.io.of('/tracking').to(orderRoom(orderNo)).emit('order:progress', { orderNo, stage: status, percentage: meta.percentage, estimatedReadyAt: order.estimatedReadyAt.toISOString() });
    }
    if (status === 'READY') app.io.of('/tracking').to(orderRoom(orderNo)).emit('order:ready', { orderNo, pickupNumber: order.pickupNumber, timestamp });
  return { order };
  });
};
export default orderRoutes;
