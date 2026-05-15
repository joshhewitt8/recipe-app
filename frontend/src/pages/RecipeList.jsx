import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import RecipeCard from '../components/RecipeCard'
import { recipesApi } from '../api/recipes'

export default function RecipeList() {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    recipesApi.list()
      .then(setRecipes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return recipes
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    )
  }, [recipes, search])

  return (
    <Layout>
      {/* Dark hero header */}
      <div className="list-hero">
        <div className="list-hero-inner">
          <div>
            <h1>My Recipes</h1>
            <p className="list-hero-sub">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved</p>
          </div>
          <div className="list-controls">
            <div className="search-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search"
                className="search-input"
                placeholder="Search recipes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link to="/new" className="btn btn-primary">New Recipe</Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="recipe-grid-section">
        {loading && <div className="state-box"><div className="spinner" /><p>Loading…</p></div>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="state-box">
            {search ? (
              <p>No recipes match &ldquo;{search}&rdquo;</p>
            ) : (
              <>
                <p>No recipes yet — create your first one.</p>
                <Link to="/new" className="btn btn-primary" style={{ marginTop: 8 }}>New Recipe</Link>
              </>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            {search && <p className="recipe-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>}
            <div className="recipe-grid">
              {filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
