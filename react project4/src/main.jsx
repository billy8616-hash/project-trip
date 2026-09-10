/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/main.jsx
   [무엇인가]  이 웹사이트의 출발점. index.html 의 <div id="root"> 안에
              React 화면(App)을 그려 넣는다.
   ─────────────────────────────────────────────────────────────── */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
