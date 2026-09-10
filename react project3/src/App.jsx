/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/App.jsx
   [무엇인가]  메인 화면의 "총괄 지휘자". 지금 어떤 화면을 보여줄지 결정한다.
   [하는 일]
     - 이 사이트에는 큰 화면이 두 개 있다.
         (1) 홈 화면        → HeroSection.jsx
         (2) 코스 상세 화면  → CourseDetailScreen.jsx (선택한 여행 코스의 지도/일정)
     - "지금 열어 본 코스가 있는가?" 하나만 기억해서, 있으면 (2), 없으면 (1) 을 보여준다.
   [참고]  보통 웹사이트는 주소(URL)로 화면을 바꾸지만, 이 프로젝트는 간단하게
           React 의 '상태값' 하나로만 화면을 전환한다.
   ─────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import HeroSection from './components/layout/HeroSection.jsx'
import CourseDetailScreen from './components/course/CourseDetailScreen.jsx'

// 'export default function App()' → App 이라는 이름의 컴포넌트(화면 조각). 다른 파일에서 <App/> 로 쓴다.
export default function App() {
  // useState = "바뀔 수 있는 값"을 기억하는 상자.
  //   activeCourseId      : 지금 열어 본 코스의 번호 (아무것도 안 열었으면 null)
  //   setActiveCourseId   : 그 값을 바꾸는 함수. 이걸 호출하면 화면이 자동으로 다시 그려진다.
  const [activeCourseId, setActiveCourseId] = useState(null)

  // 열어 본 코스가 있으면 → 상세 화면을 보여준다.
  if (activeCourseId) {
    return (
      <CourseDetailScreen
        courseId={activeCourseId} // 어떤 코스를 보여줄지 번호를 넘겨준다
        onBack={() => setActiveCourseId(null)} // '돌아가기'를 누르면 다시 null → 홈으로
      />
    )
  }

  // 열어 본 코스가 없으면 → 홈 화면을 보여준다.
  // onOpenCourse: 홈 화면에서 코스를 고르면 그 번호를 setActiveCourseId 에 전달한다.
  return <HeroSection onOpenCourse={setActiveCourseId} />
}
