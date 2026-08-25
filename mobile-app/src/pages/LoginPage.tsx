import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { requestLoginCode, verifyLoginCode } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^09\d{8}$/.test(phone.trim())) {
      setError('請輸入有效的手機號碼(09 開頭共 10 碼)');
      return;
    }
    setBusy(true);
    try {
      const res = await requestLoginCode(phone.trim());
      setHint(`已寄出驗證碼(Demo:${res.code})`);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : '請求驗證碼失敗');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError('請輸入驗證碼');
      return;
    }
    setBusy(true);
    try {
      const res = await verifyLoginCode(phone.trim(), code.trim());
      setSession(res.token, res.member);
      const redirect = (location.state as { from?: string } | null)?.from ?? '/member';
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pt-10 pb-28 max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold text-ink-900">會員登入</h1>
      <p className="mt-1 text-ink-500 text-sm">輸入手機號碼取得驗證碼,首次登入將自動加入會員。</p>

      {step === 'phone' ? (
        <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-2">手機號碼</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              className="w-full rounded-2xl border-2 border-ink-100 bg-white px-4 py-4 text-base focus:border-brand-500 focus:outline-none"
            />
          </label>
          {error && <div className="text-sm text-warn">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-brand-500 text-white font-bold py-4 shadow-lg shadow-brand-500/30 disabled:opacity-50"
          >
            {busy ? '處理中…' : '取得驗證碼'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <div className="text-sm text-ink-700">
            將驗證碼寄送至 <span className="font-mono">{phone}</span>{' '}
            <button type="button" className="text-brand-500 underline" onClick={() => setStep('phone')}>
              修改
            </button>
          </div>
          {hint && <div className="rounded-xl bg-success/10 text-success px-3 py-2 text-sm">{hint}</div>}
          <label className="block">
            <span className="block text-sm font-medium text-ink-700 mb-2">驗證碼</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="1234"
              className="w-full rounded-2xl border-2 border-ink-100 bg-white px-4 py-4 text-base tracking-widest text-center focus:border-brand-500 focus:outline-none"
            />
          </label>
          {error && <div className="text-sm text-warn">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-brand-500 text-white font-bold py-4 shadow-lg shadow-brand-500/30 disabled:opacity-50"
          >
            {busy ? '登入中…' : '登入 / 註冊'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-xs text-ink-500">
        Demo 階段固定驗證碼:<span className="font-mono">1234</span>
      </div>
      <div className="mt-10 text-center">
        <Link to="/" className="text-sm text-brand-500 underline">暫不登入,繼續追蹤訂單</Link>
      </div>
    </div>
  );
}
