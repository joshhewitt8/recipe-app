import { Link } from 'react-router-dom'

function formatTime(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function RecipeCard({ recipe }) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <Link to={`/recipes/${recipe.id}`} className="recipe-card">
      <h3 className="recipe-card-title">{recipe.title}</h3>
      {recipe.description && (
        <p className="recipe-card-desc">{recipe.description}</p>
      )}
      <div className="recipe-card-meta">
        <span className="meta-pill">{recipe.servings} servings</span>
        {totalTime > 0 && (
          <span className="meta-pill">{formatTime(totalTime)}</span>
        )}
        {recipe.prep_time && (
          <span className="meta-pill muted">Prep {formatTime(recipe.prep_time)}</span>
        )}
      </div>
    </Link>
  )
}
