// ─────────────────────────────────────────────────────────────
// server/httpError.js — 오류 응답을 안전하게 만든다
//
// 라우트가 catch 에서 error.message 를 그대로 응답에 담으면 Prisma·Supabase 같은 라이브러리의
// 내부 문구(쿼리, 테이블·연결 정보)가 사용자에게 나간다. 그래서
//   · 우리 코드가 일부러 status(4xx)를 붙여 던진 오류(예: "저장은 최대 50개까지…")만 메시지를 보여 주고
//   · 그 밖의 오류는 로그에만 남기고 사용자에게는 라우트가 정한 일반 문구를 준다.
// ─────────────────────────────────────────────────────────────

// 응답에 담을 메시지. 의도된 4xx 오류만 원문을 쓰고 나머지는 fallback.
export function publicMessage(error, fallback) {
  const status = Number(error?.status)
  if (status >= 400 && status < 500 && error?.message) return error.message
  console.error('[error]', error)
  return fallback
}

// 응답에 쓸 상태 코드. 의도된 4xx 가 아니면 fallbackStatus.
export function publicStatus(error, fallbackStatus = 500) {
  const status = Number(error?.status)
  return status >= 400 && status < 500 ? status : fallbackStatus
}

// 어느 라우트에서도 잡히지 않은 오류(JSON 파싱 실패, 미들웨어 예외 등)의 마지막 방어선.
// Express 기본 핸들러는 HTML 을 내보내므로 JSON 으로 통일한다.
export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error)
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: '요청 형식이 올바르지 않아요.' })
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: '보내는 내용이 너무 커요.' })
  }
  // 잘못된 요청(예: 깨진 URL 인코딩 %E0%A4%A, 압축 본문 오류)을 라이브러리가 4xx 로 표시해 올리는 경우.
  // 5xx 로 바꿔 내보내면 클라이언트 실수가 서버 장애로 집계돼 모니터링이 오염된다. 문구는 일반 문구만 쓴다.
  const status = Number(error?.status ?? error?.statusCode)
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ message: status === 404 ? '요청한 내용을 찾지 못했어요.' : '요청이 올바르지 않아요.' })
  }
  console.error('[unhandled]', error)
  return res.status(500).json({ message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' })
}
