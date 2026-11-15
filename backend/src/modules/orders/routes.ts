import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { OrderStatus, StaffRole } from '../../../../shared-contracts/src/index.js';
import { nextPickupNumber } from '../../lib/pickupNumber.js';
import { generateOrderNo } from '../../lib/orderNo.js';
import { broadcastStatusChange } from '../../lib/orderEvents.js';
import { parseOr400 } from '../../lib/http.js';
import { isStaffClaims } from '../../plugins/auth.js';
import { computeDiscount, MAX_LINE_QUANTITY, priceCart, PricingError } from '../../lib/pricing.js';

const ORDER_STATUSES = ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY', 'COMPLETED', 'CANCELLED'] as const;

const updateStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

/**
 * 下單 request body（AC-002）。每一行只採用 menuItemId、quantity、選項 ID；
 * 舊版前端多送的 name／unitPrice／choiceNames 會被忽略（zod 預設剝除未知欄位）。
 */
const createOrderSchema = z.object({
  cart: z.object({
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1),
          quantity: z.number().int().positive().max(MAX_LINE_QUANTITY),
          customizations: z
            .array(z.object({ groupId: z.string().min(1), choiceIds: z.array(z.string().min(1)).max(50) }))
            .max(50)
            .optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  memberId: z.string().nullish(),
  couponCode: z.string().trim().min(1).max(64).nullish(),
});

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

  /**
   * POST /api/orders — 伺服器端計價（AC-002）。
   * 只採用前端傳入的品項 ID、數量、選項 ID；價格與品名一律取自資料庫。
   */
  app.post('/api/orders', async (request, reply) => {
    const body = parseOr400(createOrderSchema, request.body, reply);
    if (!body) return;

    const memberId = await resolveOrderMember(request, reply, body.memberId);
    if (memberId === undefined) return;

    const ids = [...new Set(body.cart.items.map((x) => x.menuItemId))];
    const menuItems = await app.prisma.menuItem.findMany({
      where: { id: { in: ids } },
      include: { customizationGroups: { orderBy: { displayOrder: 'asc' }, include: { choices: true } } },
    });
    const menu = new Map(menuItems.map((m) => [m.id, m]));

    try {
      const priced = priceCart(body.cart.items, menu);

      let coupon: Awaited<ReturnType<typeof app.prisma.coupon.findUnique>> = null;
      if (body.couponCode) {
        coupon = await app.prisma.coupon.findUnique({ where: { code: body.couponCode } });
        // 優惠券以資料庫為準：不存在、已使用、過期，或綁定其他會員（AC-011）都不可用
        if (!coupon || coupon.usedAt || coupon.expiresAt < new Date() || (coupon.memberId && coupon.memberId !== memberId)) {
          throw new PricingError('COUPON_INVALID', 'invalid coupon');
        }
      }
      const discount = computeDiscount(priced.subtotal, coupon);
      const totalAmount = priced.subtotal - discount;

      const orderNo = await generateOrderNo(app.prisma);
      const pickupNumber = await nextPickupNumber(app.prisma);
      const order = await app.prisma.$transaction(async (tx) => {
        if (coupon) {
          // 以 usedAt: null 為條件更新，避免同一張券被並行的兩張訂單重複使用
          const used = await tx.coupon.updateMany({ where: { id: coupon.id, usedAt: null }, data: { usedAt: new Date() } });
          if (used.count !== 1) throw new PricingError('COUPON_INVALID', 'invalid coupon');
        }
        const created = await tx.order.create({
          data: {
            orderNo,
            memberId,
            totalAmount,
            subtotal: priced.subtotal,
            discount,
            pickupNumber,
            estimatedReadyAt: new Date(Date.now() + 195000),
            items: {
              create: priced.lines.map((l) => ({
                menuItemId: l.menuItemId,
                name: l.name,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                subtotal: l.subtotal,
                customizations: JSON.stringify(l.customizations),
              })),
            },
            statusLogs: { create: { status: 'QUEUED', changedBy: 'system' } },
          },
          include: { items: true },
        });
        if (memberId) await tx.member.update({ where: { id: memberId }, data: { points: { increment: Math.floor(priced.subtotal) } } });
        return created;
      });
      return reply.code(201).send({ order });
    } catch (e) {
      if (e instanceof PricingError) {
        return reply.code(400).send({ error: e.message, code: e.code });
      }
      throw e;
    }
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
