/* 손그림(연필/펜) 흔들림 효과를 내는 SVG 필터 모음.
   화면에는 보이지 않고, 다른 SVG 가 filter="url(#rough)" 로 가져다 쓴다.
   App 최상단에 한 번만 렌더한다. */
export default function SketchFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <defs>
        {/* 선을 살짝 울퉁불퉁하게 — 손으로 그린 느낌 */}
        <filter id="rough">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* 더 크게 흔들리는 버전 — 큰 일러스트용 */}
        <filter id="rough-lg">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="3"
            seed="13"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
