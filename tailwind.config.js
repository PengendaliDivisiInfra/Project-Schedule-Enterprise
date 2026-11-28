/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
    // PENTING: Memindai class Tailwind di dalam library Gantt
    './node_modules/@bluemillstudio/gantt/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        critical: '#dc2626',
        milestone: '#f59e0b',
      },
      boxShadow: {
        executive: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -6px rgba(15, 23, 42, 0.07)',
        modal: '0 24px 64px -16px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
