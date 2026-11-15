/**
 * StaffLoginForm — 員工帳號密碼登入(AC-011)。
 * 密碼只送往後端比對(bcrypt),前端不保存;登入成功後只保存員工 JWT。
 */
import { useState, type FormEvent } from 'react';
import { staffLogin } from '../../api/staff';
import { ApiError } from '../../api/client';
import { useStaffStore } from '../../store/staffStore';

export function StaffLoginForm() {
  const setSession = useStaffStore((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await staffLogin(username.trim(), password);
      setSession(res.token, res.staff);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('帳號或密碼錯誤');
      else if (err instanceof ApiError && err.status === 429) setError('登入失敗次數過多,請稍後再試');
      else setError('無法登入,請確認後端服務是否正常');
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow p-8 border border-gray-200"
        aria-label="員工登入"
        data-testid="staff-login-form"
      >
        <h1 className="font-black text-2xl text-gray-900 mb-1">員工登入</h1>
        <p className="text-sm text-gray-500 mb-6">後台、廚房顯示與菜單管理需要員工帳號。</p>

        <label className="block mb-4">
          <span className="block text-sm font-bold text-gray-700 mb-1">帳號</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
            data-testid="staff-username"
            required
          />
        </label>
        <label className="block mb-4">
          <span className="block text-sm font-bold text-gray-700 mb-1">密碼</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
            data-testid="staff-password"
            required
          />
        </label>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="w-full h-12 rounded-xl bg-primary text-white font-black btn-press hover:bg-primary-600 disabled:bg-gray-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          data-testid="staff-login-submit"
        >
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}
