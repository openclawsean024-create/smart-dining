import { PROGRESS_STAGES, PROGRESS_STAGE_MAP, type ProgressStage } from '@smart-dining/contracts';

interface Props {
  currentStage: ProgressStage | null;
}

export function ProgressBar({ currentStage }: Props) {
  const activeIdx = currentStage ? PROGRESS_STAGES.indexOf(currentStage) : -1;

  return (
    <div className="flex items-center justify-between w-full">
      {PROGRESS_STAGES.map((stage, idx) => {
        const meta = PROGRESS_STAGE_MAP[stage];
        const isDone = activeIdx > idx;
        const isActive = activeIdx === idx;
        const isLast = idx === PROGRESS_STAGES.length - 1;

        return (
          <div key={stage} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold border-2',
                  isDone
                    ? 'bg-success text-white border-success'
                    : isActive
                    ? 'bg-brand-500 text-white border-brand-500 animate-pulseSoft'
                    : 'bg-white text-ink-500 border-ink-300',
                ].join(' ')}
                aria-label={meta.displayName}
              >
                {isDone ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={[
                  'text-[10px] leading-tight text-center max-w-[64px]',
                  isActive ? 'text-brand-600 font-semibold' : isDone ? 'text-success' : 'text-ink-500',
                ].join(' ')}
              >
                {meta.displayName}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  'h-1 flex-1 mx-1 rounded',
                  isDone ? 'bg-success' : 'bg-ink-100',
                ].join(' ')}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
