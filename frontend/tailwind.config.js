
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        brand: "#3659E3",
        mint: "#DDF7EB",
      },
      boxShadow: {
        soft: "0 12px 40px rgba(16,24,40,.06)",
      },
    },
  },
  plugins: [],
};
