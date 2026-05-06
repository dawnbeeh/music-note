/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0f1014',
          panel: '#16171d',
          elev: '#1f2028',
        },
        line: '#2e303a',
        text: {
          DEFAULT: '#d4d4d8',
          muted: '#8b8c97',
          strong: '#f3f4f6',
        },
        accent: {
          DEFAULT: '#c084fc',
          dim: 'rgba(192, 132, 252, 0.15)',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
