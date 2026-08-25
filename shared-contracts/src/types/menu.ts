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
