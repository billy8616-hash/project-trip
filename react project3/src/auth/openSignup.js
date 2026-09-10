/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/auth/openSignup.js
   [무엇인가]  "회원가입 팝업 창을 여는" 작은 도우미 함수 하나만 들어 있는 파일.
   [원리]  새 페이지를 만드는 게 아니라, 지금 이 사이트의 주소 뒤에 ?page=signup 를 붙여
           작은 창으로 띄운다. 그러면 main.jsx 가 그 창에서는 회원가입 화면(SignupPage)을 그린다.
   [연결]  GlassNav / LoginModal 의 '회원가입' 버튼이 이 함수를 부른다.
   ─────────────────────────────────────────────────────────────── */

export function openSignupWindow() {
  return window.open(
    window.location.pathname + '?page=signup', // 열 주소 (현재 페이지 + ?page=signup)
    'balgil-signup', // 창 이름 (같은 이름이면 새 창을 또 만들지 않고 기존 창을 재사용)
    'width=460,height=700,menubar=no,toolbar=no,location=no,status=no', // 창 크기/모양
  )
}
