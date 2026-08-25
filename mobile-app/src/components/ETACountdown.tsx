import { useEffect, useState } from 'react';

interface Props {
  estimatedReadyAt: string | null;
  isReady?: boolean;
}

function diffMinutes(targetMs: number, nowMs: number) {
  return Math.max(0, Math.round((targetMs - nowMs) / 60_000));
}

export function ETACountdown({ estimatedReadyAt, isReady }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isReady) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [isReady]);

  if (!estimatedReadyAt) {
    return (
      <div className="rounded-2xl bg-white p-4 text-center text-ink-500 text-sm border border-ink-100">
        預計取餐時間計算中…
      </div>
    );
  }

  const target = new Date(estimatedReadyAt).getTime();
  const minutes = diffMinutes(target, now);

  if (isReady) {
    return (
      <div className="rounded-2xl bg-success/10 p-4 text-center border border-success/30">
        <div className="text-success font-bold text-lg">🍱 您的餐點已準備好,請至櫃檯取餐</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 text-center border border-ink-100">
      <div className="text-xs text-ink-500 uppercase tracking-wider">預計可取餐</div>
      <div className="mt-1 flex items-baseline justify-center gap-1">
        <span className="number-display text-[40px] font-extrabold text-brand-500 leading-none">
          {minutes}
        </span>
        <span className="text-ink-700 text-base">分鐘後</span>
      </div>
      <div className="mt-1 text-xs text-ink-500">
        預估時間 {new Date(estimatedReadyAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
