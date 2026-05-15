import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { recipesApi } from '../api/recipes'

function formatTime(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatAmount(n) {
  if (n === Math.floor(n)) return n.toString()
  return parseFloat(n.toFixed(2)).toString()
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [servings, setServings] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    recipesApi.get(id)
      .then((data) => { setRecipe(data); setServings(data.servings) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await recipesApi.delete(id)
      navigate('/')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (loading) return <Layout><div className="state-box"><div className="spinner" /><p>Loading…</p></div></Layout>
  if (error) return <Layout><div className="container"><div className="alert alert-error">{error}</div></div></Layout>
  if (!recipe) return null

  const scaleFactor = servings / recipe.servings
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const hasMacros = recipe.macros &&
    [recipe.macros.calories, recipe.macros.protein, recipe.macros.carbs, recipe.macros.fat].some(v => v != null && v > 0)

  return (
    <Layout>
      {/* Dark hero */}
      <div className="detail-hero">
        <div className="detail-hero-inner">
          <div className="detail-topbar">
            <Link to="/" className="back-link" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
              </svg>
              All Recipes
            </Link>
            <div className="detail-actions">
              <Link to={`/recipes/${id}/edit`} className="btn btn-ghost">Edit</Link>
              {confirmDelete ? (
                <>
                  <button onClick={handleDelete} className="btn btn-danger-solid" disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">Cancel</button>
                </>
              ) : (
                <button onClick={handleDelete} className="btn btn-danger">Delete</button>
              )}
            </div>
          </div>

          <h1 className="detail-title">{recipe.title}</h1>
          {recipe.description && <p className="detail-description">{recipe.description}</p>}

          {(recipe.prep_time || recipe.cook_time || recipe.servings) && (
            <div className="detail-meta-strip">
              <div className="meta-stat">
                <span className="meta-stat-label">Serves</span>
                <span className="meta-stat-value">{recipe.servings}</span>
              </div>
              {recipe.prep_time && (
                <div className="meta-stat">
                  <span className="meta-stat-label">Prep</span>
                  <span className="meta-stat-value">{formatTime(recipe.prep_time)}</span>
                </div>
              )}
              {recipe.cook_time && (
                <div className="meta-stat">
                  <span className="meta-stat-label">Cook</span>
                  <span className="meta-stat-value">{formatTime(recipe.cook_time)}</span>
                </div>
              )}
              {totalTime > 0 && (
                <div className="meta-stat">
                  <span className="meta-stat-label">Total</span>
                  <span className="meta-stat-value">{formatTime(totalTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="detail-body">
        <div className="detail-main">

          {/* Ingredients */}
          {recipe.ingredient_groups.length > 0 && (
            <section className="detail-section">
              <h2 className="section-title">Ingredients</h2>
              {recipe.ingredient_groups.map((group) => (
                <div key={group.id} className="ing-group">
                  <h3 className="ing-group-name">{group.name}</h3>
                  <ul className="ing-list">
                    {group.ingredients.map((ing) => (
                      <li key={ing.id} className="ing-item">
                        <span className="ing-amount">
                          {formatAmount(ing.amount * scaleFactor)}{ing.unit ? ` ${ing.unit}` : ''}
                        </span>
                        <span className="ing-name">{ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {/* Method */}
          {recipe.method_steps.length > 0 && (
            <section className="detail-section">
              <h2 className="section-title">Method</h2>
              <ol className="step-list">
                {recipe.method_steps.map((step) => (
                  <li key={step.id} className="step-item">
                    <div className="step-num">{step.step_number}</div>
                    <div className="step-body">
                      {step.title && <h4 className="step-title">{step.title}</h4>}
                      <p className="step-desc">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Notes */}
          {recipe.notes && (
            <section className="detail-section">
              <h2 className="section-title">Notes</h2>
              <div className="notes-block">{recipe.notes}</div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          {/* Servings scaler */}
          <div className="servings-scaler">
            <div className="servings-scaler-title">Adjust Servings</div>
            <div className="servings-controls">
              <button className="servings-btn" onClick={() => setServings(s => Math.max(1, s - 1))}
                disabled={servings <= 1}>−</button>
              <input type="number" className="servings-input" value={servings} min="1"
                onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))} />
              <button className="servings-btn" onClick={() => setServings(s => s + 1)}>+</button>
            </div>
            {scaleFactor !== 1 && (
              <p className="scale-note">Scaled from {recipe.servings} servings</p>
            )}
          </div>

          {/* Macros */}
          {hasMacros && (
            <div className="macros-card">
              <div className="macros-card-header">Nutrition per serving</div>
              <div className="macros-grid">
                {recipe.macros.calories > 0 && (
                  <div className="macro-cell">
                    <span className="macro-val">{Math.round(recipe.macros.calories)}</span>
                    <span className="macro-lbl">Calories</span>
                  </div>
                )}
                {recipe.macros.protein > 0 && (
                  <div className="macro-cell">
                    <span className="macro-val">{recipe.macros.protein}g</span>
                    <span className="macro-lbl">Protein</span>
                  </div>
                )}
                {recipe.macros.carbs > 0 && (
                  <div className="macro-cell">
                    <span className="macro-val">{recipe.macros.carbs}g</span>
                    <span className="macro-lbl">Carbs</span>
                  </div>
                )}
                {recipe.macros.fat > 0 && (
                  <div className="macro-cell">
                    <span className="macro-val">{recipe.macros.fat}g</span>
                    <span className="macro-lbl">Fat</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
