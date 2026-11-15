/**
 * 後台菜單管理（AC-005 / FR-063、FR-065）。只有店長可以使用。
 *
 * 合併來源（SPEC §12.1）：
 *   - #3 restaurant-kiosk `AdminItemsPage.tsx`：新增品項、上下架
 *   - #4 pos-system `InventoryView.tsx`＋`store.ts`（addProduct／updateProduct／deleteProduct）：
 *        完整 CRUD、成本、庫存、低庫存門檻
 * 改寫為後端 API；不搬 pos-system 的 localStorage 資料層與示範資料。
 * 刪除為軟刪除（deletedAt），歷史訂單的品項關聯保留。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AdminMenuItem } from '../../../../shared-contracts/src/index.js';
import { parseOr400 } from '../../lib/http.js';

const money = z.number().finite().min(0).max(1_000_000);
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

const baseFields = {
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  basePrice: money,
  cost: money,
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  reorderLevel: z.number().int().min(0).max(1_000_000),
  sku: optionalText(64),
  description: optionalText(500),
  imageUrl: optionalText(500).refine((v) => v === null || /^https?:\/\//.test(v), 'imageUrl must be an http(s) URL'),
  available: z.boolean(),
};

const createSchema = z
  .object({
    ...baseFields,
    cost: baseFields.cost.default(0),
    stock: baseFields.stock.default(null),
    reorderLevel: baseFields.reorderLevel.default(10),
    available: baseFields.available.default(true),
  })
  .strict();

const updateSchema = z
  .object(baseFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'no fields to update');

type ItemRow = {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  description: string | null;
  available: boolean;
  tags: string | null;
  sku: string | null;
  cost: number;
  stock: number | null;
  reorderLevel: number;
  category: { name: string };
};

export function toAdminMenuItem(row: ItemRow): AdminMenuItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    name: row.name,
    basePrice: row.basePrice,
    imageUrl: row.imageUrl,
    description: row.description,
    available: row.available,
    tags: row.tags,
    sku: row.sku,
    cost: row.cost,
    stock: row.stock,
    reorderLevel: row.reorderLevel,
    lowStock: row.stock !== null && row.stock <= row.reorderLevel,
  };
}

const adminMenuRoutes: FastifyPluginAsync = async (app) => {
  const managerOnly = { preHandler: app.requireStaff('MANAGER') };

  async function categoryExists(categoryId: string): Promise<boolean> {
    return (await app.prisma.category.count({ where: { id: categoryId } })) === 1;
  }

  /** SKU 在未刪除的品項中不可重複。回傳 true 表示已回應 409。 */
  async function skuTaken(reply: FastifyReply, sku: string | null | undefined, exceptId?: string): Promise<boolean> {
    if (!sku) return false;
    const dup = await app.prisma.menuItem.findFirst({
      where: { sku, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (dup) {
      await reply.code(409).send({ error: 'sku already in use' });
      return true;
    }
    return false;
  }

  app.get('/api/admin/menu/items', managerOnly, async () => {
    const [categories, items] = await Promise.all([
      app.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      app.prisma.menuItem.findMany({
        where: { deletedAt: null },
        include: { category: { select: { name: true, displayOrder: true } } },
        orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
      }),
    ]);
    return { categories, items: items.map(toAdminMenuItem) };
  });

  app.post('/api/admin/menu/items', managerOnly, async (request, reply) => {
    const body = parseOr400(createSchema, request.body, reply);
    if (!body) return;
    if (!(await categoryExists(body.categoryId))) return reply.code(400).send({ error: 'invalid request: categoryId: category not found' });
    if (await skuTaken(reply, body.sku)) return;

    const created = await app.prisma.menuItem.create({
      data: body,
      include: { category: { select: { name: true } } },
    });
    return reply.code(201).send({ item: toAdminMenuItem(created) });
  });

  app.patch('/api/admin/menu/items/:id', managerOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseOr400(updateSchema, request.body, reply);
    if (!body) return;

    const existing = await app.prisma.menuItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (body.categoryId && !(await categoryExists(body.categoryId))) {
      return reply.code(400).send({ error: 'invalid request: categoryId: category not found' });
    }
    if (await skuTaken(reply, body.sku, id)) return;

    const updated = await app.prisma.menuItem.update({
      where: { id },
      data: body,
      include: { category: { select: { name: true } } },
    });
    return { item: toAdminMenuItem(updated) };
  });

  // 軟刪除：從菜單與後台清單消失，歷史訂單不受影響
  app.delete('/api/admin/menu/items/:id', managerOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await app.prisma.menuItem.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), available: false },
    });
    if (result.count !== 1) return reply.code(404).send({ error: 'not found' });
    return reply.code(204).send();
  });
};

export default adminMenuRoutes;
