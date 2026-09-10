/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/course/CourseDetailScreen.jsx
   [화면의 어디?]  코스를 하나 고른 뒤 보이는 "상세 화면 전체" (홈 화면을 대신해서 나타난다).
   [구성]
     · 위    : '← 돌아가기' 버튼 + '발길따라' 이름
     · 제목 줄: 여행지/테마 딱지 + 코스 제목 + 소요시간/장소수/거리
     · 본문  : 왼쪽 경로 지도 → RouteMap.jsx
              오른쪽 방문 순서 타임라인 (1, 2, 3... 장소 설명)
   [연결]  App.jsx 가 "열어 본 코스가 있을 때" 이 화면을 보여 준다.
           코스 데이터는 data/travel.js 에서 courseId 로 찾아온다.
   ─────────────────────────────────────────────────────────────── */

import { useEffect } from 'react'
import RouteMap from './RouteMap.jsx'
import {
  getCourseById, // 코스 번호 → 코스 정보
  getDestination, // 여행지 정보
  getTheme, // 테마 정보
} from '../../data/travel.js'
import styles from './CourseDetailScreen.module.css'

// props: courseId(보여 줄 코스 번호) / onBack(돌아가기를 눌렀을 때 호출)
export default function CourseDetailScreen({ courseId, onBack }) {
  const course = getCourseById(courseId) // 번호로 코스 정보를 찾는다 (없으면 null)

  // 화면이 뜰 때: ESC 키로도 돌아갈 수 있게 하고, 스크롤을 맨 위로 올린다.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    window.scrollTo(0, 0)
    return () => window.removeEventListener('keydown', onKey) // 화면이 사라질 때 감시 해제
  }, [onBack])

  // 혹시 코스를 못 찾았으면(잘못된 번호 등) 안내 문구와 돌아가기 버튼만 보여 주고 끝낸다.
  if (!course) {
    return (
      <main className={styles.screen}>
        <div className={styles.overlay} aria-hidden="true" />
        <div className={styles.inner}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← 돌아가기
          </button>
          <p className={styles.missing}>코스를 찾을 수 없습니다.</p>
        </div>
      </main>
    )
  }

  // 여기서부터는 코스를 정상적으로 찾은 경우.
  const dest = getDestination(course.destinationId) // 이 코스의 여행지
  const theme = getTheme(course.themeId) // 이 코스의 테마

  return (
    <main className={styles.screen}>
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.inner}>
        {/* 위쪽 바: 돌아가기 버튼 + 서비스 이름 */}
        <header className={styles.topbar}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← 돌아가기
          </button>
          <span className={styles.brand}>발길따라</span>
        </header>

        {/* 제목 영역 */}
        <div className={styles.headings}>
          <div className={styles.chips}>
            {/* 여행지/테마 정보가 있을 때만 딱지(chip)를 보여 준다 */}
            {dest && <span className={styles.chip}>{dest.name}</span>}
            {theme && <span className={styles.chip}>{theme.name}</span>}
          </div>
          <h1 className={styles.title}>{course.title}</h1>
          <div className={styles.meta}>
            <span>⏱ {course.duration}</span>
            <span>📍 {course.spots.length}곳</span>
            <span>🚶 총 {course.distanceKm}km</span>
          </div>
        </div>

        {/* 본문: 왼쪽 지도 + 오른쪽 순서 목록 */}
        <div className={styles.body}>
          <div className={styles.mapCol}>
            {/* 장소 목록(spots)을 넘겨주면 RouteMap 이 점과 선으로 경로 그림을 그린다 */}
            <RouteMap spots={course.spots} />
          </div>

          {/* 방문 순서 타임라인: 장소를 1번부터 번호를 붙여 세로로 나열 */}
          <ol className={styles.timeline}>
            {course.spots.map((spot, i) => (
              <li key={spot.name} className={styles.step}>
                <span className={styles.num}>{i + 1}</span> {/* 순서 번호 */}
                <div>
                  <p className={styles.spotName}>{spot.name}</p>
                  <p className={styles.spotDesc}>{spot.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  )
}
