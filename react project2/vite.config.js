import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 프런트엔드(5173)에서 /api 로 보낸 요청을 백엔드(4000)로 그대로 전달한다.
    // 같은 오리진으로 보이게 되어 CORS / "Failed to fetch" 문제를 피할 수 있다.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
