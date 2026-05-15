import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import IngredientAutocomplete from '../components/IngredientAutocomplete'
import { recipesApi } from '../api/recipes'
import { suggestUnit } from '../utils/units'

const emptyIngredient = () => ({
  name: '',
  prep_note: '',
  amount: '',
  unit: 'g',
  calories_per_100g: null,
  protein_per_100g: null,
  carbs_per_100g: null,
  fat_per_100g: null,
})
const emptyGroup = () => ({ name: '', order: 0, ingredients: [emptyIngredient()] })
const emptyStep = () => ({ step_number: 1, title: '', description: '' })
const emptyMacros = () => ({ calories: '', protein: '', carbs: '', fat: '' })

const defaultForm = () => ({
  title: '',
  description: '',
  servings: 4,
  prep_time: '',
  cook_time: '',
  notes: '',
  ingredient_groups: [emptyGroup()],
  method_steps: [emptyStep()],
  macros_overridden: false,
  macros: emptyMacros(),
})

function toApiPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    servings: parseInt(form.servings) || 4,
    prep_time: form.prep_time !== '' ? parseInt(form.prep_time) : null,
    cook_time: form.cook_time !== '' ? parseInt(form.cook_time) : null,
    notes: form.notes.trim() || null,
    macros_overridden: form.macros_overridden,
    macros: form.macros_overridden ? {
      calories: form.macros.calories !== '' ? parseFloat(form.macros.calories) : null,
      protein: form.macros.protein !== '' ? parseFloat(form.macros.protein) : null,
      carbs: form.macros.carbs !== '' ? parseFloat(form.macros.carbs) : null,
      fat: form.macros.fat !== '' ? parseFloat(form.macros.fat) : null,
    } : null,
    ingredient_groups: form.ingredient_groups
      .filter((g) => g.name.trim())
      .map((g, i) => ({
        name: g.name.trim(),
        order: i,
        ingredients: g.ingredients
          .filter((ing) => ing.name.trim() && ing.amount !== '')
          .map((ing) => ({
            name: ing.name.trim(),
            prep_note: ing.prep_note.trim() || null,
            amount: parseFloat(ing.amount) || 0,
            unit: ing.unit.trim() || null,
            calories_per_100g: ing.calories_per_100g,
            protein_per_100g: ing.protein_per_100g,
            carbs_per_100g: ing.carbs_per_100g,
            fat_per_100g: ing.fat_per_100g,
          })),
      })),
    method_steps: form.method_steps
      .filter((s) => s.description.trim())
      .map((s, i) => ({
        step_number: i + 1,
        title: s.title.trim() || null,
        description: s.description.trim(),
      })),
  }
}

function fromApiData(r) {
  return {
    title: r.title,
    description: r.description || '',
    servings: r.servings,
    prep_time: r.prep_time ?? '',
    cook_time: r.cook_time ?? '',
    notes: r.notes || '',
    macros_overridden: false,
    macros: r.macros
      ? { calories: r.macros.calories ?? '', protein: r.macros.protein ?? '',
          carbs: r.macros.carbs ?? '', fat: r.macros.fat ?? '' }
      : emptyMacros(),
    ingredient_groups: r.ingredient_groups.length > 0
      ? r.ingredient_groups.map((g) => ({
          name: g.name, order: g.order,
          ingredients: g.ingredients.length > 0
            ? g.ingredients.map((ing) => ({
                name: ing.name,
                prep_note: ing.prep_note || '',
                amount: String(ing.amount),
                unit: ing.unit || 'g',
                calories_per_100g: ing.calories_per_100g,
                protein_per_100g: ing.protein_per_100g,
                carbs_per_100g: ing.carbs_per_100g,
                fat_per_100g: ing.fat_per_100g,
              }))
            : [emptyIngredient()],
        }))
      : [emptyGroup()],
    method_steps: r.method_steps.length > 0
      ? r.method_steps.map((s) => ({ step_number: s.step_number, title: s.title || '', description: s.description }))
      : [emptyStep()],
  }
}

function fromDesignData(r) {
  return {
    title: r.title || '',
    description: r.description || '',
    servings: r.servings || 4,
    prep_time: r.prep_time || '',
    cook_time: r.cook_time || '',
    notes: r.notes || '',
    macros_overridden: false,
    macros: emptyMacros(),
    ingredient_groups: r.ingredient_groups?.length > 0
      ? r.ingredient_groups.map((g) => ({
          name: g.name || '', order: g.order || 0,
          ingredients: g.ingredients?.length > 0
            ? g.ingredients.map((ing) => ({
                name: ing.name || '', prep_note: '',
                amount: String(ing.amount || ''), unit: ing.unit || suggestUnit(ing.name || ''),
                calories_per_100g: null, protein_per_100g: null, carbs_per_100g: null, fat_per_100g: null,
              }))
            : [emptyIngredient()],
        }))
      : [emptyGroup()],
    method_steps: r.method_steps?.length > 0
      ? r.method_steps.map((s) => ({ step_number: s.step_number || 1, title: s.title || '', description: s.description || '' }))
      : [emptyStep()],
  }
}

function calcLiveMacros(form) {
  const servings = Math.max(parseInt(form.servings) || 1, 1)
  let cal = 0, pro = 0, carb = 0, fat = 0
  for (const g of form.ingredient_groups) {
    for (const ing of g.ingredients) {
      const amt = parseFloat(ing.amount)
      if (!amt || ing.calories_per_100g == null) continue
      const f = amt / 100
      cal += (ing.calories_per_100g || 0) * f
      pro += (ing.protein_per_100g || 0) * f
      carb += (ing.carbs_per_100g || 0) * f
      fat += (ing.fat_per_100g || 0) * f
    }
  }
  if (cal + pro + carb + fat === 0) return null
  return {
    calories: Math.round(cal / servings),
    protein: Math.round(pro / servings * 10) / 10,
    carbs: Math.round(carb / servings * 10) / 10,
    fat: Math.round(fat / servings * 10) / 10,
  }
}

export default function RecipeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = !!id

  const [form, setForm] = useState(defaultForm())
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit && location.state?.recipe) {
      setForm(fromDesignData(location.state.recipe))
      return
    }
    if (!isEdit) return
    recipesApi.get(id)
      .then((data) => setForm(fromApiData(data)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const setMacro = (field, value) => setForm((f) => ({ ...f, macros: { ...f.macros, [field]: value } }))

  const addGroup = () => setForm((f) => ({ ...f, ingredient_groups: [...f.ingredient_groups, emptyGroup()] }))
  const removeGroup = (i) => setForm((f) => ({ ...f, ingredient_groups: f.ingredient_groups.filter((_, j) => j !== i) }))
  const setGroupName = (i, v) => setForm((f) => ({
    ...f,
    ingredient_groups: f.ingredient_groups.map((g, j) => j === i ? { ...g, name: v } : g),
  }))

  const addIngredient = (gi) => setForm((f) => ({
    ...f,
    ingredient_groups: f.ingredient_groups.map((g, j) =>
      j === gi ? { ...g, ingredients: [...g.ingredients, emptyIngredient()] } : g
    ),
  }))
  const removeIngredient = (gi, ii) => setForm((f) => ({
    ...f,
    ingredient_groups: f.ingredient_groups.map((g, j) =>
      j === gi ? { ...g, ingredients: g.ingredients.filter((_, k) => k !== ii) } : g
    ),
  }))
  const setIngField = (gi, ii, field, value) => setForm((f) => ({
    ...f,
    ingredient_groups: f.ingredient_groups.map((g, j) =>
      j === gi
        ? { ...g, ingredients: g.ingredients.map((ing, k) => k === ii ? { ...ing, [field]: value } : ing) }
        : g
    ),
  }))
  const selectIngredient = (gi, ii, item) => setForm((f) => ({
    ...f,
    ingredient_groups: f.ingredient_groups.map((g, j) =>
      j === gi
        ? {
            ...g,
            ingredients: g.ingredients.map((ing, k) =>
              k === ii ? {
                ...ing,
                name: item.name,
                unit: suggestUnit(item.name),
                calories_per_100g: item.calories,
                protein_per_100g: item.protein,
                carbs_per_100g: item.carbs,
                fat_per_100g: item.fat,
              } : ing
            ),
          }
        : g
    ),
  }))

  const addStep = () => setForm((f) => ({
    ...f,
    method_steps: [...f.method_steps, { step_number: f.method_steps.length + 1, title: '', description: '' }],
  }))
  const removeStep = (i) => setForm((f) => ({
    ...f,
    method_steps: f.method_steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, step_number: j + 1 })),
  }))
  const setStepField = (i, field, value) => setForm((f) => ({
    ...f,
    method_steps: f.method_steps.map((s, j) => j === i ? { ...s, [field]: value } : s),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const payload = toApiPayload(form)
      const result = isEdit ? await recipesApi.update(id, payload) : await recipesApi.create(payload)
      navigate(`/recipes/${result.id}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const liveMacros = calcLiveMacros(form)

  if (loading)
    return <Layout><div className="state-box"><div className="spinner" /><p>Loading…</p></div></Layout>

  return (
    <Layout>
      <div className="container container-narrow">
        <div className="form-page-header">
          <Link to={isEdit ? `/recipes/${id}` : '/'} className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
            </svg>
            {isEdit ? 'Back to Recipe' : 'All Recipes'}
          </Link>
          <h1 className="form-page-title">{isEdit ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="recipe-form">

          {/* Basic info */}
          <div className="form-card">
            <h2 className="form-card-title">Basic Information</h2>
            <div className="field">
              <label className="field-label">Title *</label>
              <input className="field-input" type="text" value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g. Chicken Tikka Masala" required />
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea className="field-input" rows={3} value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="A brief description of the dish" />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Servings</label>
                <input className="field-input" type="number" min="1" value={form.servings}
                  onChange={(e) => setField('servings', e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Prep time (min)</label>
                <input className="field-input" type="number" min="0" value={form.prep_time}
                  onChange={(e) => setField('prep_time', e.target.value)} placeholder="e.g. 20" />
              </div>
              <div className="field">
                <label className="field-label">Cook time (min)</label>
                <input className="field-input" type="number" min="0" value={form.cook_time}
                  onChange={(e) => setField('cook_time', e.target.value)} placeholder="e.g. 45" />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="form-card">
            <div className="form-card-header">
              <h2 className="form-card-title">Ingredients</h2>
              <button type="button" onClick={addGroup} className="btn btn-secondary btn-sm">+ Add Group</button>
            </div>

            {form.ingredient_groups.map((group, gi) => (
              <div key={gi} className="ing-group-form">
                <div className="ing-group-header">
                  <input className="ing-group-name-input" type="text" value={group.name}
                    onChange={(e) => setGroupName(gi, e.target.value)}
                    placeholder="Group name (e.g. Marinade, Main, Sauce)" />
                  {form.ingredient_groups.length > 1 && (
                    <button type="button" onClick={() => removeGroup(gi)} className="remove-link">Remove group</button>
                  )}
                </div>

                <div className="ing-rows">
                  <div className="ing-row-header">
                    <span className="ing-col-amount">Amount</span>
                    <span className="ing-col-unit">Unit</span>
                    <span className="ing-col-name">Ingredient</span>
                    <span></span>
                  </div>
                  {group.ingredients.map((ing, ii) => (
                    <div key={ii} className="ing-row-wrap">
                      <div className="ing-row">
                        <input className="ing-input ing-col-amount" type="number"
                          step="any" min="0" value={ing.amount}
                          onChange={(e) => setIngField(gi, ii, 'amount', e.target.value)}
                          placeholder="0" />
                        <input className="ing-input ing-col-unit" type="text" value={ing.unit}
                          onChange={(e) => setIngField(gi, ii, 'unit', e.target.value)}
                          placeholder="g" />
                        <IngredientAutocomplete
                          value={ing.name}
                          onChange={(v) => setIngField(gi, ii, 'name', v)}
                          onSelect={(item) => selectIngredient(gi, ii, item)}
                        />
                        <button type="button" className="row-remove-btn"
                          onClick={() => removeIngredient(gi, ii)}
                          disabled={group.ingredients.length === 1}>×</button>
                      </div>
                      {/* Prep note */}
                      <div className="ing-prep-row">
                        <input
                          className="ing-prep-input"
                          type="text"
                          value={ing.prep_note}
                          onChange={(e) => setIngField(gi, ii, 'prep_note', e.target.value)}
                          placeholder="Preparation note, e.g. finely sliced, grated, diced (optional)"
                        />
                        {ing.calories_per_100g != null && (
                          <span className="macro-badge">
                            {ing.calories_per_100g} kcal · {ing.protein_per_100g}g P · {ing.carbs_per_100g}g C · {ing.fat_per_100g}g F per 100g
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="add-row-btn" onClick={() => addIngredient(gi)}>
                  + Add ingredient
                </button>
              </div>
            ))}

            {/* Macros section */}
            <div className="macros-form-section">
              {liveMacros && !form.macros_overridden && (
                <div className="live-macros-preview">
                  <span className="live-macros-label">Estimated per serving</span>
                  <div className="live-macros-values">
                    <span><strong>{liveMacros.calories}</strong> kcal</span>
                    <span><strong>{liveMacros.protein}g</strong> protein</span>
                    <span><strong>{liveMacros.carbs}g</strong> carbs</span>
                    <span><strong>{liveMacros.fat}g</strong> fat</span>
                  </div>
                  <button
                    type="button"
                    className="macro-override-toggle"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        macros_overridden: true,
                        macros: {
                          calories: String(liveMacros.calories),
                          protein: String(liveMacros.protein),
                          carbs: String(liveMacros.carbs),
                          fat: String(liveMacros.fat),
                        },
                      }))
                    }}
                  >
                    Override manually
                  </button>
                </div>
              )}

              {form.macros_overridden && (
                <div className="macros-override-form">
                  <div className="macros-override-header">
                    <span className="macros-override-label">Manual macros per serving</span>
                    <button
                      type="button"
                      className="macro-override-toggle"
                      onClick={() => setField('macros_overridden', false)}
                    >
                      Use calculated
                    </button>
                  </div>
                  <div className="macros-override-fields">
                    {[
                      { key: 'calories', label: 'Calories' },
                      { key: 'protein', label: 'Protein (g)' },
                      { key: 'carbs', label: 'Carbs (g)' },
                      { key: 'fat', label: 'Fat (g)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="field">
                        <label className="field-label">{label}</label>
                        <input className="field-input" type="number" min="0" step="0.1"
                          value={form.macros[key]}
                          onChange={(e) => setMacro(key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!liveMacros && !form.macros_overridden && (
                <button
                  type="button"
                  className="macro-override-toggle macro-override-toggle-standalone"
                  onClick={() => setField('macros_overridden', true)}
                >
                  + Enter macros manually
                </button>
              )}
            </div>
          </div>

          {/* Method */}
          <div className="form-card">
            <div className="form-card-header">
              <h2 className="form-card-title">Method</h2>
              <button type="button" onClick={addStep} className="btn btn-secondary btn-sm">+ Add Step</button>
            </div>
            {form.method_steps.map((step, i) => (
              <div key={i} className="step-form-row">
                <div className="step-form-num">{i + 1}</div>
                <div className="step-form-inputs">
                  <input className="field-input step-title-input" type="text" value={step.title}
                    onChange={(e) => setStepField(i, 'title', e.target.value)}
                    placeholder="Step title (optional)" />
                  <textarea className="field-input" rows={3} value={step.description}
                    onChange={(e) => setStepField(i, 'description', e.target.value)}
                    placeholder="Describe this step…" />
                </div>
                <button type="button" className="row-remove-btn"
                  onClick={() => removeStep(i)} disabled={form.method_steps.length === 1}>×</button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="form-card">
            <h2 className="form-card-title">Notes <span className="optional-tag">optional</span></h2>
            <div className="field">
              <textarea className="field-input" rows={4} value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Tips, variations, storage instructions…" />
            </div>
          </div>

          <div className="form-footer">
            <Link to={isEdit ? `/recipes/${id}` : '/'} className="btn btn-ghost-dark">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Recipe'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
