/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 主色 - 橘紅
        primary: {
          DEFAULT: '#FF6B35',
          50: '#FFF3EE',
          100: '#FFE3D4',
          200: '#FFC7A9',
          300: '#FFA77A',
          400: '#FF8852',
          500: '#FF6B35',
          600: '#E5531E',
          700: '#B33D14',
          800: '#82290D',
          900: '#521706',
        },
        // 輔色 - 深綠
        secondary: {
          DEFAULT: '#2D6A4F',
          50: '#EAF5EF',
          100: '#CCE7D6',
          200: '#9FCFB0',
          300: '#6BB587',
          400: '#469A6C',
          500: '#2D6A4F',
          600: '#214E3A',
          700: '#173A2A',
          800: '#0E271B',
          900: '#06140D',
        },
        // 強調色 - 金
        accent: {
          DEFAULT: '#FFB627',
          50: '#FFF8E5',
          100: '#FFEEBF',
          200: '#FFDD85',
          300: '#FFCB4D',
          400: '#FFBA2A',
          500: '#FFB627',
          600: '#D8931A',
          700: '#9D6A12',
          800: '#66450A',
          900: '#332304',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
        display: ['"Noto Sans TC"', '"PingFang TC"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // 大字體用於 KIOSK 觸控
        'kiosk-sm': ['18px', { lineHeight: '1.5' }],
        'kiosk-base': ['20px', { lineHeight: '1.5' }],
        'kiosk-lg': ['24px', { lineHeight: '1.4' }],
        'kiosk-xl': ['28px', { lineHeight: '1.3' }],
        'kiosk-2xl': ['32px', { lineHeight: '1.2' }],
        'kiosk-3xl': ['40px', { lineHeight: '1.2' }],
        'kiosk-4xl': ['48px', { lineHeight: '1.1' }],
        'kiosk-display': ['64px', { lineHeight: '1.1' }],
        'kiosk-pickup': ['120px', { lineHeight: '1.0' }],
      },
      minHeight: {
        // 主按鈕最小高度
        'touch': '64px',
        'touch-lg': '80px',
      },
      spacing: {
        'touch-gap': '16px',
      },
    },
  },
  plugins: [],
};
