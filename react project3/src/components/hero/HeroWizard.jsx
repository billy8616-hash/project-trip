/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/hero/HeroWizard.jsx
   [화면의 어디?]  홈 화면 가운데. '여행지' · '테마 코스' · '코스 둘러보기' 를 누르면
                  기존 큰 문구가 있던 자리에서 이 3단계 선택 위저드가 열린다.
   [흐름]
     1단계 여행지  → 2단계 테마  → 3단계 여행 인원  → 결과(코스 카드 + 방문 순서)
     · 항목을 고르면 트랙이 왼쪽으로 스윽 밀리고 다음 단계가 오른쪽에서 들어온다.
     · 위쪽의 '← 이전' / 진행 점 / 선택 칩으로 앞뒤 단계를 오갈 수 있다.
   [메모]  '여행 인원'은 지금은 결과 문구에만 반영된다. (코스 데이터엔 인원 필드가 없음)
   [연결]  HeroSection.jsx 가 wizardOpen 일 때 이 컴포넌트를 그린다.
   ─────────────────────────────────────────────────────────────── */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CourseCard from '../course/CourseCard.jsx'
import {
  DESTINATIONS,
  THEMES,
  getCourseForDestinationTheme,
  getDestination,
  getTheme,
} from '../../data/travel.js'
import styles from './HeroWizard.module.css'

// 3단계에서 고르는 '여행 인원' 보기. id 는 코드용, name 은 화면 표시, sub 는 짧은 설명.
const PARTIES = [
  { id: 'solo', name: '혼자', sub: '나만의 속도로 걷는 여행' },
  { id: 'couple', name: '커플', sub: '둘이서 오붓하게 보내는 하루' },
  { id: 'family', name: '가족', sub: '아이와 함께 여유롭게' },
  { id: 'group', name: '단체', sub: '친구들과 다 같이 왁자지껄' },
]

const STEP_LABELS = ['여행지', '테마', '여행 인원']

// props: onExit(위저드 닫고 원래 문구로) / onOpenCourse(코스 상세로 이동)
export default function HeroWizard({ onExit, onOpenCourse }) {
  // step: 0=여행지, 1=테마, 2=여행 인원, 3=결과
  const [step, setStep] = useState(0)
  const [destId, setDestId] = useState(null)
  const [themeId, setThemeId] = useState(null)
  const [partyId, setPartyId] = useState(null)

  // 슬라이드 트랙 높이를 "지금 보이는 패널" 높이에 맞춰 부드럽게 조절한다.
  const panelRefs = useRef([])
  const [trackHeight, setTrackHeight] = useState()

  const measure = () => {
    const el = panelRefs.current[step]
    if (el) setTrackHeight(el.offsetHeight)
  }

  // step 이나 선택값이 바뀌어 패널 내용이 달라지면 높이를 다시 잰다.
  useLayoutEffect(measure, [step, destId, themeId, partyId])

  // 창 크기가 바뀌면(반응형으로 줄바꿈이 달라짐) 높이를 다시 잰다.
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  // ESC 를 누르면 위저드를 닫는다.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onExit()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const destination = getDestination(destId)
  const theme = getTheme(themeId)
  const party = PARTIES.find((p) => p.id === partyId) || null
  const course = useMemo(
    () => (destId && themeId ? getCourseForDestinationTheme(destId, themeId) : null),
    [destId, themeId],
  )

  // '← 이전' : 결과에서 누르면 3단계로, 그 외엔 한 단계씩 뒤로. 1단계에서 누르면 위저드 종료.
  const goBack = () => {
    if (step === 0) onExit()
    else setStep((s) => s - 1)
  }

  // 선택된 칩(여행지/테마/인원)을 누르면 그 단계로 곧장 이동한다.
  const chips = [
    { label: destination?.name, at: 0, show: step > 0 },
    { label: theme?.name, at: 1, show: step > 1 },
    { label: party?.name, at: 2, show: step > 2 },
  ].filter((c) => c.show && c.label)

  return (
    <div className={styles.wizard}>
      {/* ── 위쪽 조작줄: 이전 / 진행 점 / 닫기 ── */}
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={goBack}>
          ← 이전
        </button>

        <div className={styles.dots} aria-hidden="true">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`${styles.dot} ${i === step ? styles.dotOn : ''} ${
                i < step ? styles.dotDone : ''
              }`}
            />
          ))}
        </div>

        <button type="button" className={styles.close} onClick={onExit}>
          닫기 ✕
        </button>
      </div>

      {/* ── 선택한 값 칩 (누르면 해당 단계로 점프) ── */}
      {chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((c) => (
            <button
              key={c.at}
              type="button"
              className={styles.chip}
              onClick={() => setStep(c.at)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 슬라이드 트랙 ── translateX 로 단계만큼 왼쪽으로 민다 ── */}
      <div className={styles.viewport} style={{ height: trackHeight }}>
        <div
          className={styles.track}
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {/* 1단계: 여행지 */}
          <section
            className={styles.panel}
            ref={(el) => (panelRefs.current[0] = el)}
            aria-hidden={step !== 0}
          >
            <p className={styles.kicker}>STEP 1</p>
            <h2 className={styles.q}>어디로 떠나볼까요?</h2>
            <div className={styles.options}>
              {DESTINATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.option} ${destId === item.id ? styles.optionOn : ''}`}
                  onClick={() => {
                    setDestId(item.id)
                    setStep(1)
                  }}
                >
                  <span className={styles.optName}>{item.name}</span>
                  <small className={styles.optSub}>{item.summary}</small>
                </button>
              ))}
            </div>
          </section>

          {/* 2단계: 테마 */}
          <section
            className={styles.panel}
            ref={(el) => (panelRefs.current[1] = el)}
            aria-hidden={step !== 1}
          >
            <p className={styles.kicker}>STEP 2</p>
            <h2 className={styles.q}>어떤 하루가 좋아요?</h2>
            <div className={styles.options}>
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.option} ${themeId === item.id ? styles.optionOn : ''}`}
                  onClick={() => {
                    setThemeId(item.id)
                    setStep(2)
                  }}
                >
                  <span className={styles.optName}>{item.name}</span>
                  <small className={styles.optSub}>{item.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {/* 3단계: 여행 인원 */}
          <section
            className={styles.panel}
            ref={(el) => (panelRefs.current[2] = el)}
            aria-hidden={step !== 2}
          >
            <p className={styles.kicker}>STEP 3</p>
            <h2 className={styles.q}>누구와 함께 가나요?</h2>
            <div className={styles.options}>
              {PARTIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.option} ${partyId === item.id ? styles.optionOn : ''}`}
                  onClick={() => {
                    setPartyId(item.id)
                    setStep(3)
                  }}
                >
                  <span className={styles.optName}>{item.name}</span>
                  <small className={styles.optSub}>{item.sub}</small>
                </button>
              ))}
            </div>
          </section>

          {/* 결과: 코스 카드 + 방문 순서 */}
          <section
            className={styles.panel}
            ref={(el) => (panelRefs.current[3] = el)}
            aria-hidden={step !== 3}
          >
            {course ? (
              <div className={styles.result}>
                <p className={styles.resultContext}>
                  {destination?.name} · {theme?.name} · {party?.name} 여행
                </p>
                <h2 className={styles.resultTitle}>{course.title}</h2>
                <p className={styles.resultText}>
                  {party?.name} 여행에 어울리도록 {destination?.name}의 {theme?.name} 코스를
                  골라봤어요. 카드를 누르면 지도와 일정을 볼 수 있어요.
                </p>

                <CourseCard
                  course={course}
                  image={destination?.image}
                  onOpen={onOpenCourse}
                />

                <div className={styles.routeList}>
                  {course.spots.map((spot, index) => (
                    <div key={spot.name} className={styles.routeStep}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{spot.name}</strong>
                        <p>{spot.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.empty}>준비 중인 코스예요. 곧 업데이트됩니다.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
