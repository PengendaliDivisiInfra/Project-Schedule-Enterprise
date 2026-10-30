/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // TAMBAHKAN BARIS DI BAWAH INI
    './node_modules/@bluemillstudio/gantt/dist/**/*.{js,mjs}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a'
        },
        critical: '#dc2626',
        milestone: '#f59e0b'
      }
    }
  },
  plugins: []
};