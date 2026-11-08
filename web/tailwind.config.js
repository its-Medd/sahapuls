export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: 'var(--surface)', dark: 'var(--surface)' },
        plane: { DEFAULT: 'var(--plane)', dark: 'var(--plane)' },
        ink: {
          primary: 'var(--ink)',
          'primary-dark': 'var(--ink)',
          secondary: 'var(--muted)',
          'secondary-dark': 'var(--muted)',
          muted: 'var(--muted)',
        },
        line: { DEFAULT: 'var(--line)', dark: 'var(--line)' },
        accent: { DEFAULT: 'var(--accent)', dark: 'var(--accent)' },
        status: { good: 'var(--accent)', warning: 'var(--warning)', critical: 'var(--critical)' },
      },
    },
  },
  plugins: [],
};
