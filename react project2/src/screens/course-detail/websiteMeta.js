// ─────────────────────────────────────────────────────────────
// screens/course-detail/websiteMeta.js — 홈페이지/SNS 링크 아이콘·라벨 판별
//
// 링크 하나로 홈페이지/SNS 를 다 받기 때문에(구글 websiteUri), 인스타그램 주소면
// 라벨·아이콘만 그에 맞게 바꿔 보여준다 — 실제로는 하나의 필드다.
// ─────────────────────────────────────────────────────────────

export function websiteMeta(url) {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('instagram.com')) return { icon: 'instagram', label: '인스타그램' }
    return { icon: 'globe', label: '홈페이지' }
  } catch {
    return { icon: 'globe', label: '홈페이지' }
  }
}
