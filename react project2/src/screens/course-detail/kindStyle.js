// ─────────────────────────────────────────────────────────────
// screens/course-detail/kindStyle.js — 장소 종류(placeKindOf 결과) → 태그 라벨/색
// ─────────────────────────────────────────────────────────────

export const KIND_STYLE = {
  cafe: { label: '카페', bg: '#F2ECE4', fg: '#87664A' },
  bar: { label: '술집', bg: '#F5E9DC', fg: '#8A5A2B' },
  museum: { label: '문화·전시', bg: '#EDEFFB', fg: '#4658CF' },
  viewpoint: { label: '전망', bg: '#E7F1FB', fg: '#2C7FBE' },
  market: { label: '시장', bg: '#FBF0E3', fg: '#C0752E' },
  themepark: { label: '테마파크', bg: '#FBEAF0', fg: '#BC5080' },
  spa: { label: '스파', bg: '#E9F3F4', fg: '#3E8B92' },
  nature: { label: '자연', bg: '#E8F4EC', fg: '#2E9A6B' },
  history: { label: '역사', bg: '#EDEFFB', fg: '#4658CF' },
  restaurant: { label: '맛집', bg: '#FBF0E3', fg: '#C0752E' },
  sight: { label: '명소', bg: '#EDEDEA', fg: '#6A6A62' },
}

export const kindStyle = (kind) => KIND_STYLE[kind] || KIND_STYLE.sight
