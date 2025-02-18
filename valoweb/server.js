import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// API 프록시 설정
app.use('/valorant-api', createProxyMiddleware({
  target: 'https://api.henrikdev.xyz',
  changeOrigin: true,
  pathRewrite: {
    '^/valorant-api': ''
  },
  onProxyReq: (proxyReq) => {
    // API 키 헤더 추가
    proxyReq.setHeader('Authorization', process.env.VITE_VALORANT_API_KEY)
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err)
    res.status(500).json({ error: 'Proxy Error' })
  },
  logLevel: 'debug'
}))

// 정적 파일 제공
app.use(express.static('dist'))

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  next()
})

// SPA를 위한 fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const HOST = process.env.HOST || '0.0.0.0'  // 모든 네트워크 인터페이스에서 수신
const PORT = process.env.PORT || 80  // 80포트로 변경

app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`)
}) 