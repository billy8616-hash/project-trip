// ─────────────────────────────────────────────────────────────
// server/cityRegion.js — 이 장소가 정말 그 도시에 있는지 확인
//
// 외부 API 는 "속초"로 검색해도 인근 다른 도시의 장소를 섞어 주기도 한다.
// 주소에 도시명이 들어 있는지만 보면 "대포항"처럼 도시명이 다른 지명의
// 일부로 들어간 경우를 걸러내지 못한다.
//
// 그래서 행정구역 단위까지 맞춰서 비교한다 — "속초"가 아니라 "속초시"를 찾는다.
// ─────────────────────────────────────────────────────────────

import { allDestinations } from '../src/data/destinations.js'

// 도시명이 주소에 "포함"되기만 하면 통과시키던 필터는 "대포항"(강원 속초) 처럼
// 도시명이 다른 지명의 일부로 들어간 경우까지 걸러내지 못한다.
// destinationCatalog 의 도시는 모두 특별시/광역시/특별자치시·도이거나 "OO시"·"OO군" 단위라,
// 행정구역 단위까지 맞춰서 비교하면 이런 오탐을 막을 수 있다.
// 광역시를 "대구시"로 찾으면 "대구광역시"에 걸리지 않고, "광주시"는 오히려 경기 광주시에 걸린다.
// 그래서 시·도 단위 도시는 정식 명칭을 따로 둔다.
const SPECIAL_REGION_NAMES = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  제주: '제주특별자치도',
}

export function matchesCityRegion(address, cityName) {
  if (!address) return false
  const fullName = SPECIAL_REGION_NAMES[cityName]
  // 카카오 로컬은 시·도를 "서울 강남구 …"처럼 줄여 쓰고 TourAPI 는 "서울특별시 …"로 쓴다. 둘 다 받는다.
  // 줄인 이름은 주소 맨 앞(시·도 자리)에서만 본다 — "경기 광주시"가 광주광역시로 잡히지 않게.
  if (fullName) return address.includes(fullName) || address.startsWith(`${cityName} `)
  // "OO시" 만이 아니라 "OO군"(가평·양양·태안·단양·담양·부여·보성·정선·평창·남해 등)도 받아준다.
  return [`${cityName}시`, `${cityName}군`].some((term) => address.includes(term))
}

// 서비스하는 도시 목록(화면의 여행지 카드와 같은 목록).
// 외부 API 를 부르는 요청은 이 밖의 이름을 받지 않는다. 아무 이름이나 받으면 "기장"(부산 기장군)처럼
// 다른 도시에 속한 지역으로 풀을 새로 만들면서 그 장소들의 cityKey 를 덮어써 부산 풀에서 빼앗고,
// 이름을 바꿔 가며 보내는 것만으로 Gemini·TourAPI 한도를 소진시킬 수 있다.
const CATALOG_CITIES = new Set(allDestinations.map((city) => city.name))

export function isCatalogCity(name) {
  return CATALOG_CITIES.has(name)
}
