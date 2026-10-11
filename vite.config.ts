import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward API calls to Spring Boot so the browser only ever talks to one origin,
    // which means the backend needs no CORS setup during development
    proxy: { '/api': 'http://localhost:8080' },
  },
})
