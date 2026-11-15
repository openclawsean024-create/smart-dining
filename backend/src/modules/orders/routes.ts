import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { OrderStatus, StaffRole } from '../../../../shared-contracts/src/index.js';
import { nextPickupNumber } from '../../lib/pickupNumber.js';
import { generateOrderNo } from '../../lib/orderNo.js';
import { broadcastStatusChange } from '../../lib/orderEvents.js';
import { parseOr400 } from '../../lib/http.js';
import { isStaffClaims } from '../../plugins/auth.js';

const ORDER_STATUSES = ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY', 'COMPLETED', 'CANCELLED'] as const;

const updateStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

/**
 * 各角色可以設定的訂單狀態（AC-011）：
 *   - 店長：全部
 *   - 內場：製作階段（QUEUED～READY）
 *   - 收銀：交付（COMPLETED）與取消（CANCELLED）
 */
const STATUS_BY_ROLE: Record<StaffRole, readonly OrderStatus[]> = {
  MANAGER: ORDER_STATUSES,
  KITCHEN: ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY'],
  CASHIER: ['COMPLETED', 'CANCELLED'],
};

const orderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * 下單時的會員身分（AC-011）：memberId 只能來自會員 JWT，不能由 body 任意指定。
   * 回傳 undefined 表示已回應錯誤；null 表示訪客訂單。
   */
  async function resolveOrderMember(
    request: FastifyRequest,
    reply: FastifyReply,
    bodyMemberId: unknown,
  ): Promise<string | null | undefined> {
    let tokenMemberId: string | null = null;
    if (request.headers.authorization) {
      try {
        await request.jwtVerify();
      } catch {
        await reply.code(401).send({ error: 'Unauthorized' });
        return undefined;
      }
      if (!isStaffClaims(request.user)) tokenMemberId = request.user.sub;
    }
    if (bodyMemberId != null && bodyMemberId !== '') {
      if (!tokenMemberId) {
        await reply.code(request.headers.authorization ? 403 : 401).send({ error: 'member login required to attach memberId' });
        return undefined;
      }
      if (bodyMemberId !== tokenMemberId) {
        await reply.code(403).send({ error: 'Forbidden: memberId does not match token' });
        return undefined;
      }
    }
    return tokenMemberId;
  }

  app.post('/api/orders', async (request, reply) => {
    const { cart, memberId: bodyMemberId, couponCode } = (request.body ?? {}) as any;
    if (!cart?.items?.length) return reply.code(400).send({ error: 'cart required' });

    const memberId = await resolveOrderMember(request, reply, bodyMemberId);
    if (memberId === undefined) return;

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
    let coupon: Awaited<ReturnType<typeof app.prisma.coupon.findUnique>> = null;
    if (couponCode) {
      coupon = await app.prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || coupon.usedAt || coupon.expiresAt < new Date()) return reply.code(400).send({ error: 'invalid coupon' });
      // 綁定會員的優惠券只能由該會員本人使用（AC-011）。
      if (coupon.memberId && coupon.memberId !== memberId) return reply.code(400).send({ error: 'invalid coupon' });
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

  // 以訂單號追蹤（顧客掃 QR 用）：公開，不含會員個資。
  app.get('/api/orders/:orderNo', async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string };
    const order = await app.prisma.order.findUnique({ where: { orderNo }, include: { items: true, statusLogs: { orderBy: { changedAt: 'asc' } } } });
    if (!order) return reply.code(404).send({ error: 'not found' });
    return { order };
  });

  // 會員歷史訂單：只允許本人或店長（AC-011）。
  app.get(
    '/api/orders/member/:memberId',
    { preHandler: app.requireMemberSelfOrStaff('memberId', 'MANAGER') },
    async (request) => {
      const { memberId } = request.params as { memberId: string };
      const rawLimit = Number((request.query as { limit?: string }).limit ?? 20);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 20;
      const orders = await app.prisma.order.findMany({ where: { memberId }, orderBy: { createdAt: 'desc' }, take: limit, include: { items: true, statusLogs: true } });
      return { orders };
    },
  );

  // 直接設定訂單狀態：需員工 JWT，且依角色限制可設定的狀態（AC-011）。
  app.patch('/api/orders/:orderNo/status', { preHandler: app.requireStaff() }, async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string };
    const body = parseOr400(updateStatusSchema, request.body, reply);
    if (!body) return;
    const user = request.user;
    if (!isStaffClaims(user) || !STATUS_BY_ROLE[user.role].includes(body.status)) {
      return reply.code(403).send({ error: 'Forbidden: role cannot set this status' });
    }

    const current = await app.prisma.order.findUnique({ where: { orderNo } });
    if (!current) return reply.code(404).send({ error: 'not found' });

    const order = await app.prisma.$transaction(async (tx) => {
      await tx.orderStatusLog.create({ data: { orderId: current.id, status: body.status, changedBy: 'staff:' + user.sub } });
      return tx.order.update({
        where: { orderNo },
        data: { status: body.status, completedAt: body.status === 'COMPLETED' ? new Date() : undefined },
        include: { items: true, statusLogs: true },
      });
    });
    broadcastStatusChange(app, order, body.status);
    return { order };
  });
};

export default orderRoutes;
