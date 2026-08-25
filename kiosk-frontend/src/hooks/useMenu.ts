/**
 * useMenu — 用 SWR 取得完整菜單,提供分類 / 品項查找工具。
 */

import useSWR from 'swr';
import { getMenu } from '../api/menu';
import type {
  MenuResponseBody,
  Category,
  MenuItem,
  CustomizationGroup,
} from '@smart-dining/contracts';

interface FlatItem extends MenuItem {
  categoryId: string;
  categoryName: string;
  customizationGroups: CustomizationGroup[];
}

export function useMenu() {
  const { data, error, isLoading, mutate } = useSWR<MenuResponseBody>(
    'menu',
    getMenu,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  const categories: Category[] = (data?.categories ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const itemsByCategory: Record<string, FlatItem[]> = {};
  const allItems: FlatItem[] = [];
  for (const cat of data?.categories ?? []) {
    itemsByCategory[cat.id] = cat.items.map((it) => ({
      ...it,
      categoryId: cat.id,
      categoryName: cat.name,
      customizationGroups: it.customizationGroups ?? [],
    }));
    allItems.push(...itemsByCategory[cat.id]);
  }

  function getItem(itemId: string): FlatItem | undefined {
    return allItems.find((it) => it.id === itemId);
  }

  function getItemsByCategory(categoryId: string): FlatItem[] {
    return itemsByCategory[categoryId] ?? [];
  }

  return {
    menu: data,
    categories,
    itemsByCategory,
    allItems,
    getItem,
    getItemsByCategory,
    isLoading,
    error,
    refresh: mutate,
  };
}

export type { FlatItem };
