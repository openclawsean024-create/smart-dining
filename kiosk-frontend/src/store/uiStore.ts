/**
 * uiStore — Dashboard 的 UI 狀態(sidebar 選中分類、客製化面板展開/摺疊、取餐進度 modal 等)
 *
 * 不需要 persist(重整後重置為預設)。
 */
import { create } from 'zustand';

export type SidebarCategoryId =
  | 'recommended'
  | 'popular'
  | 'main'
  | 'side'
  | 'drinks'
  | 'dessert'
  | 'member';

export interface SidebarCategory {
  id: SidebarCategoryId;
  icon: string;
  name: string;
  /** 是否需要真實後端 categoryId(主餐/配餐/飲品/甜點)*/
  backendCategoryId?: string;
}

export const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  { id: 'recommended', icon: '🍱', name: '推薦餐點' },
  { id: 'popular', icon: '🌟', name: '人氣精選' },
  { id: 'main', icon: '🍚', name: '主餐', backendCategoryId: 'cat-main' },
  { id: 'side', icon: '🍟', name: '配餐', backendCategoryId: 'cat-side' },
  { id: 'drinks', icon: '🥤', name: '飲品', backendCategoryId: 'cat-drinks' },
  { id: 'dessert', icon: '🍰', name: '甜點', backendCategoryId: 'cat-dessert' },
  { id: 'member', icon: '👤', name: '會員專區' },
];

interface UIState {
  activeCategory: SidebarCategoryId;
  /** 客製化面板是否展開 */
  customizePanelOpen: boolean;
  /** 取餐進度 modal 是否開啟 */
  pickupModalOpen: boolean;
  /** Checkout modal 是否開啟(直接覆蓋在 Dashboard 上) */
  checkoutModalOpen: boolean;
  /** 最新訂單編號(Quick 顯示用) */
  latestOrderNo: string | null;

  setActiveCategory: (id: SidebarCategoryId) => void;
  openCustomizePanel: () => void;
  closeCustomizePanel: () => void;
  toggleCustomizePanel: () => void;
  openPickupModal: () => void;
  closePickupModal: () => void;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
  setLatestOrderNo: (orderNo: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeCategory: 'recommended',
  customizePanelOpen: false,
  pickupModalOpen: false,
  checkoutModalOpen: false,
  latestOrderNo: null,

  setActiveCategory: (id) =>
    set({ activeCategory: id, customizePanelOpen: false }),
  openCustomizePanel: () => set({ customizePanelOpen: true }),
  closeCustomizePanel: () => set({ customizePanelOpen: false }),
  toggleCustomizePanel: () =>
    set((s) => ({ customizePanelOpen: !s.customizePanelOpen })),

  openPickupModal: () => set({ pickupModalOpen: true }),
  closePickupModal: () => set({ pickupModalOpen: false }),

  openCheckoutModal: () => set({ checkoutModalOpen: true }),
  closeCheckoutModal: () => set({ checkoutModalOpen: false }),

  setLatestOrderNo: (orderNo) => set({ latestOrderNo: orderNo }),
}));
