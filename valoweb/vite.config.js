import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log('=== Vite 환경 변수 ===')
  console.log('VITE_VALORANT_API_KEY:', env.VITE_VALORANT_API_KEY ? '설정됨' : '설정되지 않음')
  console.log('==================')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/valorant-api': {
          target: 'https://api.henrikdev.xyz',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/valorant-api/, '')
        }
      }
    }
  }
})