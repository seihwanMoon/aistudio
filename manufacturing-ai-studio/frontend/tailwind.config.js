/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A5F",
          light: "#2E86C1",
        },
        accent: "#1ABC9C",
        danger: "#E74C3C",
        warning: "#E67E22",
      },
      fontFamily: {
        korean: ["Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
