// '목적지' 화면 = 카드 10곳(대표 여행지) + 글 목록 30곳(지역별). 총 40곳.
//
// 도시별 장소 풀은 여기 하드코딩하지 않는다 — GET /api/course-pool?city=... 가
// TourAPI(관광지/문화시설/야경) + 카카오 로컬(맛집/카페) + Gemini(추천이유/주의사항/테마)로
// 그때그때 모아서 { title, subtitle, center, pool } 모양으로 내려준다. (server/app.js 참고)
// tone 은 사진이 없을 때 쓰는 썸네일 배경(.photo-1~4) 매칭용.
// photo 는 그 여행지를 대표하는 실제 명소 사진(위키미디어 커먼즈)으로, 카드에서 항상 우선 사용된다.
const WIKI = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=900`

export const destinationCatalog = [
  { name: '서울', tag: '고궁과 골목 산책', tone: 1, lat: 37.5665, lng: 126.978, photo: WIKI('Seoul_Gyeongbokgung_palace_exterior_view.jpg') },
  { name: '부산', tag: '해변과 시장, 야경', tone: 4, lat: 35.1796, lng: 129.0756, photo: WIKI('Haeundae_Beach_in_Busan.jpg') },
  { name: '제주', tag: '바다와 오름, 숲길', tone: 2, lat: 33.4996, lng: 126.5312, photo: WIKI('Seongsan_Ilchulbong_02.jpg') },
  { name: '경주', tag: '천년의 고도, 밤 산책', tone: 3, lat: 35.8562, lng: 129.2247, photo: WIKI('Donggung_Palace_and_Wolji_Pond_in_Gyeongju.jpg') },
  { name: '강릉', tag: '커피 거리와 겨울 바다', tone: 2, lat: 37.7519, lng: 128.8761, photo: WIKI('Korea-Gangneung-Gyeongpodae-01.jpg') },
  { name: '전주', tag: '한옥마을과 미식 골목', tone: 3, lat: 35.8242, lng: 127.148, photo: WIKI('Jeonju_Hanok_Maeul_02.jpg') },
  { name: '여수', tag: '낭만 포차와 밤바다', tone: 4, lat: 34.7604, lng: 127.6622, photo: WIKI('Korea-Yeosu-Dolsan_Bridge_at_night-01.jpg') },
  { name: '속초', tag: '설악산과 항구 먹거리', tone: 1, lat: 38.207, lng: 128.5918, photo: WIKI('Korea-Sokcho_from_Seoraksan-01.jpg') },
  { name: '통영', tag: '한려수도 섬과 케이블카', tone: 2, lat: 34.8544, lng: 128.4331, photo: WIKI('Korea-Tongyeong-Hallyeo_Waterway_Observation_Cable_Car-03.jpg') },
  { name: '안동', tag: '하회마을과 전통 한옥', tone: 3, lat: 36.5684, lng: 128.7294, photo: WIKI('Korea-Andong-Hahoe_Folk_Village-Overview-01.jpg') },
]

// 카드 아래 글 목록으로 보여줄 나머지 여행지 (지역별 그룹).
export const destinationGroups = [
  {
    region: '수도권',
    cities: [
      { name: '인천', lat: 37.4563, lng: 126.7052 },
      { name: '수원', lat: 37.2636, lng: 127.0286 },
      { name: '가평', lat: 37.8315, lng: 127.5106 },
    ],
  },
  {
    region: '강원',
    cities: [
      { name: '춘천', lat: 37.8813, lng: 127.73 },
      { name: '평창', lat: 37.3705, lng: 128.3901 },
      { name: '양양', lat: 38.0754, lng: 128.619 },
      { name: '정선', lat: 37.3805, lng: 128.6608 },
      { name: '삼척', lat: 37.4499, lng: 129.1653 },
    ],
  },
  {
    region: '충청',
    cities: [
      { name: '대전', lat: 36.3504, lng: 127.3845 },
      { name: '세종', lat: 36.4801, lng: 127.289 },
      { name: '청주', lat: 36.6424, lng: 127.489 },
      { name: '공주', lat: 36.4465, lng: 127.119 },
      { name: '부여', lat: 36.2757, lng: 126.9098 },
      { name: '보령', lat: 36.3336, lng: 126.6127 },
      { name: '태안', lat: 36.7456, lng: 126.298 },
      { name: '단양', lat: 36.9846, lng: 128.3655 },
    ],
  },
  {
    region: '전라',
    cities: [
      { name: '광주', lat: 35.1595, lng: 126.8526 },
      { name: '군산', lat: 35.9676, lng: 126.7369 },
      { name: '순천', lat: 34.9506, lng: 127.4872 },
      { name: '목포', lat: 34.8118, lng: 126.3922 },
      { name: '담양', lat: 35.3213, lng: 126.9882 },
      { name: '남원', lat: 35.4164, lng: 127.3905 },
      { name: '보성', lat: 34.7714, lng: 127.08 },
    ],
  },
  {
    region: '경상',
    cities: [
      { name: '대구', lat: 35.8714, lng: 128.6014 },
      { name: '울산', lat: 35.5384, lng: 129.3114 },
      { name: '포항', lat: 36.019, lng: 129.3435 },
      { name: '문경', lat: 36.5866, lng: 128.1866 },
      { name: '거제', lat: 34.8806, lng: 128.6211 },
      { name: '남해', lat: 34.8376, lng: 127.8925 },
      { name: '밀양', lat: 35.5038, lng: 128.7466 },
    ],
  },
]

// 이름으로 도시를 찾을 때 쓰는 전체 목록 (카드 + 글 목록).
export const allDestinations = [
  ...destinationCatalog,
  ...destinationGroups.flatMap((group) => group.cities),
]

export const fallbackCity = '경주'
