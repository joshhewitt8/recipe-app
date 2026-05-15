import { Link } from 'react-router-dom'

export default function Layout({ children }) {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-4.5-6.75-5-9.52-5C3.54 9.99 1 10.5 1 14.99v1h15.03v-1z"/>
            </svg>
            Recipes
          </Link>
          <Link to="/new" className="btn btn-primary">
            New Recipe
          </Link>
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  )
}
