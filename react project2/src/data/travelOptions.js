// 여행 조건 선택 화면들이 쓰는 정적 옵션 목록.

export const themes = [
  { id: 'healing', label: '힐링', icon: 'leaf' },
  { id: 'food', label: '맛집', icon: 'fork' },
  { id: 'family', label: '가족', icon: 'family' },
  { id: 'couple', label: '연인', icon: 'heart' },
]

export const durations = ['당일', '1박 2일', '2박 3일', '3박 4일']
export const durationToDays = { 당일: 1, '1박 2일': 2, '2박 3일': 3, '3박 4일': 4 }
export const budgets = ['저예산', '보통', '프리미엄']
export const transports = ['도보', '대중교통', '자차']
export const styles = ['느긋한 일정', '빡빡한 일정', '사진 중심', '맛집 중심']

// 타임라인 시간대 블록
export const SLOT_LABELS = ['오전', '점심 맛집', '오후 카페', '저녁']

// 여행지를 고른 뒤 슬라이드로 펼쳐지는 여행 테마 목록.
export const journeyThemes = [
  { id: 'step', label: '발길따라', desc: '발길 닿는 대로, 느긋하게 걷는 하루', icon: 'leaf' },
  { id: 'mood', label: '감성따라', desc: '분위기 좋은 골목과 카페 위주로', icon: 'heart' },
  { id: 'sns', label: 'SNS따라', desc: '사진 잘 나오는 인기 스팟 중심으로', icon: 'pin' },
  { id: 'view', label: '풍경따라', desc: '바다·산·노을, 풍경이 좋은 곳으로', icon: 'family' },
  { id: 'food', label: '맛집따라', desc: '현지 맛집과 먹거리 위주로', icon: 'fork' },
]
