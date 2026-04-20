/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- THIS IS THE CRITICAL LINE
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}