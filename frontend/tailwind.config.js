/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          // New Palette
          gold: {
            light: '#E7D48D',
            DEFAULT: '#D4AF37',
            dark: '#B8942B',
          },
          sand: {
            light: '#FFFBF2',
            DEFAULT: '#F7EFE3',
          },
          charcoal: {
            light: '#4B5563', // gray-600
            DEFAULT: '#1F2937', // gray-800
            dark: '#111827',   // gray-900
          }
        },
      },
      boxShadow: {
        'soft': '0 4px 12px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 10px 30px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    }
  },
  plugins: [],
}