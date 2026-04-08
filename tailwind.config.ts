import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        success: {
          50: '#ebfbee',
          500: '#40c057',
          600: '#37b24d',
          700: '#2f9e44',
        },
        danger: {
          50: '#fff5f5',
          500: '#fa5252',
          600: '#f03e3e',
          700: '#e03131',
        },
        warning: {
          50: '#fff9db',
          500: '#fab005',
          600: '#f59f00',
        },
      },
    },
  },
  plugins: [],
}

export default config
