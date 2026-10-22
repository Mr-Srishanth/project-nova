/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        "foreground-muted": "var(--foreground-muted)",
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        accent: {
          blue: "var(--accent-blue)",
          "blue-strong": "var(--accent-blue-strong)",
          yellow: "var(--accent-yellow)",
          "yellow-soft": "var(--accent-yellow-soft)",
        },
        danger: "var(--danger)",
      },
      boxShadow: {
        hard: "var(--shadow-hard)",
        "hard-sm": "2px 2px 0 var(--border)",
        "hard-lg": "6px 6px 0 var(--border)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "-apple-system", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        tactile: "8px",
        "tactile-sm": "4px",
        "tactile-lg": "12px",
      },
    },
  },
  plugins: [],
};
