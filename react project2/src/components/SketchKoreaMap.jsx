export default function SketchKoreaMap({ activeCity, onPick }) {
  return (
    <div className="korea-map" aria-label="스케치 한국 지도">
            <svg className="korea-map-svg" viewBox="0 0 660 300" aria-hidden="true">
              <defs>
                <radialGradient id="pmVign" cx="48%" cy="42%" r="72%">
                  <stop offset="0%" stopColor="#eef4f0" />
                  <stop offset="55%" stopColor="#e6efe6" />
                  <stop offset="100%" stopColor="#d6e6dc" />
                </radialGradient>
                <filter id="pmGrain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="t" />
                  <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.29  0 0 0 0 0.17  0 0 0 0.6 0" />
                </filter>

                <g id="pmMtn">
                  <path d="M-24 20 L-9 -10 L2 8 L12 -6 L26 20 Z" fill="#e7dab6" stroke="#8a7550" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M-9 -10 L-14 4 M-9 -10 L-3 6 M12 -6 L7 6 M12 -6 L18 6" fill="none" stroke="#8a7550" strokeWidth="1" />
                  <path d="M-20 20 q4 -6 9 -2 M-2 20 q5 -7 10 -2 M13 20 q4 -6 9 -2" fill="none" stroke="#8a7550" strokeWidth="0.8" opacity="0.55" />
                </g>

                <g id="pmPine">
                  <line x1="0" y1="30" x2="0" y2="22" stroke="#6f5b3a" strokeWidth="1.6" />
                  <path d="M0 0 L-7 13 L7 13 Z M0 8 L-9 22 L9 22 Z M0 15 L-11 29 L11 29 Z" fill="#c9d4a6" stroke="#728350" strokeWidth="1.1" strokeLinejoin="round" />
                </g>

                <g id="pmHill">
                  <path d="M0 13 q7 -15 17 -7 q6 -8 15 -2 q10 -1 13 9 Z" fill="#dde2ba" stroke="#7f8d58" strokeWidth="1.1" strokeLinejoin="round" />
                  <path d="M7 8 v3 M16 5 v4 M27 7 v3 M36 10 v3" stroke="#7f8d58" strokeWidth="0.8" />
                </g>

                <g id="pmPagoda">
                  <rect x="-7" y="6" width="14" height="16" fill="#e7dab6" stroke="#8a7550" strokeWidth="1.2" />
                  <path d="M-12 6 q12 -11 24 0 Z" fill="#d8c495" stroke="#8a7550" strokeWidth="1.2" strokeLinejoin="round" />
                  <line x1="0" y1="-6" x2="0" y2="6" stroke="#8a7550" strokeWidth="1.2" />
                  <rect x="-3" y="12" width="6" height="10" fill="#8a7550" />
                </g>

                <g id="pmTower">
                  <rect x="-11" y="-2" width="22" height="40" fill="#e9dcb8" stroke="#8a7550" strokeWidth="1.5" />
                  <path d="M-11 -2 h5 v-5 h4 v5 h4 v-5 h4 v5 h5" fill="#e9dcb8" stroke="#8a7550" strokeWidth="1.5" strokeLinejoin="round" />
                  <rect x="-5" y="10" width="10" height="12" fill="#8a7550" />
                  <path d="M-13 38 h26" stroke="#8a7550" strokeWidth="1.4" />
                </g>
              </defs>

              <rect x="0" y="0" width="660" height="300" fill="url(#pmVign)" />
              <rect x="0" y="0" width="660" height="300" filter="url(#pmGrain)" opacity="0.07" />

              <g stroke="#7fb0c4" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.75">
                <path d="M14 64 q8 -7 16 0 t16 0 t16 0" />
                <path d="M14 90 q8 -7 16 0 t16 0 t16 0" />
                <path d="M18 118 q8 -7 16 0 t16 0" />
                <path d="M10 166 q7 -6 14 0 t14 0" />
                <path d="M596 70 q8 -7 16 0 t16 0 t16 0" />
                <path d="M600 96 q8 -7 16 0 t16 0" />
              </g>

              <g transform="matrix(1.5 0 0 0.86 40 -6)">
                <path d="M175 62 C210 48 250 52 268 74 C285 92 300 96 312 120 C322 150 322 172 316 192 C310 210 300 222 292 232 C280 244 268 240 256 250 C244 260 240 270 226 272 C210 274 202 262 190 262 C182 274 176 288 166 286 C158 284 160 270 158 260 C150 252 138 250 132 238 C124 222 134 210 128 196 C120 180 108 178 110 160 C112 142 128 140 130 124 C132 106 120 96 128 82 C136 68 158 70 175 62 Z" fill="#c3d9ac" stroke="#6f8f57" strokeWidth="2" strokeLinejoin="round" opacity="0.95" />
              </g>

              <g>
                <path d="M40 190 C50 176 92 174 104 188 C114 200 106 214 84 216 C56 218 30 206 40 190 Z" fill="#c8dcb4" stroke="#6f8f57" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M52 196 q10 -6 20 -1 M50 204 q14 -4 26 0 M60 210 q10 -3 18 0" fill="none" stroke="#9a8455" strokeWidth="0.9" opacity="0.6" />
                <use href="#pmMtn" transform="translate(74,192) scale(0.42)" />
              </g>

              <use href="#pmHill" transform="translate(176,176) scale(0.9)" />
              <use href="#pmHill" transform="translate(240,222)" />
              <use href="#pmHill" transform="translate(300,236) scale(1.1)" />
              <use href="#pmHill" transform="translate(414,224)" />
              <use href="#pmHill" transform="translate(486,196) scale(0.9)" />

              <use href="#pmMtn" transform="translate(250,104) scale(0.85)" />
              <use href="#pmMtn" transform="translate(300,118) scale(1.1)" />
              <use href="#pmMtn" transform="translate(338,128) scale(0.8)" />
              <use href="#pmMtn" transform="translate(356,66) scale(1.15)" />
              <use href="#pmMtn" transform="translate(392,60) scale(1.35)" />
              <use href="#pmMtn" transform="translate(430,72)" />
              <use href="#pmMtn" transform="translate(470,168) scale(0.8)" />
              <use href="#pmMtn" transform="translate(516,150) scale(1.2)" />

              <use href="#pmPine" transform="translate(196,116) scale(0.8)" />
              <use href="#pmPine" transform="translate(214,150) scale(0.9)" />
              <use href="#pmPine" transform="translate(238,178)" />
              <use href="#pmPine" transform="translate(268,140) scale(0.7)" />
              <use href="#pmPine" transform="translate(276,202) scale(1.05)" />
              <use href="#pmPine" transform="translate(300,92) scale(0.8)" />
              <use href="#pmPine" transform="translate(332,182) scale(0.9)" />
              <use href="#pmPine" transform="translate(356,210) scale(0.85)" />
              <use href="#pmPine" transform="translate(372,150)" />
              <use href="#pmPine" transform="translate(404,182)" />
              <use href="#pmPine" transform="translate(430,110) scale(0.75)" />
              <use href="#pmPine" transform="translate(444,150) scale(0.9)" />
              <use href="#pmPine" transform="translate(474,96) scale(0.95)" />
              <use href="#pmPine" transform="translate(500,120) scale(0.9)" />

              <use href="#pmPagoda" transform="translate(150,96) scale(1.05)" />
              <use href="#pmPagoda" transform="translate(588,188) scale(1.2)" />
              <use href="#pmTower" transform="translate(602,120)" />

              <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 5">
                <path d="M248 76 C222 94 210 114 215 136 C220 162 214 182 238 200 C282 218 342 216 394 208 C422 204 450 198 467 190" stroke="#d5883f" />
                <path d="M250 72 C300 76 322 90 352 98 C402 112 446 120 486 130 C481 152 475 172 469 186" stroke="#7f9350" />
                <path d="M48 196 q12 -9 26 -3 q8 4 14 -2" stroke="#d5883f" />
                <path d="M96 182 C134 180 172 172 204 160 C220 154 232 148 242 140" stroke="#6f9bb5" strokeWidth="2.2" />
              </g>

              <g>
                <g transform="translate(348,95)">
                  <rect x="-8" y="-8" width="16" height="16" rx="3.5" fill="#7f9350" stroke="#f3ead0" strokeWidth="1.6" />
                  <path d="M-4 3 L0 -4 L4 3 M-4 3 L0 0 L4 3" fill="none" stroke="#f3ead0" strokeWidth="1.3" strokeLinejoin="round" />
                </g>
                <g transform="translate(330,213)">
                  <rect x="-8" y="-8" width="16" height="16" rx="3.5" fill="#7f9350" stroke="#f3ead0" strokeWidth="1.6" />
                  <path d="M-4 3 L0 -4 L4 3 M-4 3 L0 0 L4 3" fill="none" stroke="#f3ead0" strokeWidth="1.3" strokeLinejoin="round" />
                </g>
              </g>

              <rect x="7" y="7" width="646" height="286" rx="9" fill="none" stroke="#6f9bb5" strokeWidth="2.4" opacity="0.8" />
            </svg>
      {['서울', '제주', '경주', '부산'].map((city, index) => (
        <button
          key={city}
          className={`map-pin pin-${index + 1}${activeCity === city ? ' active' : ''}`}
          type="button"
          onClick={() => onPick && onPick(city)}
        >
          <span className="pin-mark"><i>{index + 1}</i></span>
          <b>{city}</b>
        </button>
      ))}
    </div>
  )
}
