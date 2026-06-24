/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#05070D",
        primary: "#3B82F6",
        accent: "#22D3EE",
        bodyText: "#E2E8F0",
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        code: ["JetBrains Mono", "monospace"],
        body: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'border-gradient': 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(34, 211, 238, 0.1) 100%)',
        'glow-gradient': 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(59, 130, 246, 0.2)',
      }
    },
  },
  plugins: [],
}
