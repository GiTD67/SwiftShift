/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Additive only — does NOT override Tailwind's default radius scale, so
      // existing rounded-2xl/3xl corners are untouched. New design radii are
      // available as utilities rounded-glass-* for intentional future use.
      borderRadius: {
        "glass-md": "14px",
        "glass-lg": "20px",
        "glass-xl": "28px",
      },
      transitionTimingFunction: {
        liquid: "cubic-bezier(.32,.72,0,1)",
        standard: "cubic-bezier(.40,0,.20,1)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
}
