// 도시명이 주소에 "포함"되기만 하면 통과시키던 필터는 "대포항"(강원 속초) 처럼
// 도시명이 다른 지명의 일부로 들어간 경우까지 걸러내지 못한다.
// destinationCatalog 의 도시는 모두 특별시/광역시/특별자치도이거나 "OO시" 단위라,
// 행정구역 단위까지 맞춰서 비교하면 이런 오탐을 막을 수 있다.
const SPECIAL_REGION_NAMES = {
  서울: '서울특별시',
  부산: '부산광역시',
  제주: '제주특별자치도',
}

// "OO시" 만이 아니라 "OO군"(가평·양양·태안·단양·담양·부여·보성·정선·평창·남해 등)도 받아준다.
function regionTerms(cityName) {
  if (SPECIAL_REGION_NAMES[cityName]) return [SPECIAL_REGION_NAMES[cityName]]
  return [`${cityName}시`, `${cityName}군`]
}

export function matchesCityRegion(address, cityName) {
  if (!address) return false
  return regionTerms(cityName).some((term) => address.includes(term))
}
