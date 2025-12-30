/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                dark: {
                    950: '#0a0a0c',
                    900: '#121212',
                    800: '#1e1e2e',
                    700: '#2d2d3f',
                    600: '#3f3f54',
                    500: '#52526a',
                    400: '#7c7c96',
                },
                primary: {
                    DEFAULT: '#3b82f6',
                    hover: '#2563eb',
                    light: '#60a5fa',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
