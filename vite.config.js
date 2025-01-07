import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const HOST = process.env.HOST || 'localhost'
const PORT = process.env.PORT || 3000

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: `http://${HOST}:${PORT}`,
        changeOrigin: true
      }
    }
  }
})
