// ─────────────────────────────────────────────────────────────
// main.jsx — 앱의 진입점
//
// index.html 의 <div id="root"> 에 App 을 붙이고, 방문자 집계 스크립트를 한 번 띄운다.
//
// StrictMode 는 개발 중에만 동작하며, 컴포넌트를 일부러 두 번 마운트해서
// 정리(cleanup)를 빠뜨린 코드를 드러낸다. 이 앱의 데이터 훅들이 캐시를
// 모듈 전역에 두는 이유이기도 하다(hooks/useCityPool.js 참고).
// ─────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.jsx'

// Vercel Web Analytics — 방문자·페이지 조회수 집계. 개발 서버에서는 전송 없이 디버그 모드로만 돈다.
inject()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
