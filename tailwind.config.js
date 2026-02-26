/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'plugin-bg': '#1e1e1e',
        'plugin-card': '#2d2d2d',
        'plugin-hover': '#3d3d3d',
        'plugin-border': '#444444',
        'plugin-text': '#e5e5e5',
        'plugin-text-dim': '#a0a0a0',
        'plugin-accent': '#007acc',
      },
    },
  },
  plugins: [],
};