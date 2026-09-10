import { placeKindOf } from './placeKind.js'

// 서버가 실제 데이터(입장료·priceLevel)로 costTier 를 못 정했을 때, 장소 종류로 대략 추정한다.
const KIND_TIER = {
  nature: 'low',
  market: 'low',
  history: 'low',
  viewpoint: 'mid',
  museum: 'mid',
  cafe: 'mid',
  restaurant: 'mid',
  sight: 'mid',
  themepark: 'high',
  spa: 'high',
  bar: 'high',
}

export const COST_TIER_LABEL = { free: '무료', low: '저렴한 편', mid: '보통', high: '비싼 편' }

// 'free' | 'low' | 'mid' | 'high' | ''
export function costTierOf(place) {
  if (place?.costTier) return place.costTier
  return KIND_TIER[placeKindOf(place)] || ''
}

// 예산대(저예산·보통·프리미엄)와 장소 비용대를 대조한 점수 보정.
// 저예산: 비싼 곳은 큰 감점, 무료·저렴은 가점. 프리미엄: 그 반대. 보통: 중립.
export function budgetAdjust(budgetTier, place) {
  const cost = costTierOf(place)
  if (!budgetTier || !cost) return 0

  if (budgetTier === '저예산') {
    if (cost === 'high') return -8
    if (cost === 'free' || cost === 'low') return 4
    return 0
  }
  if (budgetTier === '프리미엄') {
    if (cost === 'free') return -2
    if (cost === 'high' || cost === 'mid') return 4
    return 0
  }
  return 0
}

// 표시 텍스트: 실제 요금 문구가 있으면 그걸, 없으면 등급 라벨.
export function feeLabelOf(place) {
  if (place?.feeText) return place.feeText
  const cost = costTierOf(place)
  return cost ? COST_TIER_LABEL[cost] : null
}

// "성인 3,000원" 같은 문구에서 첫 금액(원)을 숫자로. 못 읽으면 0.
export function feeWonOf(place) {
  const match = /([0-9][0-9,]{0,9})\s*원/.exec(String(place?.feeText || ''))
  if (!match) return 0
  const won = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(won) ? won : 0
}

// ── 예상 비용(1인) ─────────────────────────────────────────────────────────
// 실제 금액 데이터가 없을 때 쓰는 추정치. 대략적인 눈대중용.
const MEAL_ESTIMATE = {
  저예산: { lunch: 6000, dinner: 9000, cafe: 4000 },
  보통: { lunch: 13000, dinner: 18000, cafe: 6500 },
  프리미엄: { lunch: 25000, dinner: 40000, cafe: 9000 },
}
// 입장료 데이터가 없는 유료 성격 장소의 등급별 추정치.
const PAID_TIER_WON = { low: 5000, mid: 12000, high: 30000 }
const TRANSIT_WON_PER_LEG = { 도보: 0, 대중교통: 1500, 자차: 3000 }
// 데이터 없으면 무료로 보는 장소 종류 (공원·시장·유적·전망대·거리 등).
const USUALLY_FREE_KINDS = new Set(['nature', 'market', 'history', 'viewpoint', 'sight'])

function isCafePlace(place) {
  return placeKindOf(place) === 'cafe' || (place?.source === 'kakao' && /카페|커피/.test(place?.category || ''))
}
// 식사/음료로 돈을 쓰는 곳인지 (이름에 "시장"이 들어간 식당 등 placeKindOf 오분류를 보완).
function isMealPlace(place) {
  const kind = placeKindOf(place)
  return (
    kind === 'cafe' ||
    kind === 'restaurant' ||
    kind === 'bar' ||
    place?.source === 'kakao' ||
    place?.assignedSlot === '점심 맛집'
  )
}

// 한 장소에서 쓸 예상 비용(1인, 원). 못 추정하면 0.
export function placeCostWon(place, budgetTier) {
  const realFee = feeWonOf(place)
  if (realFee > 0) return realFee

  const meal = MEAL_ESTIMATE[budgetTier] || MEAL_ESTIMATE['보통']
  if (isCafePlace(place)) return meal.cafe
  if (isMealPlace(place)) return place?.assignedSlot === '저녁' ? meal.dinner : meal.lunch

  // 무료 성격 장소는 데이터 없으면 0
  if (USUALLY_FREE_KINDS.has(placeKindOf(place))) return 0
  // 유료 성격(박물관·테마파크·온천)만 등급으로 추정
  const tier = costTierOf(place)
  return PAID_TIER_WON[tier] ?? PAID_TIER_WON.low
}

// 하루 코스 전체 예상 비용을 입장·식사·이동으로 나눠 돌려준다.
export function estimateDayCost(places, transport, budgetTier) {
  let admission = 0
  let meals = 0
  for (const place of places) {
    const won = placeCostWon(place, budgetTier)
    if (isCafePlace(place) || isMealPlace(place)) meals += won
    else admission += won
  }
  const legs = Math.max(0, places.length - 1)
  const transit = legs * (TRANSIT_WON_PER_LEG[transport] ?? 1500)
  return { admission, meals, transit, total: admission + meals + transit }
}
