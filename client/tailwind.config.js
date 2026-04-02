/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#11131b",
        panel: "#171a24",
        accent: "#7c5cff",
        coral: "#ff6b8b",
        mint: "#55d6be",
        gold: "#ffca6b"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(11,14,26,0.45)"
      }
    }
  },
  plugins: []
};
