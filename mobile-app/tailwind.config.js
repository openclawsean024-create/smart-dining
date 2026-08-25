/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 與 KIOSK 一致的橘紅主色
        brand: {
          50: '#FFF4ED',
          100: '#FFE6D5',
          200: '#FFC8AB',
          300: '#FFA176',
          400: '#FF8852',
          500: '#FF6B35',
          600: '#F04E14',
          700: '#C73E0E',
          800: '#9C320E',
          900: '#7E2A11',
        },
        ink: {
          900: '#111827',
          700: '#374151',
          500: '#6B7280',
          300: '#D1D5DB',
          100: '#F3F4F6',
        },
        success: '#10B981',
        warn: '#F59E0B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang TC"', '"Noto Sans TC"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'monospace'],
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 1.6s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out infinite',
      },
    },
  },
  // safelist:動態 class(例如進度條顏色、狀態標籤)
  safelist: [
    'bg-brand-500',
    'bg-brand-600',
    'bg-success',
    'bg-warn',
    'bg-ink-300',
    'text-brand-500',
    'text-success',
    'text-warn',
    'text-ink-500',
    'border-brand-500',
    'animate-pulseSoft',
    'animate-shake',
  ],
  plugins: [],
};
