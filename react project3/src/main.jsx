/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/main.jsx
   [무엇인가]  이 웹사이트가 실행될 때 "가장 먼저" 돌아가는 파일 (출발점).
   [하는 일]
     1. index.html 안의 <div id="root"></div> 라는 빈 상자를 찾는다.
     2. 그 상자 안에 React 화면을 그려 넣는다.
     3. 주소(URL)에 ?page=signup 이 붙어 있으면 회원가입 화면을,
        아니면 평소의 메인 화면(App)을 그린다.
   [연결]  여기서 App.jsx(메인) 와 auth/SignupPage.jsx(회원가입) 를 불러온다.
   ─────────────────────────────────────────────────────────────── */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // 사이트 전체에 공통으로 적용되는 기본 디자인(CSS)
import App from './App.jsx' // 평소에 보이는 메인 화면
import SignupPage from './auth/SignupPage.jsx' // 회원가입 전용 화면(팝업 창)

/* 회원가입은 별도 창(window.open('?page=signup')) 으로 열린다.
   주소에 page=signup 이 있으면 회원가입 화면을, 없으면 메인을 렌더한다.
   ('렌더한다' = 화면에 그린다는 뜻) */
// 지금 주소가 "회원가입 창"인지 확인한다. (예: .../index.html?page=signup → true)
const isSignup =
  new URLSearchParams(window.location.search).get('page') === 'signup'

// root 상자 안에 화면을 그린다.
// isSignup 이 true 면 <SignupPage/>, 아니면 <App/> 을 보여준다. (삼항연산자: 조건 ? 참 : 거짓)
createRoot(document.getElementById('root')).render(
  <StrictMode>{isSignup ? <SignupPage /> : <App />}</StrictMode>,
)
