import { Globe, Star } from './illustrations.jsx'
import './NavBar.css'

const LINKS = ['HOME', 'DESTINATIONS', 'BLOG', 'BOOK NOW', 'CONTACT']

export default function NavBar() {
  return (
    <header className="nav">
      <span className="nav__spark nav__spark--l">
        <Star style={{ width: 14, height: 14 }} />
        <Star style={{ width: 9, height: 9 }} />
      </span>

      <Globe className="nav__globe" />

      <nav className="nav__links">
        {LINKS.map((label) => (
          <a
            key={label}
            href="#"
            className={
              'nav__link' + (label === 'HOME' ? ' nav__link--active' : '')
            }
          >
            {label}
            {label === 'HOME' && (
              <svg className="nav__underline" viewBox="0 0 120 12" aria-hidden="true">
                <path
                  d="M4 8 q30 -6 58 -3 q30 3 54 -1"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#rough)"
                />
              </svg>
            )}
          </a>
        ))}
      </nav>

      <Globe className="nav__globe" />

      <span className="nav__spark nav__spark--r">
        <Star style={{ width: 13, height: 13 }} />
        <Star style={{ width: 8, height: 8 }} />
      </span>
    </header>
  )
}
