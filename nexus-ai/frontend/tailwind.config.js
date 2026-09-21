/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: '#040711',
          panel: 'rgba(10, 18, 38, 0.7)',
          border: '#1a2e5a',
          cyan: '#00f0ff',
          blue: '#0066ff',
          magenta: '#ff0077',
          gold: '#ffb700',
          emerald: '#00ff88',
          danger: '#ff2a2a'
        }
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.7, filter: 'drop-shadow(0 0 15px rgba(0,240,255,0.6))' },
          '50%': { opacity: 1, filter: 'drop-shadow(0 0 30px rgba(0,240,255,0.9))' }
        }
      }
    },
  },
  plugins: [],
}
