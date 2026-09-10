// 장소를 큰 종류로 분류한다. 체류시간 추정과 시간대 판단에 쓴다.
// 근거: category (TourAPI 분류코드 "A05020900" 또는 카카오 category_name "카페 > 커피전문점")
//       + assignedSlot(코스에서 배정된 시간대) + source.
// 확신이 강한 신호부터 본다.
export function placeKindOf(place) {
  const cat = String(place?.category || '')
  const slot = place?.assignedSlot || ''
  const name = String(place?.name || '')

  const has = (re) => re.test(cat) || re.test(name)

  if (has(/카페|커피|디저트|베이커리|찻집|브런치/) || cat.startsWith('A05020900')) return 'cafe'
  if (has(/술집|주점|호프|포차|포장마차|이자카야|와인바|칵테일|펍|맥주|막걸리/)) return 'bar'
  if (has(/박물관|미술관|전시관|갤러리|과학관|기념관|아트/) || cat.startsWith('A0206')) return 'museum'
  if (has(/전망대|타워|스카이|전망 좋은/) || cat.startsWith('A02050200')) return 'viewpoint'
  if (has(/재래시장|전통시장|시장|상점가/) || cat.startsWith('A040101') || cat.startsWith('A040102')) return 'market'
  if (has(/테마파크|놀이공원|워터파크|아쿠아리움|체험관|랜드/) || cat.startsWith('A0202060') || cat.startsWith('A0203')) return 'themepark'
  if (has(/온천|스파|찜질|사우나/) || cat.startsWith('A0202020') || cat.startsWith('A0202030')) return 'spa'
  if (has(/해수욕장|해변|해안|바닷가|공원|수목원|숲|산|계곡|폭포|호수|섬|둘레길|생태/) || cat.startsWith('A01')) return 'nature'
  if (has(/고궁|궁궐|사찰|절|유적|서원|향교|성당|사당|한옥|생가|고택|왕릉|성지/) || cat.startsWith('A0201')) return 'history'

  // 코드/이름 신호가 없으면 배정된 시간대·출처로 추정.
  if (slot === '점심 맛집' || slot === '저녁') return 'restaurant'
  if (slot === '오후 카페') return 'cafe'
  if (place?.source === 'kakao') return 'restaurant' // 카카오 풀은 음식점/카페뿐
  if (cat.startsWith('A05')) return 'restaurant'
  return 'sight'
}

// 비/눈 오는 날 야외 활동이 크게 불리한 종류. (둘레길·해변·오름·전망대 등)
export const RAIN_EXPOSED_KINDS = new Set(['nature', 'viewpoint'])
// 야외 답사가 많지만 실내 요소도 섞여 있어 감점 폭이 작은 종류. (고궁·사찰·유적)
export const RAIN_PARTLY_EXPOSED_KINDS = new Set(['history'])
// 비/눈이 와도 무난하거나 오히려 나은 실내 위주 종류.
export const RAIN_SHELTERED_KINDS = new Set(['museum', 'spa', 'cafe', 'market'])
