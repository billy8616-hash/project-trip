// ─────────────────────────────────────────────────────────────
// screens/community/PostCard.jsx — 목록에 뿌려지는 코스 카드 한 장
//
// 카드에서 바로 추천을 누를 수 있어서 상세를 열지 않고도 반응을 남길 수 있다.
// ─────────────────────────────────────────────────────────────

import { journeyThemes } from '../../data/travelOptions.js'
import { fmtDate } from './fmtDate.js'
import { Stars } from './Stars.jsx'

export function PostCard({ post, onOpen, onLike }) {
  const theme = journeyThemes.find((item) => item.id === post.journeyTheme)
  return (
    <article
      onClick={() => onOpen(post.id)}
      className="tw-cursor-pointer tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-4 tw-shadow-ccard tw-transition-colors hover:tw-border-caccent/40"
    >
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-flex tw-min-w-0 tw-gap-3">
          {post.images?.[0] && (
            <img
              src={post.images[0]}
              alt=""
              className="tw-h-16 tw-w-16 tw-shrink-0 tw-rounded-xl tw-border tw-border-cline tw-object-cover"
            />
          )}
          <div className="tw-min-w-0">
            <div className="tw-flex tw-items-center tw-gap-1.5">
              <span className="tw-rounded-md tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-caccent">
                {post.city}
              </span>
              <span className="tw-text-[11px] tw-text-cink-faint">{post.dayCount}일 코스</span>
              {theme && (
                <span className="tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-cink-muted">
                  {theme.label}
                </span>
              )}
            </div>
            <h3 className="tw-mt-1.5 tw-truncate tw-text-[15px] tw-font-semibold tw-text-cink">{post.title}</h3>
            {post.summary && (
              <p className="tw-mt-1 tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">{post.summary}</p>
            )}
          </div>
        </div>
        <div className="tw-shrink-0 tw-text-right">
          <Stars value={post.avgRating} />
          <p
            className="tw-mt-0.5 tw-text-[11px] tw-font-semibold tw-tabular-nums tw-text-cink-muted"
            title="글쓴이 본인 평가가 포함된 평균이에요."
          >
            {post.avgRating.toFixed(1)} <span className="tw-font-normal tw-text-cink-faint">(글쓴이 포함)</span>
          </p>
        </div>
      </div>

      <div className="tw-mt-3 tw-flex tw-items-center tw-justify-between tw-gap-2 tw-border-t tw-border-cline tw-pt-2.5">
        <span className="tw-truncate tw-text-[12px] tw-text-cink-faint">
          {post.authorName} · {fmtDate(post.createdAt)}
        </span>
        <div className="tw-flex tw-shrink-0 tw-items-center tw-gap-1.5">
          <span className="tw-text-[12px] tw-tabular-nums tw-text-cink-faint">후기 {post.reviewCount}</span>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onLike(post.id) }}
            className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[12px] tw-font-semibold tw-tabular-nums tw-transition-colors ${
              post.liked
                ? 'tw-border-caccent tw-bg-caccent tw-text-white'
                : 'tw-border-cline tw-text-cink-muted hover:tw-border-caccent/50 hover:tw-text-caccent'
            }`}
          >
            ♥ {post.likeCount}
          </button>
        </div>
      </div>
    </article>
  )
}
