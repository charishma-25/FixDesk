import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const apiPort = process.env.API_PORT || env.API_PORT || '3001'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: false,
        },
      },
    },
  }
})
