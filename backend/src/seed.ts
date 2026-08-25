import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding smart-dining database...');

  // Wipe in dependency order
  await prisma.pointsTransaction.deleteMany();
  await prisma.orderStatusLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.customizationChoice.deleteMany();
  await prisma.customizationGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.member.deleteMany();

  // ============================================================
  // Categories — 對齊 design-spec
  // ============================================================
  const categories = [
    { id: 'cat-recommend', name: '推薦餐點', displayOrder: 1, icon: '⭐' },
    { id: 'cat-main',      name: '招牌主餐', displayOrder: 2, icon: '🍱' },
    { id: 'cat-side',      name: '配餐小點', displayOrder: 3, icon: '🍟' },
    { id: 'cat-drink',     name: '飲料',     displayOrder: 4, icon: '🥤' },
  ];
  for (const c of categories) {
    await prisma.category.create({ data: c });
  }
  console.log('✓ ' + categories.length + ' categories');

  // ============================================================
  // Menu items — 對齊 design-spec 第一列大卡 + 第二列小卡
  // ============================================================
  type Choice = { name: string; priceDelta: number };
  type Group = { groupName: string; type: 'SINGLE' | 'MULTI'; required: boolean; displayOrder: number; choices: Choice[] };
  type Item = { id: string; categoryId: string; name: string; basePrice: number; description: string; imageUrl: string; tags?: string; groups: Group[] };

  const items: Item[] = [
    // 推薦餐點 (大卡)
    {
      id: 'item-crispy-chicken',
      categoryId: 'cat-recommend',
      name: '經典脆雞',
      basePrice: 149,
      description: '酥脆外皮,鮮嫩多汁,招牌主打',
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400',
      tags: 'hot,signature',
      groups: [
        { groupName: '主食選擇', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '白飯', priceDelta: 0 }, { name: '冬粉', priceDelta: 0 }, { name: '玉米蛋堡', priceDelta: 10 }
        ]},
        { groupName: '醬料選擇', type: 'SINGLE', required: true, displayOrder: 2, choices: [
          { name: '醬油', priceDelta: 0 }, { name: '辣油', priceDelta: 0 }, { name: '蒜香', priceDelta: 0 }, { name: '橄欖油', priceDelta: 0 }
        ]},
        { groupName: '加購', type: 'MULTI', required: false, displayOrder: 3, choices: [
          { name: '薯條', priceDelta: 30 }, { name: '雞塊(6pc)', priceDelta: 49 }, { name: '可樂(中)', priceDelta: 15 }
        ]},
      ],
    },
    {
      id: 'item-beef-burger',
      categoryId: 'cat-recommend',
      name: '花生牛肉堡餐',
      basePrice: 179,
      description: '厚實牛肉搭配花生醬,附薯條與飲料',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
      tags: 'hot,signature',
      groups: [
        { groupName: '熟度', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '三分熟', priceDelta: 0 }, { name: '五分熟', priceDelta: 0 }, { name: '七分熟', priceDelta: 0 }, { name: '全熟', priceDelta: 0 }
        ]},
        { groupName: '加購', type: 'MULTI', required: false, displayOrder: 2, choices: [
          { name: '起司片', priceDelta: 15 }, { name: '培根', priceDelta: 25 }, { name: '生菜加大', priceDelta: 10 }
        ]},
      ],
    },
    {
      id: 'item-thai-chicken',
      categoryId: 'cat-recommend',
      name: '泰式椒麻雞餐',
      basePrice: 169,
      description: '椒麻醬拌炒雞腿肉,香辣開胃',
      imageUrl: 'https://images.unsplash.com/photo-1604908554049-19a4d2b1b3a8?w=400',
      tags: 'hot,spicy',
      groups: [
        { groupName: '辣度', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '小辣', priceDelta: 0 }, { name: '中辣', priceDelta: 0 }, { name: '大辣', priceDelta: 0 }
        ]},
        { groupName: '加購', type: 'MULTI', required: false, displayOrder: 2, choices: [
          { name: '白飯加大', priceDelta: 15 }, { name: '溫泉蛋', priceDelta: 20 }
        ]},
      ],
    },

    // 招牌主餐
    {
      id: 'item-braised-pork',
      categoryId: 'cat-main',
      name: '招牌滷肉飯',
      basePrice: 80,
      description: '傳統滷肉,肥而不膩',
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400',
      groups: [
        { groupName: '辣度', type: 'SINGLE', required: false, displayOrder: 1, choices: [
          { name: '不辣', priceDelta: 0 }, { name: '小辣', priceDelta: 0 }, { name: '大辣', priceDelta: 0 }
        ]},
        { groupName: '加料', type: 'MULTI', required: false, displayOrder: 2, choices: [
          { name: '加蛋', priceDelta: 15 }, { name: '加起司', priceDelta: 20 }
        ]},
      ],
    },
    {
      id: 'item-beef-noodle',
      categoryId: 'cat-main',
      name: '牛肉麵',
      basePrice: 120,
      description: '濃郁牛骨湯頭,軟嫩牛腱',
      imageUrl: 'https://images.unsplash.com/photo-1582450871972-ab5ca641643d?w=400',
      groups: [
        { groupName: '麵條硬度', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '硬', priceDelta: 0 }, { name: '正常', priceDelta: 0 }, { name: '軟', priceDelta: 0 }
        ]},
        { groupName: '牛肉份量', type: 'SINGLE', required: false, displayOrder: 2, choices: [
          { name: '標準', priceDelta: 0 }, { name: '加大', priceDelta: 30 }
        ]},
      ],
    },

    // 配餐小點
    {
      id: 'item-french-fries',
      categoryId: 'cat-side',
      name: '薯條',
      basePrice: 30,
      description: '金黃酥脆,鹹香可口',
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
      tags: 'small-card',
      groups: [
        { groupName: '份量', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '小', priceDelta: -10 }, { name: '中', priceDelta: 0 }, { name: '大', priceDelta: 20 }
        ]},
      ],
    },
    {
      id: 'item-chicken-nuggets',
      categoryId: 'cat-side',
      name: '雞塊(6pc)',
      basePrice: 49,
      description: '六塊酥脆雞塊,附沾醬',
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400',
      tags: 'small-card',
      groups: [
        { groupName: '醬料', type: 'SINGLE', required: false, displayOrder: 1, choices: [
          { name: '番茄醬', priceDelta: 0 }, { name: '蜂蜜芥末', priceDelta: 0 }, { name: '辣醬', priceDelta: 0 }
        ]},
      ],
    },
    {
      id: 'item-veggie-bento',
      categoryId: 'cat-side',
      name: '蔬食便當',
      basePrice: 100,
      description: '當季時蔬,健康首選',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
      groups: [
        { groupName: '主食', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '飯', priceDelta: 0 }, { name: '半飯', priceDelta: -10 }, { name: '換冬粉', priceDelta: 0 }
        ]},
      ],
    },

    // 飲料
    {
      id: 'item-cola',
      categoryId: 'cat-drink',
      name: '可樂(中)',
      basePrice: 30,
      description: '冰涼暢快,經典不敗',
      imageUrl: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400',
      tags: 'small-card',
      groups: [
        { groupName: '甜度', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '全糖', priceDelta: 0 }, { name: '七分', priceDelta: 0 }, { name: '半糖', priceDelta: 0 }, { name: '三分', priceDelta: 0 }, { name: '無糖', priceDelta: 0 }
        ]},
        { groupName: '冰塊', type: 'SINGLE', required: true, displayOrder: 2, choices: [
          { name: '正常', priceDelta: 0 }, { name: '少冰', priceDelta: 0 }, { name: '去冰', priceDelta: 0 }
        ]},
      ],
    },
    {
      id: 'item-bubble-tea',
      categoryId: 'cat-drink',
      name: '珍珠奶茶',
      basePrice: 50,
      description: 'Q彈珍珠,香濃奶香',
      imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400',
      groups: [
        { groupName: '甜度', type: 'SINGLE', required: true, displayOrder: 1, choices: [
          { name: '全糖', priceDelta: 0 }, { name: '七分', priceDelta: 0 }, { name: '半糖', priceDelta: 0 }, { name: '三分', priceDelta: 0 }, { name: '無糖', priceDelta: 0 }
        ]},
        { groupName: '冰塊', type: 'SINGLE', required: true, displayOrder: 2, choices: [
          { name: '正常', priceDelta: 0 }, { name: '少冰', priceDelta: 0 }, { name: '去冰', priceDelta: 0 }
        ]},
        { groupName: '加料', type: 'MULTI', required: false, displayOrder: 3, choices: [
          { name: '珍珠加大', priceDelta: 10 }, { name: '布丁', priceDelta: 15 }
        ]},
      ],
    },
  ];

  for (const item of items) {
    await prisma.menuItem.create({
      data: {
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        basePrice: item.basePrice,
        description: item.description,
        imageUrl: item.imageUrl,
        available: true,
        tags: item.tags,
        customizationGroups: {
          create: item.groups.map((g, gi) => ({
            groupName: g.groupName,
            type: g.type,
            required: g.required,
            displayOrder: g.displayOrder,
            choices: { create: g.choices.map((ch, ci) => ({ name: ch.name, priceDelta: ch.priceDelta, available: true })) },
          })),
        },
      },
    });
  }
  console.log('✓ ' + items.length + ' menu items with customization groups');

  // ============================================================
  // Members — 對齊 design-spec
  // ============================================================
  const vip = await prisma.member.create({
    data: {
      id: 'member-vip',
      phone: '0912345678',
      name: '王小明',
      points: 500,
      tier: 'GOLD',
    },
  });
  const guest = await prisma.member.create({
    data: {
      id: 'member-guest',
      phone: '0987654321',
      name: '林小華',
      points: 50,
      tier: 'BRONZE',
    },
  });
  console.log('✓ 2 members (VIP 王小明 / 一般 林小華)');

  // ============================================================
  // Coupons — VIP10 對齊 design-spec
  // ============================================================
  const in30days = new Date(Date.now() + 30 * 86400000);
  await prisma.coupon.create({
    data: {
      code: 'VIP10',
      type: 'PERCENTAGE',
      value: 10,
      memberId: vip.id,
      expiresAt: in30days,
    },
  });
  await prisma.coupon.create({
    data: {
      code: 'WELCOME',
      type: 'AMOUNT',
      value: 20,
      memberId: guest.id,
      expiresAt: in30days,
    },
  });
  console.log('✓ 2 coupons (VIP10 for VIP, WELCOME NT$20 for guest)');

  // ============================================================
  // Pre-existing order — QUEUED state, ready for demo
  // ============================================================
  const orderNo = 'SD-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-0001';
  const order = await prisma.order.create({
    data: {
      orderNo,
      memberId: vip.id,
      subtotal: 149 + 30 + 30,
      discount: 0,
      totalAmount: 149 + 30 + 30,
      pickupNumber: 1,
      status: 'QUEUED',
      estimatedReadyAt: new Date(Date.now() + 15 * 60 * 1000),
      items: {
        create: [
          { menuItemId: 'item-crispy-chicken', name: '經典脆雞', quantity: 1, unitPrice: 149, customizations: JSON.stringify([{groupName:'主食選擇',choice:'白飯'},{groupName:'醬料選擇',choice:'醬油'}]), subtotal: 149 },
          { menuItemId: 'item-cola', name: '可樂(中)', quantity: 1, unitPrice: 30, customizations: JSON.stringify([{groupName:'甜度',choice:'半糖'},{groupName:'冰塊',choice:'少冰'}]), subtotal: 30 },
          { menuItemId: 'item-french-fries', name: '薯條', quantity: 1, unitPrice: 30, customizations: JSON.stringify([{groupName:'份量',choice:'中'}]), subtotal: 30 },
        ],
      },
      statusLogs: {
        create: { status: 'QUEUED', changedBy: 'system' },
      },
    },
  });
  console.log('✓ 1 pre-existing order ' + orderNo + ' (QUEUED, A001)');

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
