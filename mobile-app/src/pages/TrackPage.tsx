import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { MemberOnlyBanner } from '../components/MemberRequired';

export function TrackPage() {
  const [orderNo, setOrderNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('orderNo') ?? params.get('order');
    if (q) setOrderNo(q);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = orderNo.trim();
    if (!value) {
      setError('請輸入訂單編號或取餐號');
      return;
    }
    setError(null);
    navigate(`/track/${encodeURIComponent(value)}`);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setScanBusy(true);
    try {
      const decoded = await decodeQrFromImage(file);
      if (!decoded) {
        setScanError('無法辨識 QR Code,請改用手動輸入');
        return;
      }
      try {
        const u = new URL(decoded);
        const q = u.searchParams.get('orderNo') ?? u.searchParams.get('order');
        if (q) {
          navigate(`/track/${encodeURIComponent(q)}`);
          return;
        }
        const seg = u.pathname.split('/').filter(Boolean).pop();
        if (seg) {
          navigate(`/track/${encodeURIComponent(seg)}`);
          return;
        }
      } catch {
        // not a URL — use as plain orderNo
      }
      navigate(`/track/${encodeURIComponent(decoded.trim())}`);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '讀取 QR Code 失敗');
    } finally {
      setScanBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="px-5 pt-8 pb-28 max-w-md mx-auto">
      <header className="text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-extrabold text-xl shadow-lg shadow-brand-500/30">
          SD
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink-900">餐飲點餐快手</h1>
        <p className="text-ink-500 text-sm">即時掌握取餐進度</p>
      </header>

      <div className="mt-8">
        <MemberOnlyBanner />
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="block text-sm font-medium text-ink-700 mb-2">輸入取餐號或訂單編號</span>
          <input
            inputMode="text"
            autoComplete="off"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="例如 A001 或 ORD-20240101-001"
            className="w-full rounded-2xl border-2 border-ink-100 bg-white px-4 py-4 text-base focus:border-brand-500 focus:outline-none"
          />
        </label>
        {error && <div className="text-sm text-warn">{error}</div>}
        <button
          type="submit"
          className="w-full rounded-2xl bg-brand-500 text-white font-bold py-4 shadow-lg shadow-brand-500/30 active:scale-[.98] transition-transform"
        >
          追蹤訂單
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl bg-white border-2 border-brand-200 text-brand-600 font-bold py-4 active:scale-[.98] transition-transform"
        >
          {scanBusy ? '讀取中…' : '📷 掃描 QR Code 圖片'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {scanError && <div className="mt-2 text-sm text-warn text-center">{scanError}</div>}
        <p className="mt-2 text-xs text-ink-500 text-center">
          從手機相簿選擇 KIOSK 上的 QR Code 圖片即可自動解析
        </p>
      </div>

      <section className="mt-10 grid grid-cols-3 gap-3 text-center">
        <Tip icon="⏱" label="即時更新" />
        <Tip icon="📳" label="震動通知" />
        <Tip icon="🎟" label="優惠券" />
      </section>
    </div>
  );
}

function Tip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white border border-ink-100 py-4">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-ink-700 mt-1">{label}</div>
    </div>
  );
}

async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(data.data, canvas.width, canvas.height);
    return result?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
