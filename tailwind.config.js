/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#1a365d',
          700: '#153e75',
          800: '#0f2b4c',
          900: '#0a1929',
        },
        gold: {
          400: '#d4a843',
          500: '#c49a2a',
        },
      },
    },
  },
  plugins: [],
};
