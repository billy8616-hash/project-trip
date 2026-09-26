// ─────────────────────────────────────────────────────────────
// screens/course-detail/PlaceCard.jsx — 장소 카드 한 장
//
// 접힌 상태에서는 이름·시간·태그만, 펼치면 추천 이유·주의사항·영업시간·링크가 나온다.
// isFirst/isLast 는 위·아래 이동 버튼을 가리는 데 쓴다.
// (여기서는 드래그 없이 ↑↓ 버튼으로 순서를 바꾼다)
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Icon, StarIcon } from './icons.jsx'
import { kindStyle } from './kindStyle.js'
import { websiteMeta } from './websiteMeta.js'

/* 썸네일 — 종류 색 자리표시 타일 위에 사진을 덮는다.
   사진을 받는 동안·URL 이 깨졌을 때도 빈칸 대신 타일이 그대로 보이도록 겹쳐 두는 구조다. */
// 장소 사진. 주소가 깨졌거나 불러오기에 실패하면(broken) 기본 일러스트로 대체한다.
function Thumb({ place }) {
  const k = kindStyle(place.kind)
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(place.image) && !broken
  return (
    <div
      className="tw-relative tw-grid tw-h-16 tw-w-16 tw-shrink-0 tw-place-items-center tw-overflow-hidden tw-rounded-cxl tw-border tw-border-cline"
      style={{ background: k.bg, color: k.fg }}
    >
      <Icon name="image" size={22} stroke={1.8} />
      {showImage && (
        <img
          src={place.image}
          alt={`${place.name} 사진`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover"
        />
      )}
    </div>
  )
}

export function PlaceCard({ place, isFirst, isLast, isActive, onPick, onMoveUp, onMoveDown }) {
  // 처음엔 다 접힌 채로 보여준다. 카드 자체를 누르면 펼침/접힘 + 지도 선택이 같이 일어난다.
  const [open, setOpen] = useState(false)
  const k = kindStyle(place.kind)

  const toggle = () => {
    setOpen((v) => !v)
    onPick && onPick(place)
  }

  return (
    <div id={`course-place-${place.id}`} className="tw-grid tw-grid-cols-[32px_minmax(0,1fr)] tw-gap-3">
      {/* 순번 마커 + 위/아래 이동 버튼 + 세로 연결선. 이 칼럼은 옆의 role="button" 카드와
          형제 요소라서, 카드 클릭(펼침/접힘)과 겹치지 않고 독립적으로 누를 수 있다.
          위로 버튼은 위 칸의 이동수단 배지 바로 밑에서 시작되는 자리라, mt(위쪽 여백)를 넉넉히
          줘서 배지 아이콘에 안 붙게 한다 — 예전엔 여백이 없어서 배지랑 한 덩어리로 보였다. */}
      <div className="tw-flex tw-flex-col tw-items-center">
        {onMoveUp && !isFirst && (
          <button
            type="button"
            onClick={onMoveUp}
            aria-label="이전 장소와 순서 바꾸기"
            className="tw-mb-1.5 tw-mt-2 tw-grid tw-h-6 tw-w-6 tw-place-items-center tw-rounded-full tw-text-cink-faint tw-transition-colors hover:tw-bg-surface-2 hover:tw-text-caccent"
          >
            <Icon name="chevron" size={13} className="tw--rotate-90" />
          </button>
        )}
        <div className={`tw-grid tw-h-7 tw-w-7 tw-place-items-center tw-rounded-full tw-text-[13px] tw-font-bold tw-tabular-nums ${
          isActive ? 'tw-bg-caccent tw-text-white tw-ring-2 tw-ring-caccent/30' : 'tw-bg-caccent tw-text-white'
        }`}>
          {place.order}
        </div>
        {onMoveDown && !isLast && (
          <button
            type="button"
            onClick={onMoveDown}
            aria-label="다음 장소와 순서 바꾸기"
            className="tw-mt-1.5 tw-grid tw-h-6 tw-w-6 tw-place-items-center tw-rounded-full tw-text-cink-faint tw-transition-colors hover:tw-bg-surface-2 hover:tw-text-caccent"
          >
            <Icon name="chevron" size={13} className="tw-rotate-90" />
          </button>
        )}
        {!isLast && <div className="tw-mt-1.5 tw-w-px tw-flex-1 tw-bg-cline" />}
      </div>

      {/* 카드 전체가 하나의 버튼: 누르면 지도 선택 + 상세 펼침/접힘이 함께 일어난다. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={`tw-mb-4 tw-cursor-pointer tw-rounded-cxl tw-border tw-bg-surface tw-p-4 tw-shadow-ccard tw-transition-colors ${
          isActive ? 'tw-border-caccent' : 'tw-border-cline hover:tw-border-caccent/40'
        }`}
      >
        <div className="tw-flex tw-gap-3.5">
          <Thumb place={place} />
          <div className="tw-min-w-0 tw-flex-1">
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
              <div className="tw-min-w-0">
                <h3 className="tw-truncate tw-text-[15px] tw-font-semibold tw-text-cink">{place.name}</h3>
                <div className="tw-mt-1 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                  <span className="tw-rounded-md tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold" style={{ background: k.bg, color: k.fg }}>
                    {place.category || k.label}
                  </span>
                  {place.bestTime && (
                    <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                      <Icon name="clock" size={11} />{place.bestTime}
                    </span>
                  )}
                  {/* 사용자가 "꼭 가고 싶은 곳"에 직접 적은 장소. 추천으로 들어온 곳과 구분해 주면
                      내가 적은 것이 반영됐는지 한눈에 확인할 수 있다. */}
                  {place.mustVisit && (
                    <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-cmark/50 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-cink">
                      <Icon name="spark" size={11} />꼭 가고 싶은 곳
                    </span>
                  )}
                </div>
              </div>
              <div className="tw-flex tw-shrink-0 tw-items-center tw-gap-1">
                {/* 접힌 상태에도 보이는 유일한 "딥 데이터" — 숫자 하나만. 리뷰수·요약·링크는 펼쳤을 때만. */}
                {Number.isFinite(place.rating) && (
                  <span className="tw-inline-flex tw-items-center tw-gap-0.5 tw-text-[12px] tw-font-semibold tw-tabular-nums tw-text-cink-muted">
                    <StarIcon size={11} />{place.rating.toFixed(1)}
                  </span>
                )}
                {/* 이제 이 자체는 버튼이 아니라 '펼쳐짐' 상태만 보여주는 장식 화살표 */}
                <span aria-hidden="true" className="tw--mr-1 tw--mt-1 tw-rounded-lg tw-p-1.5 tw-text-cink-faint">
                  <Icon name="chevron" size={16} className={`${open ? 'tw-rotate-90' : ''} tw-transition-transform tw-duration-200`} />
                </span>
              </div>
            </div>

            {place.timeRange && <p className="tw-mt-1 tw-text-xs tw-text-cink-faint tw-tabular-nums">{place.timeRange}</p>}

            {/* CSS grid-rows 트릭으로 높이를 0↔1fr 로 트랜지션 — 내용이 아래로 펼쳐지는 애니메이션 */}
            <div
              className={`tw-grid tw-overflow-hidden tw-transition-[grid-template-rows] tw-duration-200 tw-ease-out ${
                open ? 'tw-grid-rows-[1fr]' : 'tw-grid-rows-[0fr]'
              }`}
            >
              <div className="tw-min-h-0 tw-overflow-hidden">
                <div className="tw-space-y-2.5 tw-pt-2.5">
                  {/* 별점 · 리뷰수 — 신뢰 신호라 목록 맨 위, 다른 메타 칩보다 먼저 보여준다 */}
                  {Number.isFinite(place.rating) && (
                    <div className="tw-flex tw-items-center tw-gap-1 tw-text-[13px] tw-font-semibold tw-text-cink">
                      <StarIcon size={13} />
                      <span className="tw-tabular-nums">{place.rating.toFixed(1)}</span>
                      {Number.isFinite(place.reviewCount) && (
                        <span className="tw-font-medium tw-text-cink-faint">
                          리뷰 {place.reviewCount.toLocaleString()}개
                        </span>
                      )}
                    </div>
                  )}

                  {/* 구글 한줄요약 — AI 추천이유(place.desc)와 출처가 다르므로 따옴표+옅은 배경으로 분리해 보여준다 */}
                  {place.editorialSummary && (
                    <p className="tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12.5px] tw-italic tw-leading-relaxed tw-text-cink-muted">
                      “{place.editorialSummary}”
                    </p>
                  )}

                  {/* 체류시간 · 요금 · 대중교통 접근성 */}
                  {(place.stay || place.fee || place.transit) && (
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                      {place.stay && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          <Icon name="clock" size={11} />체류 약 {place.stay}
                        </span>
                      )}
                      {place.fee && (
                        <span className="tw-inline-flex tw-items-center tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          {place.fee}
                        </span>
                      )}
                      {place.transit && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          <Icon name="bus" size={11} />{place.transit}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 영업시간 · 휴무일 — 요일별로 줄바꿈된 원문을 그대로 살려서 보여준다 */}
                  {(place.openHoursText || place.closedDayText) && (
                    <p className="tw-flex tw-items-start tw-gap-1.5 tw-whitespace-pre-line tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-leading-relaxed tw-text-cink-muted">
                      <Icon name="calendar" size={13} className="tw-mt-0.5 tw-shrink-0" />
                      <span>{[place.openHoursText, place.closedDayText].filter(Boolean).join('\n')}</span>
                    </p>
                  )}

                  {place.desc && <p className="tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">{place.desc}</p>}

                  {/* 손글씨 스타일 팁 강조 박스 */}
                  {place.tip && (
                    <div className="tw-flex tw-items-start tw-gap-2 tw-rounded-lg tw-border tw-border-cmark tw-bg-cmark/20 tw-px-3 tw-py-2">
                      <Icon name="spark" size={15} className="tw-mt-0.5 tw-shrink-0 tw-text-[#B8860B]" />
                      <p className="tw-font-chand tw-text-[15px] tw-leading-snug tw-text-cink">
                        <span style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(255,229,138,.85) 60%, rgba(255,229,138,.85) 92%, transparent 92%)' }}>
                          {place.tip}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* 영업시간 경고 등 */}
                  {place.note && (
                    <p className="tw-inline-flex tw-items-start tw-gap-1.5 tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-text-cink-muted">
                      <Icon name="warn" size={13} className="tw-mt-0.5 tw-shrink-0" />{place.note}
                    </p>
                  )}

                  {/* 주차 안내 */}
                  {place.parking && (
                    <p className="tw-inline-flex tw-items-start tw-gap-1.5 tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-text-cink-muted">
                      <Icon name="parking" size={13} className="tw-mt-0.5 tw-shrink-0" />{place.parking}
                    </p>
                  )}

                  {place.address && <p className="tw-text-[12px] tw-text-cink-faint">{place.address}</p>}

                  {/* 홈페이지/SNS 링크 — 텍스트 버튼이 아니라 작은 아이콘 pill 로, 맨 마지막에 몰아서 둔다 */}
                  {place.websiteUrl && (() => {
                    const meta = websiteMeta(place.websiteUrl)
                    return (
                      <a
                        href={place.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-border-cline tw-px-3 tw-py-1.5 tw-text-[12px] tw-font-semibold tw-text-cink-muted tw-transition-colors hover:tw-border-caccent/40 hover:tw-text-caccent"
                      >
                        <Icon name={meta.icon} size={13} />{meta.label}
                        <Icon name="externalLink" size={11} className="tw-text-cink-faint" />
                      </a>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
