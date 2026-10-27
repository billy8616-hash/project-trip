// ─────────────────────────────────────────────────────────────
// main.jsx — 앱의 진입점
//
// index.html 의 <div id="root"> 에 App 을 붙인다.
//
// AppRoot 의 key 는 "앱을 처음부터 다시 띄우기"용이다. 서버에 남겨 둔 작업 중인 코스로
// 갈아탈 때(App 의 onRestart) key 를 바꿔 App 전체를 새로 마운트한다.
//
// StrictMode 는 개발 중에만 동작하며, 컴포넌트를 일부러 두 번 마운트해서
// 정리(cleanup)를 빠뜨린 코드를 드러낸다. 이 앱의 데이터 훅들이 캐시를
// 모듈 전역에 두는 이유이기도 하다(hooks/useCityPool.js 참고).
// ─────────────────────────────────────────────────────────────

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function AppRoot() {
  const [generation, setGeneration] = useState(0)
  return <App key={generation} onRestart={() => setGeneration((n) => n + 1)} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
