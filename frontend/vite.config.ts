import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SUBPATH = '/hackathon/preview/doesitworkday/'

export default defineConfig({
  base: SUBPATH,
  plugins: [
    react(),
    {
      name: 'no-redirect',
      configurePreviewServer(server) {
        server.middlewares.stack.unshift({
          route: '',
          handle: (req: any, res: any, next: any) => {
            if (req.url === '/' || req.url === '') {
              req.url = '/index.html'
            }
            next()
          },
        } as any)
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['autoqa.teachx.ai'],
    watch: {
      usePolling: true,
    },
    headers: {
      'Cache-Control': 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
