import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/vynor-clinic-api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})
