// ─────────────────────────────────────────────────────────────
// screens/course-detail/mockData.js — props 를 안 넘겼을 때만 쓰는 예시 데이터
//
// props 없이 CourseDetail 만 띄워도 레이아웃을 확인할 수 있게 둔 예시 데이터.
// 실제 앱에서는 항상 props 가 들어오므로 쓰이지 않는다.
// ─────────────────────────────────────────────────────────────

export const MOCK_DAY = { no: 1, date: '9월 12일 (토)', region: '강릉' }

export const MOCK_PLACES = [
  { id: 'p1', order: 1, name: '오죽헌', kind: 'history', bestTime: '오전', timeRange: '09:00 – 11:30',
    desc: '신사임당과 율곡 이이의 생가.', tip: '아침 공기가 상쾌하고 덜 붐비는 시간대예요.', coord: { x: 150, y: 92 } },
  { id: 'p2', order: 2, name: '초당 순두부 마을', kind: 'restaurant', bestTime: '점심', timeRange: '12:00 – 13:30',
    desc: '고소한 초당 순두부 정식.', tip: '웨이팅이 길면 포장도 좋아요.', coord: { x: 214, y: 208 } },
  { id: 'p3', order: 3, name: '허균·허난설헌 기념공원', kind: 'nature', bestTime: '오후', timeRange: '13:45 – 15:00',
    desc: '울창한 소나무 숲길 산책.', tip: '입장은 무료예요.', coord: { x: 246, y: 298 } },
  { id: 'p4', order: 4, name: '경포 해변', kind: 'nature', bestTime: '저녁', timeRange: '15:45 – 17:30',
    desc: '동해 바다 풍경과 모래사장.', tip: '노을 절정은 18:40 무렵.', coord: { x: 300, y: 370 } },
]

export const MOCK_ROUTES = [
  { from: 'p1', to: 'p2', mode: 'bus', line: '버스 202번', duration: '30분', fare: '₩1,250' },
  { from: 'p2', to: 'p3', mode: 'walk', duration: '15분' },
  { from: 'p3', to: 'p4', mode: 'bus', line: '버스 230번', duration: '45분', fare: '₩1,250' },
]
