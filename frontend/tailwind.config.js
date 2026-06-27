/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0D1117',
          card: '#161B22',
          sidebar: '#010409',
          border: '#30363D',
        },
        accent: {
          blue: '#2F81F7',
          green: '#3FB950',
          amber: '#D29922',
          red: '#F85149',
          purple: '#A371F7',
        },
        text: {
          primary: '#E6EDF3',
          secondary: '#7D8590',
          muted: '#484F58',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
