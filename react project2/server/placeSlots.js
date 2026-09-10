// 장소를 어느 시간대 슬롯에 넣을지 카테고리로 분류한다.
// 예전에는 "제목에 타워/야경이 있으면 저녁, 나머지는 전부 오전" 수준이었는데,
// TourAPI 분류코드(cat1~cat3)와 카카오 category_name 을 근거로 좀 더 맞게 나눈다.
// 한 장소가 여러 슬롯에 어울릴 수 있으므로(공원=오전·오후, 식당=점심·저녁) 배열로 돌려준다.
//
// 슬롯 라벨은 src/data/travelOptions.js 의 SLOT_LABELS 와 반드시 일치해야 한다.
const SLOT = {
  morning: '오전',
  lunch: '점심 맛집',
  afternoon: '오후 카페',
  evening: '저녁',
}
const SLOT_ORDER = [SLOT.morning, SLOT.lunch, SLOT.afternoon, SLOT.evening]

// 유효한 슬롯만 남기고 중복 제거. 순서는 넣은 그대로 둔다 — 첫 항목이 그 장소의 "대표 시간대"라
// slot(단수)·SLOT_DEFAULTS 조회에 쓰인다. 코스 빌더는 배열 포함 여부만 보므로 순서와 무관하다.
// 아무것도 안 남으면 낮 시간대로 폴백.
function normalize(slots) {
  const unique = [...new Set(slots.filter((slot) => SLOT_ORDER.includes(slot)))]
  return unique.length > 0 ? unique : [SLOT.morning, SLOT.afternoon]
}

// TourAPI 관광지(12)/문화시설(14) 항목 -> 슬롯 배열.
// cat3(9자리) > cat2(5자리) > cat1(3자리) > 제목 키워드 순으로 확신이 강한 것부터 본다.
export function slotsForTourPlace({ contentTypeId, cat1 = '', cat2 = '', cat3 = '', title = '' } = {}) {
  const c1 = String(cat1 || '')
  const c2 = String(cat2 || '')
  const c3 = String(cat3 || '')
  const name = String(title || '')

  // --- 저녁: 야경·전망 명소, 온천/스파, 공연장 ---
  // A02050200 = 전망대/기념탑, A0205010* = 다리/대교, A0205030* = 분수
  if (c3.startsWith('A0205020') || c3.startsWith('A0205010') || c3.startsWith('A0205030')) {
    return normalize([SLOT.evening])
  }
  // A02020200 = 온천/욕장/스파, A0202030* = 이색찜질방
  if (c3.startsWith('A0202020') || c3.startsWith('A0202030')) {
    return normalize([SLOT.afternoon, SLOT.evening])
  }
  if (c3 === 'A02060600') return normalize([SLOT.evening]) // 공연장

  // --- 시장은 오전 (쇼핑 A04 일반 규칙보다 먼저) ---
  if (c3 === 'A04010100' || c3 === 'A04010200') return normalize([SLOT.morning]) // 5일장/상설시장

  // --- 오후: 문화시설 전반(박물관·미술관·전시·도서관·영화관), 카페/찻집, 테마공원, 체험, 쇼핑 ---
  if (contentTypeId === '14' || c2 === 'A0206') return normalize([SLOT.afternoon, SLOT.morning])
  if (c3 === 'A05020900') return normalize([SLOT.afternoon, SLOT.morning]) // 카페/전통찻집
  if (c3 === 'A02020600') return normalize([SLOT.afternoon, SLOT.morning]) // 테마공원
  if (c2 === 'A0203') return normalize([SLOT.afternoon, SLOT.morning]) // 체험관광지
  if (c1 === 'A04') return normalize([SLOT.afternoon, SLOT.morning]) // 쇼핑

  // --- 점심/저녁: 음식점(카페 제외) ---
  if (c1 === 'A05') return normalize([SLOT.lunch, SLOT.evening])

  // --- 오전: 자연, 역사유적, 휴양(공원 등) ---
  if (c1 === 'A01') return normalize([SLOT.morning, SLOT.afternoon]) // 자연관광지
  if (c2 === 'A0201') return normalize([SLOT.morning, SLOT.afternoon]) // 역사관광지
  if (c2 === 'A0202') return normalize([SLOT.morning, SLOT.afternoon]) // 휴양관광지

  // --- 분류코드가 비었거나 애매하면 제목 키워드로 마지막 판단 ---
  if (/(야경|전망대|전망 좋은|타워|스카이|대교|분수|불꽃|해넘이|일몰)/.test(name)) return normalize([SLOT.evening])
  if (/(카페|커피|디저트|베이커리|찻집)/.test(name)) return normalize([SLOT.afternoon, SLOT.morning])
  if (/(박물관|미술관|전시관|갤러리|아트|과학관|기념관)/.test(name)) return normalize([SLOT.afternoon, SLOT.morning])
  if (/(시장|상가|쇼핑|아울렛|백화점)/.test(name)) return normalize([SLOT.morning])
  if (/(온천|스파|찜질)/.test(name)) return normalize([SLOT.afternoon, SLOT.evening])
  if (/(맛집|식당|국밥|한우|횟집|해장|먹거리)/.test(name)) return normalize([SLOT.lunch, SLOT.evening])

  // 그 외(자연·유적·거리 등 낮에 두루 어울리는 곳)
  return normalize([SLOT.morning, SLOT.afternoon])
}

// 카카오 로컬 음식점(FD6)/카페(CE7) 항목 -> 슬롯 배열.
// category_name 예: "음식점 > 술집 > 호프,요리주점", "음식점 > 일식 > 초밥,롤", "카페 > 커피전문점"
export function slotsForKakaoPlace({ categoryName = '', groupCode = '' } = {}) {
  const name = String(categoryName || '')

  if (groupCode === 'CE7' || /카페|커피|디저트|베이커리|찻집|브런치/.test(name)) {
    return normalize([SLOT.afternoon])
  }

  // 술집류는 저녁 전용. (category_name 에 "술집" 세그먼트가 들어오는 경우가 대부분)
  if (/술집|주점|호프|포차|포장마차|이자카야|와인|칵테일|펍|바\(BAR\)|맥주|막걸리/.test(name)) {
    return normalize([SLOT.evening])
  }

  // 일반 음식점은 점심·저녁 모두 가능.
  return normalize([SLOT.lunch, SLOT.evening])
}

export { SLOT, SLOT_ORDER }
