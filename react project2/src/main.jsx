// ─────────────────────────────────────────────────────────────
// main.jsx — 앱의 진입점
//
// index.html 의 <div id="root"> 에 App 을 붙인다. 여기서 하는 일은 그게 전부다.
//
// StrictMode 는 개발 중에만 동작하며, 컴포넌트를 일부러 두 번 마운트해서
// 정리(cleanup)를 빠뜨린 코드를 드러낸다. 이 앱의 데이터 훅들이 캐시를
// 모듈 전역에 두는 이유이기도 하다(hooks/useCityPool.js 참고).
// ─────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
