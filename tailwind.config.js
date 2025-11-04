/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
theme: {
  extend: {
    colors: {
      // Professional ERP System Color Palette
      primary: {
        dark: '#0A4D68',   // Deep teal blue – for navigation bar, headers, and primary buttons
        medium: '#088395', // Vibrant cyan-blue – for hover, highlights, and icons
        light: '#05BFDB',  // Bright accent blue – for secondary actions or status indicators
      },
      neutral: {
        dark: '#2E3A46',   // For text and headings
        medium: '#6C7A89', // For labels, borders, and icons
        light: '#F4F7FA',  // For background and card containers
        soft: '#E9EEF2',   // Subtle gray-blue background sections
      },
      accent: {
        success: '#2BAE66', // For success states
        warning: '#F4A261', // For warnings or low stock alerts
        danger: '#E63946',  // For errors or critical alerts
      },
    },
    animation: {
      'fade-in': 'fadeIn 0.6s ease-out forwards',
      'slide-in': 'slideIn 0.4s ease-out',
      'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    },
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0', transform: 'translateY(10px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
      slideIn: {
        '0%': { opacity: '0', transform: 'translateX(-10px)' },
        '100%': { opacity: '1', transform: 'translateX(0)' },
      },
    },
    borderWidth: {
      '3': '3px',
    },
  },
},
  plugins: [],
}
