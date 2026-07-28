/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crema: { 50: '#fffdf8', 100: '#fff8ec', 200: '#f6ecd8', 300: '#eadfcd', 400: '#c9c0ae' },
        tinta: { 300: '#a1988b', 400: '#8a8378', 500: '#6f675b', 700: '#4a4239', 900: '#26211c' },
        verde: { 50: '#e9f6ef', 100: '#d8f0e2', 500: '#2e9e6b', 600: '#258057', 700: '#20714c' },
        amarillo: { 100: '#fff4e0', 300: '#f0e2c8', 500: '#f5b52e', 700: '#8a6512' },
        rojo: { 100: '#ffdcd5', 500: '#e2432c', 600: '#c2371f' },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '22px', hoy: '24px', sheet: '28px' },
      boxShadow: {
        pop: '6px 6px 0 #f0e2c8',
        'pop-sm': '5px 5px 0 #f0e2c8',
        badge: '0 4px 0 rgba(38,33,28,0.15)',
        modal: '0 20px 50px rgba(38,33,28,0.35)',
        sheet: '0 -12px 40px rgba(38,33,28,0.25)',
        toast: '0 8px 24px rgba(38,33,28,0.30)',
      },
      transitionTimingFunction: {
        pop: 'cubic-bezier(0.34,1.56,0.64,1)',
        sheet: 'cubic-bezier(0.22,1,0.36,1)',
      },
      transitionDuration: { 120: '120ms', 180: '180ms', 240: '240ms', 320: '320ms' },
    },
  },
  plugins: [],
}
