import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';

/** KIOSK 看得到的品項：上架、未刪除、庫存不為 0（null＝不追蹤庫存）（AC-005）。 */
export const KIOSK_VISIBLE_ITEM: Prisma.MenuItemWhereInput = {
  available: true,
  deletedAt: null,
  OR: [{ stock: null }, { stock: { gt: 0 } }],
};

const menuRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/menu — KIOSK 顧客菜單（公開）。
   *
   * - 回應格式依 shared-contracts 的 MenuResponseBody：每個分類的品項放在 `items`
   *   （舊版回傳 Prisma 的關聯名稱 `menuItems`，與契約及 KIOSK 前端不一致）。
   * - 只回傳 KIOSK_VISIBLE_ITEM；成本、庫存、SKU 等內部欄位不對外。
   * - 停用的客製化選項仍回傳（available=false），前端以刪除線顯示。
   */
  app.get('/api/menu', async () => {
    const categories = await app.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        menuItems: {
          where: KIOSK_VISIBLE_ITEM,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            categoryId: true,
            name: true,
            basePrice: true,
            imageUrl: true,
            description: true,
            available: true,
            tags: true,
            customizationGroups: {
              orderBy: { displayOrder: 'asc' },
              include: { choices: { orderBy: { name: 'asc' } } },
            },
          },
        },
      },
    });
    return {
      categories: categories.map(({ menuItems, ...category }) => ({ ...category, items: menuItems })),
    };
  });
};

export default menuRoutes;
