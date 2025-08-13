/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
      extend: {
        colors: {
          brand: {
            50: "#fff7ed",
            100: "#ffedd5",
            400: "#fb923c",
            500: "#f97316",
            600: "#ea580c"
          }
        }
      }
    },
    plugins: []
  };
  