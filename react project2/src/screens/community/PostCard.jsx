// ─────────────────────────────────────────────────────────────
// screens/community/PostCard.jsx — 목록에 뿌려지는 코스 카드 한 장
//
// 카드에서 바로 추천을 누를 수 있어서 상세를 열지 않고도 반응을 남길 수 있다.
// ─────────────────────────────────────────────────────────────

import { fmtDate } from './fmtDate.js'
import { Stars } from './Stars.jsx'

export function PostCard({ post, user, onOpen, onLike }) {
  const isMine = Boolean(user && post.userId === user.id)
  return (
    <article
      onClick={() => onOpen(post.id)}
      className="tw-cursor-pointer tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-4 tw-shadow-ccard tw-transition-colors hover:tw-border-caccent/40"
    >
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-min-w-0">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <span className="tw-rounded-md tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-caccent">
              {post.city}
            </span>
            <span className="tw-text-[11px] tw-text-cink-faint">{post.dayCount}일 코스</span>
          </div>
          <h3 className="tw-mt-1.5 tw-truncate tw-text-[15px] tw-font-semibold tw-text-cink">{post.title}</h3>
          {post.summary && (
            <p className="tw-mt-1 tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">{post.summary}</p>
          )}
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
            disabled={isMine}
            title={isMine ? '내가 올린 코스는 추천할 수 없어요.' : undefined}
            onClick={(event) => { event.stopPropagation(); onLike(post.id) }}
            className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[12px] tw-font-semibold tw-tabular-nums tw-transition-colors disabled:tw-cursor-not-allowed disabled:tw-opacity-50 ${
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
