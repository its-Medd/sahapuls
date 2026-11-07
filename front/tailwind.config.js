/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Validated data-viz palette (see dataviz skill references/palette.md).
        surface: {
          DEFAULT: '#fcfcfb',
          dark: '#1a1a19',
        },
        plane: {
          DEFAULT: '#f9f9f7',
          dark: '#0d0d0d',
        },
        ink: {
          primary: '#0b0b0b',
          'primary-dark': '#ffffff',
          secondary: '#52514e',
          'secondary-dark': '#c3c2b7',
          muted: '#898781',
        },
        line: {
          DEFAULT: '#e1e0d9',
          dark: '#2c2c2a',
        },
        accent: {
          DEFAULT: '#2a78d6',
          dark: '#3987e5',
        },
        status: {
          good: '#0ca30c',
          warning: '#fab219',
          critical: '#d03b3b',
        },
      },
    },
  },
  plugins: [],
};
