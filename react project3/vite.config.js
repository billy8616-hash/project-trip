import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 백엔드(server/server.js) 주소. /api 로 시작하는 요청을 이리로 넘긴다.
const API_TARGET = 'http://localhost:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': API_TARGET },
  },
  preview: {
    proxy: { '/api': API_TARGET },
  },
})
