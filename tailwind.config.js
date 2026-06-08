/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        tcet: {
          navy: '#0a0f1a',
          surface: '#111827',
          amber: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}
