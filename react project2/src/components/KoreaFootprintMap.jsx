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

import { useEffect, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker, useMapContext } from 'react-simple-maps'

const GEO_URL = '/data/skorea-provinces.json'

// 마커에 마우스를 올리면 도시 이름을 보여주는 말풍선. 네이티브 <title> 툴팁은 뜨기까지
// 느리고 스타일을 줄 수 없어서, 보이는 즉시 나타나는 커스텀 SVG 말풍선을 얹는다.
// 글자 폭은 미리 알 수 없으니(한글 도시 이름 길이가 제각각) <text>를 그린 뒤
// getBBox()로 실측해서 배경 알약(rect) 크기를 맞춘다.
// 지도 위쪽 가장자리에 가까운 마커는 말풍선을 아래로 뒤집어서, 감싸는 카드의
// overflow-hidden에 잘려 안 보이는 일을 막는다.
function CityMarker({ city, markerRadius, mapHeight }) {
  const [hovered, setHovered] = useState(false)
  const textRef = useRef(null)
  const [textWidth, setTextWidth] = useState(0)
  const { projection } = useMapContext()

  useEffect(() => {
    if (hovered && textRef.current) {
      setTextWidth(textRef.current.getBBox().width)
    }
  }, [hovered])

  const point = projection(city.coordinates)
  const showBelow = point ? point[1] < mapHeight * 0.2 : false

  const fontSize = Math.max(10, Math.round(markerRadius * 0.85))
  const padX = fontSize * 0.75
  const padY = fontSize * 0.5
  const boxWidth = textWidth + padX * 2
  const boxHeight = fontSize + padY * 2
  const gap = 6
  const boxY = showBelow ? markerRadius + gap : -(markerRadius + gap + boxHeight)

  return (
    <Marker
      coordinates={city.coordinates}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <title>{city.name}</title>
      <circle r={markerRadius} fill="#F97316" fillOpacity={0.35} className="tw-animate-pulse" />
      <circle r={markerRadius * 0.4} fill="#F97316" stroke="#ffffff" strokeWidth={1.2} />

      {hovered && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={-boxWidth / 2}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            rx={boxHeight / 2}
            fill="#292524"
            fillOpacity={0.92}
            style={{ opacity: textWidth ? 1 : 0, transition: 'opacity 0.12s ease-out' }}
          />
          <text
            ref={textRef}
            x={0}
            y={boxY + boxHeight / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight={600}
            fill="#ffffff"
            style={{ opacity: textWidth ? 1 : 0, transition: 'opacity 0.12s ease-out' }}
          >
            {city.name}
          </text>
        </g>
      )}
    </Marker>
  )
}

// width/height 는 ComposableMap 내부 SVG 좌표계(기본값 800×600, 가로로 넓은 4:3)다.
// 담는 상자가 그보다 세로로 긴 4:5 · 1:1 비율이면 위아래에 레터박스(빈 여백)가 생겨
// 지도가 실제보다 작게 보인다 — 상자 비율에 맞는 width/height 를 넘겨서 그 여백을 없앤다.
export function KoreaFootprintMap({ cities, scale = 4300, width = 800, height = 600, markerRadius = 9 }) {
  return (
    <ComposableMap
      width={width}
      height={height}
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
        <CityMarker key={city.name} city={city} markerRadius={markerRadius} mapHeight={height} />
      ))}
    </ComposableMap>
  )
}
