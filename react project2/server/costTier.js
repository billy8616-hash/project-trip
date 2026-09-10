// 이용요금(TourAPI usefee) 텍스트나 Google priceLevel 에서 대략적인 비용 등급을 뽑는다.
// 반환: 'free' | 'low' | 'mid' | 'high' | ''  (판단 불가면 빈 문자열)

const FREE_RE = /(무료|없음|무료\s*입장|free)/i

// 텍스트에서 첫 번째 "3,000원" 같은 금액을 숫자로. 못 찾으면 null.
export function firstWon(text) {
  const match = /([0-9][0-9,]{0,9})\s*원/.exec(String(text || ''))
  if (!match) return null
  const won = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(won) ? won : null
}

export function costTierFromFee(feeText) {
  const text = String(feeText || '').trim()
  if (!text) return ''
  const won = firstWon(text)
  if (won == null) return FREE_RE.test(text) ? 'free' : ''
  if (won === 0) return 'free'
  if (won < 5000) return 'low'
  if (won <= 15000) return 'mid'
  return 'high'
}

const PRICE_LEVEL_TIER = {
  PRICE_LEVEL_FREE: 'free',
  PRICE_LEVEL_INEXPENSIVE: 'low',
  PRICE_LEVEL_MODERATE: 'mid',
  PRICE_LEVEL_EXPENSIVE: 'high',
  PRICE_LEVEL_VERY_EXPENSIVE: 'high',
}

export function costTierFromPriceLevel(priceLevel) {
  return PRICE_LEVEL_TIER[priceLevel] || ''
}
