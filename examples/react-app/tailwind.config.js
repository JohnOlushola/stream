/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quantity: '#3b82f6',
        email: '#22c55e',
        datetime: '#eab308',
        url: '#a855f7',
        phone: '#ec4899',
      },
    },
  },
  plugins: [],
}
