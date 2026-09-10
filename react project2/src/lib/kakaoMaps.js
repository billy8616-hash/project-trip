export const kakaoMapApiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY

// 카카오맵 배경(도로 빨간선 등)과 겹쳐도 잘 보이도록 흰 테두리 + 선명한 색을 쓴다.
// 자차는 실제 도로 경로를 실선으로, 도보/대중교통은 직선 예상 경로를 점선으로 그린다.
// 어느 쪽이든 구간(1→2, 2→3, 3→4 …)마다 색을 돌려 써서 몇 번째 이동인지 한눈에 들어오게 한다.
// 흰 배경 위 글자로도 읽히도록 충분히 진한 색만 골랐다.
export const ROUTE_LEG_COLORS = ['#1f5fd6', '#d64518', '#0f8a5f', '#7c3aed', '#b8860b', '#c0246a', '#0e7490', '#4d3fb0']
export const legColor = (index) => ROUTE_LEG_COLORS[index % ROUTE_LEG_COLORS.length]

let kakaoMapsPromise

export function loadKakaoMaps() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  if (kakaoMapsPromise) return kakaoMapsPromise

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // autoload=false 로 받아 kakao.maps.load 콜백에서 resolve 해야
    // Map/LatLng 등 실제 지도 클래스가 준비된 뒤에 사용할 수 있다.
    // SDK 가 내부적으로 document.write 로 하위 스크립트를 불러오므로
    // script.async 를 켜두면(동적 스크립트는 기본값이 async) 그 write 가 막혀 조용히 실패한다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapApiKey}&autoload=false&libraries=services`
    script.async = false
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => reject(new Error('Kakao Maps script failed to load'))
    document.head.appendChild(script)
  })

  return kakaoMapsPromise
}
