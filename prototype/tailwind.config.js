/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        paper: {
          50: "#ffffff",
          100: "#fafafa",
          200: "#f4f4f5",
          300: "#e4e4e7",
          400: "#d4d4d8",
          500: "#a1a1aa",
          600: "#71717a",
          700: "#52525b",
          800: "#27272a",
          900: "#18181b",
        },
        accent: {
          blue: "#0284c7",
          purple: "#9333ea",
          pink: "#db2777",
          green: "#16a34a",
          orange: "#ea580c",
        },
      },
      boxShadow: {
        cell: "0 1px 2px rgba(24,24,27,0.05), 0 1px 3px rgba(24,24,27,0.06)",
        cellHover: "0 4px 10px -2px rgba(24,24,27,0.10), 0 2px 4px -2px rgba(24,24,27,0.06)",
        chip: "0 1px 2px rgba(24,24,27,0.06)",
      },
      keyframes: {
        runningStripe: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 0" },
        },
      },
      animation: {
        runningStripe: "runningStripe 1.2s linear infinite",
      },
    },
  },
  plugins: [],
};
