import type { FastifyPluginAsync } from 'fastify';

const menuRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/menu — KIOSK 顧客菜單（公開）。
   *
   * 回應格式依 shared-contracts 的 MenuResponseBody：每個分類的品項放在 `items`。
   * （舊版回傳 Prisma 的關聯名稱 `menuItems`，與契約及 KIOSK 前端不一致，前端因此無法顯示菜單。）
   */
  app.get('/api/menu', async () => {
    const categories = await app.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        menuItems: {
          orderBy: { name: 'asc' },
          include: {
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
