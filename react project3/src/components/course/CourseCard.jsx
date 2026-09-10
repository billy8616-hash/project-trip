/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/course/CourseCard.jsx
   [화면의 어디?]  홈 위저드(HeroWizard) 마지막 단계에 나오는 "코스 한 장 카드".
                  사진 + 코스 제목 + 소요시간/장소수/거리 + 전체 경로 + '자세히 보기'.
   [하는 일]  카드 전체가 버튼이라, 누르면 그 코스의 상세 화면으로 넘어간다.
   [연결]  HeroWizard.jsx 가 이 파일을 <CourseCard ... /> 로 쓴다.
   ─────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import styles from './CourseCard.module.css'

// props: course(코스 정보) / image(썸네일 주소) / onOpen(누르면 코스 id 를 들고 호출)
export default function CourseCard({ course, image, onOpen }) {
  // 사진이 있고 정상적으로 불러와지는가? 로딩에 실패하면(onError) false 로 바꿔 사진 자리를 비운다.
  const [imgOk, setImgOk] = useState(Boolean(image))
  // 장소 이름들을 "A → B → C" 한 줄로 이어 붙인다.
  const route = course.spots.map((s) => s.name).join(' → ')

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onOpen(course.id)} // 카드 클릭 → 이 코스 상세 화면으로
    >
      <div className={styles.thumb}>
        {/* imgOk 일 때만 사진을 보여 준다. loading="lazy" = 화면에 가까워질 때 늦게 불러오기 */}
        {imgOk && (
          <img src={image} alt="" loading="lazy" onError={() => setImgOk(false)} />
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{course.title}</h3>

        {/* 요약 정보 한 줄: 소요시간 · 장소 수 · 총 거리 */}
        <div className={styles.meta}>
          <span>⏱ {course.duration}</span>
          <span>📍 {course.spots.length}곳</span>
          <span>🚶 {course.distanceKm}km</span>
        </div>

        <p className={styles.route}>{route}</p> {/* 위에서 만든 "A → B → C" 경로 */}

        <span className={styles.cta}>코스 자세히 보기 →</span>
      </div>
    </button>
  )
}
