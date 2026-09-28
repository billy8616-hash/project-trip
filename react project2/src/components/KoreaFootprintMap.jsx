// ─────────────────────────────────────────────────────────────
// components/KoreaFootprintMap.jsx — 방문 도시를 표시하는 대한민국 지도
//
// react-simple-maps 로 대한민국 시·도 경계를 그리고, 방문 도시 좌표에
// 오렌지색(#F97316) pulse 마커를 찍는다. 위젯(FootprintMapWidget)과
// 전체 지도 화면(FootprintMapScreen)이 이 컴포넌트를 함께 쓴다.
//
// 지도 경계 데이터는 public/data/skorea-provinces.json 에 내려받아 직접 서빙한다
// (southkorea/southkorea-maps 저장소의 2018 시·도 경계 TopoJSON 단순화 버전).
// 공개 저장소 raw 링크를 그대로 가리키면 파일이 옮겨지거나 느려질 때 지도가
// 통째로 안 보이게 되므로(마커만 보이고 배경 지도가 빈 화면이 되는 식), 프로젝트
// 안에 파일로 두고 직접 서빙하는 편이 안전하다.
// ─────────────────────────────────────────────────────────────

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = '/data/skorea-provinces.json'

export function KoreaFootprintMap({ cities, scale = 4300 }) {
  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [127.8, 36], scale }}
      className="tw-h-full tw-w-full"
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              tabIndex={-1}
              fill="#CBD5E1"
              stroke="#64748B"
              strokeWidth={1}
              style={{ outline: 'none' }}
            />
          ))
        }
      </Geographies>

      {/* 방문 도시 마커: 은은하게 번지는 pulse 원(tw-animate-pulse) + 위에 얹은 작은 점 */}
      {cities.map((city) => (
        <Marker key={city.name} coordinates={city.coordinates}>
          <title>{city.name}</title>
          <circle r={9} fill="#F97316" fillOpacity={0.35} className="tw-animate-pulse" />
          <circle r={3.5} fill="#F97316" stroke="#ffffff" strokeWidth={1.2} />
        </Marker>
      ))}
    </ComposableMap>
  )
}
