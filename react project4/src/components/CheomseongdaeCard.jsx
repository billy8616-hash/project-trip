import { Tower, Star } from './illustrations.jsx'
import './CheomseongdaeCard.css'

export default function CheomseongdaeCard() {
  return (
    <article className="cheom card">
      <div className="cheom__body">
        {/* 왼쪽: 제목 + 필기체 설명 */}
        <div className="cheom__text">
          <h3 className="cheom__title">CHEOMSEONGDAE</h3>
          <p className="cheom__script">
            Historical,
            <br />
            Gyeongju,
            <br />
            Silla Kingdom
          </p>
          <p className="cheom__word cheom__word--astro">ASTRONOMY</p>
        </div>

        {/* 오른쪽: 흩어진 단어들 + 첨성대 그림 */}
        <div className="cheom__aside">
          <p className="cheom__word cheom__word--ancient">ANCIENT</p>
          <p className="cheom__word cheom__word--stars">
            <span className="cheom__dots" aria-hidden="true">· · · ·</span> STARS
          </p>
          <p className="cheom__word cheom__word--gazing">STARGAZING</p>
          <Tower className="cheom__tower" />
          <p className="cheom__word cheom__word--mem">MEMORIES</p>
        </div>

        <Star className="cheom__star cheom__star--a" style={{ width: 15, height: 15 }} />
        <Star className="cheom__star cheom__star--b" style={{ width: 11, height: 11 }} />
        <Star className="cheom__star cheom__star--c" style={{ width: 13, height: 13 }} />
      </div>
    </article>
  )
}
