import clsx from 'clsx';

interface NumberPadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  /** 顯示模式: 'phone' | 'code' | 'generic' */
  mode?: 'phone' | 'code' | 'generic';
  disabled?: boolean;
}

const KEYS: Array<{ label: string; value: string; type: 'digit' | 'back' | 'clear' }> = [
  { label: '1', value: '1', type: 'digit' },
  { label: '2', value: '2', type: 'digit' },
  { label: '3', value: '3', type: 'digit' },
  { label: '4', value: '4', type: 'digit' },
  { label: '5', value: '5', type: 'digit' },
  { label: '6', value: '6', type: 'digit' },
  { label: '7', value: '7', type: 'digit' },
  { label: '8', value: '8', type: 'digit' },
  { label: '9', value: '9', type: 'digit' },
  { label: '清除', value: 'CLEAR', type: 'clear' },
  { label: '0', value: '0', type: 'digit' },
  { label: '⌫', value: 'BACK', type: 'back' },
];

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 4) return d;
  if (d.length <= 7) return d.slice(0, 4) + ' ' + d.slice(4);
  return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
}

function formatCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

export function NumberPad({
  value,
  onChange,
  maxLength = 10,
  mode = 'generic',
  disabled = false,
}: NumberPadProps) {
  const display =
    mode === 'phone'
      ? formatPhone(value)
      : mode === 'code'
        ? formatCode(value)
        : value;

  function press(v: string) {
    if (disabled) return;
    if (v === 'CLEAR') return onChange('');
    if (v === 'BACK') return onChange(value.slice(0, -1));
    const next = (value + v).slice(0, maxLength);
    onChange(next);
  }

  return (
    <div className="grid grid-cols-3 gap-3 select-none">
      {KEYS.map((k) => {
        const isAction = k.type !== 'digit';
        return (
          <button
            key={k.value}
            type="button"
            disabled={disabled}
            onClick={() => press(k.value)}
            className={clsx(
              'h-touch rounded-xl font-black text-kiosk-3xl btn-press transition-colors',
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
              isAction
                ? 'bg-gray-200 text-gray-700 active:bg-gray-300'
                : 'bg-white border-2 border-gray-200 text-gray-900 active:bg-primary active:text-white active:border-primary',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
            aria-label={'按鍵 ' + k.label}
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
}
