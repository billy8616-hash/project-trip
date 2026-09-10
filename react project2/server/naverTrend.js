const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const BASE_URL = 'https://openapi.naver.com/v1/datalab/search'

// 네이버 데이터랩은 한 요청에 keywordGroups 를 최대 5개까지만 받는다.
const MAX_GROUPS_PER_REQUEST = 5
const TREND_DAYS = 30
const RECENT_DAYS = 3

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function chunk(list, size) {
  const chunks = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
}

async function fetchTrendBatch(cityNames) {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (TREND_DAYS - 1))

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      timeUnit: 'date',
      keywordGroups: cityNames.map((name) => ({ groupName: name, keywords: [`${name} 여행`] })),
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.results) {
    throw new Error(data?.errorMessage || '네이버 데이터랩 조회에 실패했어요.')
  }
  return data.results
}

// 도시별로 최근 며칠(RECENT_DAYS) 평균을 그 이전 기간 평균과 비교해서 상승세인지만 본다.
// (데이터랩 ratio 는 그룹마다 따로 정규화될 수 있어 도시 간 절대값 비교보다 "자기 자신 대비 변화"가 안전하다.)
function toTrend(result) {
  const values = result.data.map((point) => point.ratio)
  if (values.length < RECENT_DAYS + 1) return { risingRatio: null }

  const recent = values.slice(-RECENT_DAYS)
  const baseline = values.slice(0, -RECENT_DAYS)
  const avg = (list) => list.reduce((sum, v) => sum + v, 0) / list.length
  const baselineAvg = avg(baseline)
  const recentAvg = avg(recent)

  if (baselineAvg <= 0) return { risingRatio: null }
  return { risingRatio: recentAvg / baselineAvg }
}

const trendCache = new Map() // cityName -> { trend, cachedAt }
const TREND_TTL_MS = 24 * 60 * 60 * 1000 // 하루 단위 데이터라 하루 한 번이면 충분하다.

export async function getCityTrends(cityNames) {
  const uniqueNames = [...new Set(cityNames)]

  // 트렌드 배지는 부가 기능이라, 키가 없으면 에러 대신 "상승세 없음"으로 조용히 비활성화한다.
  // (프런트는 risingRatio: null 을 이미 "배지 안 띄움"으로 처리한다)
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return Object.fromEntries(uniqueNames.map((name) => [name, { risingRatio: null }]))
  }

  const now = Date.now()
  const stale = uniqueNames.filter((name) => {
    const cached = trendCache.get(name)
    return !cached || now - cached.cachedAt >= TREND_TTL_MS
  })

  for (const group of chunk(stale, MAX_GROUPS_PER_REQUEST)) {
    if (group.length === 0) continue
    const results = await fetchTrendBatch(group)
    for (const result of results) {
      trendCache.set(result.title, { trend: toTrend(result), cachedAt: now })
    }
  }

  return Object.fromEntries(
    uniqueNames.map((name) => [name, trendCache.get(name)?.trend || { risingRatio: null }]),
  )
}
