/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#06B6D4',
        background: '#0F172A',
        surface: '#1E293B',
        onSurface: '#E2E8F0',
        accent: '#06B6D4',
        muted: '#64748B',
        error: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
        record: '#F43F5E',
      },
    },
  },
  plugins: [],
};
