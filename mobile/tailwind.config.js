/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    space: false,
  },
  theme: {
    // Foster Famous design tokens. Keep in sync with src/lib/theme.ts
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FBF5E9",
          deep: "#F6EEDD",
        },
        beige: {
          DEFAULT: "#F0E4CE",
          dark: "#E6D6B8",
        },
        forest: {
          DEFAULT: "#14432A",
          deep: "#0B2A1A",
          mid: "#1F5D3A",
          soft: "#DDE8DE",
        },
        clay: {
          DEFAULT: "#E1712B",
          deep: "#C25A1B",
          soft: "#FBE3CE",
        },
        ink: {
          DEFAULT: "#1D1B17",
          soft: "#4A463D",
          muted: "#847C6C",
        },
        hairline: "#E5D8C0",
      },
      fontFamily: {
        display: ["Fraunces_700Bold"],
        displaySemi: ["Fraunces_600SemiBold"],
        sans: ["Nunito_400Regular"],
        medium: ["Nunito_500Medium"],
        semibold: ["Nunito_600SemiBold"],
        bold: ["Nunito_700Bold"],
        extrabold: ["Nunito_800ExtraBold"],
      },
      borderRadius: {
        "4xl": "28px",
        "5xl": "36px",
      },
      fontSize: {
        xs: "10px",
        sm: "12px",
        base: "14px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
        "5xl": "48px",
        "6xl": "56px",
        "7xl": "64px",
        "8xl": "72px",
        "9xl": "80px",
      },
    },
  },
  darkMode: "class",
  plugins: [
    plugin(({ matchUtilities, theme }) => {
      const spacing = theme("spacing");

      // space-{n}  ->  gap: {n}
      matchUtilities(
        { space: (value) => ({ gap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-x-{n}  ->  column-gap: {n}
      matchUtilities(
        { "space-x": (value) => ({ columnGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-y-{n}  ->  row-gap: {n}
      matchUtilities(
        { "space-y": (value) => ({ rowGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );
    }),
  ],
};

