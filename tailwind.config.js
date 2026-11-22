/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class" lets the in-app theme choice override the system setting on web
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
}