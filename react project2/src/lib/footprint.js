// ─────────────────────────────────────────────────────────────
// lib/footprint.js — 저장된 여행에서 "나의 발자국 지도"용 방문 도시를 뽑아낸다
//
// 저장된 여행(trip.city)은 destinations.js 의 40개 여행지 중 하나다. 좌표는
// 거기서 그대로 가져오고, 시·도는 아래 CITY_TO_REGION 으로 매겨서 "전국 17개
// 시·도 중 몇 곳" 을 계산한다. 같은 도시로 여러 번 여행했어도 지도에는 한 번만 찍는다.
// ─────────────────────────────────────────────────────────────

import { allDestinations } from '../data/destinations.js'

export const TOTAL_REGIONS = 17

// 40개 여행지가 각각 속한 광역 시·도. destinations.js 에 여행지가 추가되면 여기도 같이 늘려야 한다.
const CITY_TO_REGION = {
  서울: '서울특별시',
  부산: '부산광역시',
  제주: '제주특별자치도',
  경주: '경상북도',
  강릉: '강원특별자치도',
  전주: '전북특별자치도',
  여수: '전라남도',
  속초: '강원특별자치도',
  통영: '경상남도',
  안동: '경상북도',
  인천: '인천광역시',
  수원: '경기도',
  가평: '경기도',
  춘천: '강원특별자치도',
  평창: '강원특별자치도',
  양양: '강원특별자치도',
  정선: '강원특별자치도',
  삼척: '강원특별자치도',
  대전: '대전광역시',
  세종: '세종특별자치시',
  청주: '충청북도',
  공주: '충청남도',
  부여: '충청남도',
  보령: '충청남도',
  태안: '충청남도',
  단양: '충청북도',
  광주: '광주광역시',
  군산: '전북특별자치도',
  순천: '전라남도',
  목포: '전라남도',
  담양: '전라남도',
  남원: '전북특별자치도',
  보성: '전라남도',
  대구: '대구광역시',
  울산: '울산광역시',
  포항: '경상북도',
  문경: '경상북도',
  거제: '경상남도',
  남해: '경상남도',
  밀양: '경상남도',
}

// 저장된 여행 목록(listTrips 결과) → 지도에 찍을 방문 도시 배열.
// 같은 도시로 여러 번 다녀왔어도(저장된 trip이 여러 건이어도) 지도에는 한 번만 찍는다.
export function deriveVisitedCities(trips) {
  const cityNames = Array.from(new Set((trips || []).map((trip) => trip.city).filter(Boolean)))
  return cityNames
    .map((name) => {
      const dest = allDestinations.find((item) => item.name === name)
      if (!dest) return null
      return { name, region: CITY_TO_REGION[name] || null, coordinates: [dest.lng, dest.lat] }
    })
    .filter(Boolean)
}
