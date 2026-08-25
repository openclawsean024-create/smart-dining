import {
  PROGRESS_STAGES,
  PROGRESS_STAGE_MAP,
  type ProgressStage,
  type OrderStatusLog,
} from '@smart-dining/contracts';

interface Props {
  currentStage: ProgressStage | null;
  logs?: OrderStatusLog[];
}

function formatTime(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function StageTimeline({ currentStage, logs }: Props) {
  const activeIdx = currentStage ? PROGRESS_STAGES.indexOf(currentStage) : -1;

  return (
    <ol className="relative pl-6">
      <span className="absolute left-3 top-2 bottom-2 w-px bg-ink-100" aria-hidden />
      {PROGRESS_STAGES.map((stage, idx) => {
        const meta = PROGRESS_STAGE_MAP[stage];
        const isDone = activeIdx > idx;
        const isActive = activeIdx === idx;
        const matchedLog = logs?.find((l) => l.status === stage);
        return (
          <li key={stage} className="relative pb-4 last:pb-0">
            <span
              className={[
                'absolute -left-[3px] mt-1.5 h-3 w-3 rounded-full border-2',
                isDone
                  ? 'bg-success border-success'
                  : isActive
                  ? 'bg-brand-500 border-brand-500 animate-pulseSoft'
                  : 'bg-white border-ink-300',
              ].join(' ')}
              aria-hidden
            />
            <div className="ml-2 flex items-baseline justify-between">
              <span
                className={[
                  'text-sm',
                  isActive ? 'text-brand-600 font-semibold' : isDone ? 'text-ink-900' : 'text-ink-500',
                ].join(' ')}
              >
                {meta.displayName}
              </span>
              <span className="text-xs text-ink-500">{matchedLog ? formatTime(matchedLog.changedAt) : ''}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
