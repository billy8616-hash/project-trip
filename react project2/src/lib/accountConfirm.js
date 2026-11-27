// ─────────────────────────────────────────────────────────────
// lib/accountConfirm.js — 회원 탈퇴 화면의 확인 규칙 (화면과 분리해 테스트하기 쉽게 둔 순수 함수)
// ─────────────────────────────────────────────────────────────

// 입력해야 하는 확인 문구.
export const CONFIRM_PHRASE = '탈퇴합니다'

// 한글 조합 입력(IME)과 붙여넣기가 같은 글자로 보이도록 NFC 로 맞춰 비교하고, 앞뒤 공백은 봐준다.
export function isConfirmPhrase(text) {
  return String(text ?? '').normalize('NFC').trim() === CONFIRM_PHRASE
}

// 실패 원인을 사용자 말로. 서버가 응답으로 준 문구(status 가 있는 오류)는 이미 사용자용 문장이라 그대로 쓰고,
// 응답 자체가 없는 경우(인터넷 끊김)는 일부가 이미 지워졌을 수 있음을 알려 준다.
export function failureMessage(error) {
  if (error?.status) return error.message
  return '인터넷 연결을 확인하고 다시 눌러 주세요. 일부 정보가 이미 지워졌을 수 있고, 다시 누르면 남은 정보만 이어서 지워요.'
}

// 요청을 보냈지만 결과를 알 수 없는 실패인가 (응답이 없거나 서버 오류).
// 이 뒤에 오는 401 은 "탈퇴가 이미 끝나 계정이 없어짐"일 가능성이 커서 완료로 본다.
// 처음 보낸 요청의 401 은 로그인이 만료된 것뿐이라 완료로 보면 안 된다.
export function isUnknownOutcome(error) {
  return !error?.status || error.status >= 500
}
