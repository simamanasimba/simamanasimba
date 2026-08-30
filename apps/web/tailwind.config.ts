import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#DC2626",
          dark: "#991B1B",
          light: "#FEE2E2",
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          600: "#DC2626",
          700: "#B91C1C",
          900: "#7F1D1D",
        },
        surface: "#F7F5F4",
        card: "#FFFFFF",
        ink: "#161314",
        muted: "#8A7F7C",
        line: "#EFE7E5",
        success: "#16A34A",
        warning: "#D97706",
        info: "#2563EB",
        violet: "#7C3AED",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Helvetica", "sans-serif"],
        display: ["var(--font-montserrat)", "var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,19,20,0.04), 0 8px 24px -12px rgba(22,19,20,0.10)",
        pop: "0 10px 30px -10px rgba(220,38,38,0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
        "app-wash": "radial-gradient(1200px 600px at 100% -10%, #FEE2E2 0%, rgba(254,226,226,0) 60%), radial-gradient(900px 500px at -10% 10%, #FEF2F2 0%, rgba(254,242,242,0) 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
