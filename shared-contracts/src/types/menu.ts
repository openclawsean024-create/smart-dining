/**
 * 菜單 / 客製化相關型別
 *
 * 設計重點:
 * - Category 與 MenuItem 為一對多。
 * - MenuItem 與 CustomizationGroup 為一對多。
 * - CustomizationGroup 與 CustomizationChoice 為一對多。
 * - group.type = SINGLE 為單選(如:甜度、冰量);MULTI 為複選(如:加料)。
 */

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  icon?: string | null;
}

export interface CustomizationChoice {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export type CustomizationGroupType = 'SINGLE' | 'MULTI';

export interface CustomizationGroup {
  id: string;
  menuItemId: string;
  groupName: string;
  type: CustomizationGroupType;
  required: boolean;
  displayOrder: number;
  choices: CustomizationChoice[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  imageUrl?: string | null;
  description?: string | null;
  available: boolean;
  /**
   * 以逗號分隔的標籤字串(如:"spicy,vegan,new")。前端自行 split。
   */
  tags?: string | null;
  customizationGroups?: CustomizationGroup[];
}

/**
 * 後台菜單管理用的品項（AC-005；只有店長看得到成本與庫存）。
 */
export interface AdminMenuItem extends MenuItem {
  sku: string | null;
  cost: number;
  /** null＝不追蹤庫存 */
  stock: number | null;
  reorderLevel: number;
  /** stock 不為 null 且 ≤ reorderLevel */
  lowStock: boolean;
  categoryName: string;
}

/** 新增／編輯品項的輸入（AC-005）。編輯時所有欄位皆可省略。 */
export interface MenuItemInput {
  categoryId: string;
  name: string;
  basePrice: number;
  cost?: number;
  stock?: number | null;
  reorderLevel?: number;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  available?: boolean;
}
