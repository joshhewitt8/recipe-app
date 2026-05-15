import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import RecipeCard from '../components/RecipeCard'
import { recipesApi } from '../api/recipes'
import { Link } from 'react-router-dom'

export default function RecipeList() {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    recipesApi
      .list()
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
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">All Recipes</h1>
          <div className="search-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="search"
              className="search-input"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && (
          <div className="state-box">
            <div className="spinner" />
            <p>Loading recipes…</p>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="state-box">
            {search ? (
              <p>No recipes match &ldquo;{search}&rdquo;.</p>
            ) : (
              <>
                <p>No recipes yet.</p>
                <Link to="/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                  Create your first recipe
                </Link>
              </>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="recipe-grid">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
