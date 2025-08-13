/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#fff8e6",
          100: "#fdecc3",
          400: "#e9c976",
          500: "#d4af37", // GOLD
          600: "#b8942b"
        },
        base: {
          900: "#0b0b0c",
          800: "#121316"
        }
      }
    }
  },
  plugins: []
}
