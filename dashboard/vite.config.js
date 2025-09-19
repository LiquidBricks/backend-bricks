import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 64209,
    host: true,
    strictPort: true,
    open: false,
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 64209,
    host: true,
    strictPort: true,
    open: false,
  }
})
