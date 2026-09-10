// TourAPI detailIntro2 의 이용시간(usetime)·쉬는날(restdate) 안내는 자유 형식 한국어 문장이다.
// (예: "09:00~18:00", "[하절기] 09:00~19:00 [동절기] 09:00~18:00", "매주 월요일 휴관", "연중무휴")
// 원문은 그대로 저장해 사용자에게 보여주고, 여기서는 코스 로직이 쓸 수 있게
// "확실히 읽히는 것만" 구조화한다. 애매하면 null/빈 배열을 돌려 과도한 필터링을 피한다.

const WEEKDAY_INDEX = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

// "24시간", "상시개방" 처럼 시각 없이 항상 여는 곳을 나타내는 표현.
const ALWAYS_OPEN_RE = /(24\s*시간|24시간제|상시\s*개방|상시개방|연중\s*상시|항상\s*개방|00:00\s*[~\-–]\s*24:00)/

// "09:00~18:00", "09 : 00 - 18 : 00" 형태.
const HHMM_RANGE_RE = /(\d{1,2})\s*:\s*(\d{2})\s*[~\-–]\s*(\d{1,2})\s*:\s*(\d{2})/
// "9시~18시", "오전 9시 ~ 오후 6시" 형태 (분 단위 없음).
const HOUR_RANGE_RE = /(오전|오후)?\s*(\d{1,2})\s*시\s*[~\-–]\s*(오전|오후)?\s*(\d{1,2})\s*시/

function toMinutes(hour, minute, meridiem) {
  let h = hour
  if (meridiem === '오후' && h < 12) h += 12
  if (meridiem === '오전' && h === 12) h = 0
  return h * 60 + minute
}

// openText -> { opensAt, closesAt, alwaysOpen }
// 여러 시간대가 섞여 있으면(계절별 등) 가장 먼저 나오는 한 쌍만 취한다.
export function parseOpeningHours(openText) {
  const text = String(openText || '').trim()
  const empty = { opensAt: null, closesAt: null, alwaysOpen: false }
  if (!text) return empty

  const hhmm = HHMM_RANGE_RE.exec(text)
  if (hhmm) {
    const opensAt = toMinutes(Number(hhmm[1]), Number(hhmm[2]))
    let closesAt = toMinutes(Number(hhmm[3]), Number(hhmm[4]))
    if (closesAt <= opensAt) closesAt += 24 * 60 // 새벽까지 영업하는 경우
    if (opensAt >= 0 && opensAt < 24 * 60 && closesAt - opensAt <= 24 * 60) {
      return { opensAt, closesAt, alwaysOpen: false }
    }
  }

  const hour = HOUR_RANGE_RE.exec(text)
  if (hour) {
    const opensAt = toMinutes(Number(hour[2]), 0, hour[1])
    let closesAt = toMinutes(Number(hour[4]), 0, hour[3])
    if (closesAt <= opensAt) closesAt += 24 * 60
    if (opensAt >= 0 && opensAt < 24 * 60 && closesAt - opensAt <= 24 * 60) {
      return { opensAt, closesAt, alwaysOpen: false }
    }
  }

  // 시각을 못 읽었을 때만 "상시개방" 류를 본다 (구체적 시간이 있으면 그게 우선).
  if (ALWAYS_OPEN_RE.test(text)) return { opensAt: null, closesAt: null, alwaysOpen: true }

  return empty
}

// closedText -> { closedWeekdays: number[] }  (0=일 ~ 6=토, 정렬·중복제거됨)
// "매주 월요일", "월,화요일 휴관" 처럼 요일이 분명한 것만 잡는다.
// "설날·추석", "1월 1일" 같은 특정일 휴무는 요일로 환산 불가하므로 무시한다.
export function parseClosedDays(closedText) {
  const text = String(closedText || '').trim()
  if (!text) return { closedWeekdays: [] }
  if (/(연중\s*무휴|연중무휴|무휴|없음|연중\s*개방|365일|상시\s*개방|상시개방)/.test(text)) {
    return { closedWeekdays: [] }
  }

  const closed = new Set()
  // "월요일", "매주 월요일", "월,화 요일", "월·수·금요일" 처럼 요일 글자들이 "요일" 앞에 나열된 덩어리.
  const chunks = text.match(/[일월화수목금토](?:\s*[,、·/및\s]*[일월화수목금토])*\s*요일/g) || []
  for (const chunk of chunks) {
    // 끝의 "요일"을 떼어낸다 — 안 그러면 "월요일"의 '일'까지 일요일로 잘못 잡는다.
    const body = chunk.replace(/\s*요일\s*$/, '')
    for (const char of body) {
      if (char in WEEKDAY_INDEX) closed.add(WEEKDAY_INDEX[char])
    }
  }
  return { closedWeekdays: [...closed].sort((a, b) => a - b) }
}
