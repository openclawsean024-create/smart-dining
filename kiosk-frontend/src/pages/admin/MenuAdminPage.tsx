/**
 * MenuAdminPage — 菜單管理(AC-005 / FR-063、FR-065;只有店長)。
 *
 * 合併來源(SPEC §12.1):
 *   - #3 restaurant-kiosk `AdminItemsPage.tsx`:新增品項、上架／下架切換
 *   - #4 pos-system `InventoryView.tsx`:編輯、刪除、成本、毛利、庫存、低庫存警示與篩選
 * 資料一律走後端 API(不搬 localStorage);刪除為軟刪除,刪除前需確認。
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import type { AdminMenuItem, Category, MenuItemInput } from '@smart-dining/contracts';
import { createMenuItem, deleteMenuItem, listMenuItems, updateMenuItem } from '../../api/adminMenu';
import { ApiError } from '../../api/client';

interface FormState {
  name: string;
  categoryId: string;
  basePrice: string;
  cost: string;
  /** 空字串＝不追蹤庫存 */
  stock: string;
  reorderLevel: string;
  sku: string;
  description: string;
}

const emptyForm = (categoryId = ''): FormState => ({
  name: '', categoryId, basePrice: '', cost: '0', stock: '', reorderLevel: '10', sku: '', description: '',
});

const toForm = (i: AdminMenuItem): FormState => ({
  name: i.name,
  categoryId: i.categoryId,
  basePrice: String(i.basePrice),
  cost: String(i.cost),
  stock: i.stock === null ? '' : String(i.stock),
  reorderLevel: String(i.reorderLevel),
  sku: i.sku ?? '',
  description: i.description ?? '',
});

/** 表單驗證(後端也會驗證);回傳錯誤訊息或轉好的輸入。 */
export function parseForm(f: FormState): { error: string } | { input: MenuItemInput } {
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
  if (!f.name.trim()) return { error: '請輸入品項名稱' };
  if (!f.categoryId) return { error: '請選擇分類' };
  const basePrice = num(f.basePrice);
  if (!Number.isFinite(basePrice) || basePrice < 0) return { error: '售價必須是 0 以上的數字' };
  const cost = num(f.cost);
  if (!Number.isFinite(cost) || cost < 0) return { error: '成本必須是 0 以上的數字' };
  let stock: number | null = null;
  if (f.stock.trim() !== '') {
    stock = num(f.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: '庫存必須是 0 以上的整數(留空＝不追蹤)' };
  }
  const reorderLevel = num(f.reorderLevel);
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) return { error: '低庫存門檻必須是 0 以上的整數' };
  return {
    input: {
      name: f.name.trim(),
      categoryId: f.categoryId,
      basePrice,
      cost,
      stock,
      reorderLevel,
      sku: f.sku.trim() || null,
      description: f.description.trim() || null,
    },
  };
}

/** 毛利率(%):(售價 − 成本)÷ 售價 */
export function marginPercent(price: number, cost: number): number {
  return price > 0 ? ((price - cost) / price) * 100 : 0;
}

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'SKU 已被其他品項使用';
    if (e.status === 403) return '只有店長可以管理菜單';
    if (e.status === 404) return '品項不存在,可能已被刪除';
    if (e.status === 400) return '資料格式不正確:' + e.message;
  }
  return fallback;
}

export function MenuAdminPage() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null); // 'new' 或品項 id
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await listMenuItems();
      setItems(res.items);
      setCategories(res.categories);
      setError(null);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setError(apiMessage(e, '無法取得菜單'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (lowStockOnly && !i.lowStock) return false;
        if (q && !i.name.includes(q) && !(i.sku ?? '').includes(q)) return false;
        return true;
      }),
    [items, q, lowStockOnly],
  );
  const lowStockCount = items.filter((i) => i.lowStock).length;

  function startCreate() {
    setEditingId('new');
    setForm(emptyForm(categories[0]?.id ?? ''));
    setFormError(null);
  }

  function startEdit(item: AdminMenuItem) {
    setEditingId(item.id);
    setForm(toForm(item));
    setFormError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseForm(form);
    if ('error' in parsed) {
      setFormError(parsed.error);
      return;
    }
    setBusy('form');
    try {
      if (editingId === 'new') await createMenuItem(parsed.input);
      else if (editingId) await updateMenuItem(editingId, parsed.input);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setFormError(apiMessage(err, '儲存失敗,請再試一次'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleAvailable(item: AdminMenuItem) {
    setBusy(item.id);
    setError(null);
    try {
      await updateMenuItem(item.id, { available: !item.available });
      await refresh();
    } catch (e) {
      setError(apiMessage(e, '更新失敗,請再試一次'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: AdminMenuItem) {
    if (!window.confirm(`確定要刪除「${item.name}」?刪除後 KIOSK 不再顯示,歷史訂單會保留。`)) return;
    setBusy(item.id);
    setError(null);
    try {
      await deleteMenuItem(item.id);
      await refresh();
    } catch (e) {
      setError(apiMessage(e, '刪除失敗,請再試一次'));
    } finally {
      setBusy(null);
    }
  }

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (ev: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: ev.target.value })),
  });
  const inputClass = 'w-full h-11 px-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-gray-900">菜單管理</h1>
          <p className="text-sm text-gray-500 mt-1">共 {items.length} 項 · 下架或庫存為 0 的品項不會出現在 KIOSK</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="h-11 px-5 rounded-xl bg-primary text-white font-black btn-press hover:bg-primary-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          data-testid="menu-new"
        >
          + 新增品項
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold">
          {error}
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold" data-testid="low-stock-alert">
          有 {lowStockCount} 項品項低於安全庫存,請盡快補貨
        </div>
      )}

      {editingId && (
        <form
          onSubmit={submit}
          noValidate // 用 parseForm 顯示一致的中文錯誤訊息，而不是瀏覽器原生提示
          className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
          aria-label={editingId === 'new' ? '新增品項' : '編輯品項'}
          data-testid="menu-form"
        >
          <h2 className="font-black text-xl mb-4">{editingId === 'new' ? '新增品項' : '編輯品項'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="md:col-span-2">
              <span className="block text-sm font-bold text-gray-700 mb-1">名稱</span>
              <input className={inputClass} {...field('name')} data-testid="menu-form-name" />
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">分類</span>
              <select className={inputClass} {...field('categoryId')} data-testid="menu-form-category">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">SKU／條碼(選填)</span>
              <input className={inputClass} {...field('sku')} data-testid="menu-form-sku" />
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">售價</span>
              <input type="number" min={0} className={inputClass} {...field('basePrice')} data-testid="menu-form-price" />
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">成本</span>
              <input type="number" min={0} className={inputClass} {...field('cost')} data-testid="menu-form-cost" />
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">庫存(留空＝不追蹤)</span>
              <input type="number" min={0} className={inputClass} {...field('stock')} data-testid="menu-form-stock" />
            </label>
            <label>
              <span className="block text-sm font-bold text-gray-700 mb-1">低庫存門檻</span>
              <input type="number" min={0} className={inputClass} {...field('reorderLevel')} data-testid="menu-form-reorder" />
            </label>
            <label className="md:col-span-4">
              <span className="block text-sm font-bold text-gray-700 mb-1">說明(選填)</span>
              <input className={inputClass} {...field('description')} />
            </label>
          </div>
          {formError && (
            <div role="alert" className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm" data-testid="menu-form-error">
              {formError}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy === 'form'}
              className="h-11 px-6 rounded-xl bg-primary text-white font-black btn-press hover:bg-primary-600 disabled:bg-gray-300"
              data-testid="menu-form-save"
            >
              {busy === 'form' ? '儲存中…' : '儲存'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="h-11 px-6 rounded-xl bg-gray-100 text-gray-700 font-bold btn-press">
              取消
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋名稱或 SKU"
          aria-label="搜尋名稱或 SKU"
          className="flex-1 min-w-[200px] h-11 px-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
        />
        <label className="flex items-center gap-2 px-3 h-11 rounded-xl border-2 border-gray-200 font-bold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} data-testid="low-stock-only" />
          只看低庫存
        </label>
      </div>

      {!loaded ? (
        <div className="text-center text-gray-400 py-16">載入中…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">品項</th>
                <th className="text-left px-3 py-2">分類</th>
                <th className="text-right px-3 py-2">售價</th>
                <th className="text-right px-3 py-2">成本</th>
                <th className="text-right px-3 py-2">毛利</th>
                <th className="text-right px-3 py-2">庫存</th>
                <th className="text-center px-3 py-2">狀態</th>
                <th className="text-right px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" data-testid="menu-table">
              {filtered.map((i) => {
                const margin = marginPercent(i.basePrice, i.cost);
                return (
                  <tr key={i.id} data-testid={`menu-row-${i.id}`}>
                    <td className="px-3 py-2">
                      <div className="font-bold text-gray-900">{i.name}</div>
                      {i.sku && <div className="text-xs text-gray-500 font-mono">{i.sku}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{i.categoryName}</td>
                    <td className="px-3 py-2 text-right">NT$ {i.basePrice}</td>
                    <td className="px-3 py-2 text-right text-gray-600">NT$ {i.cost}</td>
                    <td className={clsx('px-3 py-2 text-right font-bold', margin > 50 ? 'text-secondary' : margin > 30 ? 'text-amber-600' : 'text-red-600')} data-testid={`menu-margin-${i.id}`}>
                      {margin.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right" data-testid={`menu-stock-${i.id}`}>
                      {i.stock === null ? (
                        <span className="text-gray-400">不追蹤</span>
                      ) : (
                        <span className={clsx('px-2 py-0.5 rounded font-bold', i.lowStock ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>
                          {i.stock}
                          {i.lowStock && ' · 低庫存'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={i.available ? 'text-secondary font-bold' : 'text-gray-400 font-bold'} data-testid={`menu-status-${i.id}`}>
                        {i.available ? '上架' : '下架'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" disabled={busy === i.id} onClick={() => void toggleAvailable(i)} className="px-2 py-1 font-bold text-primary-700 hover:underline disabled:text-gray-400" data-testid={`menu-toggle-${i.id}`}>
                        {i.available ? '下架' : '上架'}
                      </button>
                      <button type="button" onClick={() => startEdit(i)} className="px-2 py-1 font-bold text-gray-700 hover:underline" data-testid={`menu-edit-${i.id}`}>
                        編輯
                      </button>
                      <button type="button" disabled={busy === i.id} onClick={() => void remove(i)} className="px-2 py-1 font-bold text-red-600 hover:underline disabled:text-gray-400" data-testid={`menu-delete-${i.id}`}>
                        刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-gray-400" data-testid="menu-empty">
                    沒有符合條件的品項
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
