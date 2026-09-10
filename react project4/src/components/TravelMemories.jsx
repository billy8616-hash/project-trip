import { PhotoThumb } from './illustrations.jsx'
import './TravelMemories.css'

const POSTS = [
  { title: 'My Cheomseongdae Visit', side: 'left' },
  { title: 'Backpacking Through Gyeongju', side: 'right' },
  { title: 'Travel Memories', side: 'left' },
]

export default function TravelMemories() {
  return (
    <article className="tmem card">
      <h3 className="tmem__title">TRAVEL MEMORIES</h3>

      <ul className="tmem__list">
        {POSTS.map((post) => (
          <li key={post.title} className={'tmem__item tmem__item--' + post.side}>
            <PhotoThumb className="tmem__thumb" />
            <div className="tmem__lines">
              <span className="tmem__heading">{post.title}</span>
              <span className="tmem__rule" />
              <span className="tmem__rule tmem__rule--short" />
            </div>
          </li>
        ))}
      </ul>

      <span className="tmem__scrawl">MEMORIES</span>
      <svg className="tmem__arrow" viewBox="0 0 80 60" aria-hidden="true">
        <path
          d="M8 52 q6 -34 40 -40"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#rough)"
        />
        <path
          d="M40 6 l10 -2 l-4 12"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#rough)"
        />
      </svg>
    </article>
  )
}
