import { useState, useRef, useEffect, useCallback } from 'react'

function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

export default function IngredientAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const search = useCallback(
    debounce(async (q) => {
      if (q.length < 2) { setResults([]); return }
      setLoading(true)
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  useEffect(() => {
    search(value)
  }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={ref}>
      <input
        className="ing-input ing-col-name"
        type="text"
        value={value}
        placeholder={placeholder || 'Search ingredient…'}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => value.length >= 2 && setOpen(true)}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <ul className="autocomplete-dropdown">
          {loading && <li className="autocomplete-loading">Searching…</li>}
          {results.map((item) => (
            <li
              key={item.fdcId}
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(item)
                setOpen(false)
              }}
            >
              <span className="autocomplete-name">{item.name}</span>
              <span className="autocomplete-macros">
                {item.calories} kcal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                <span className="autocomplete-per"> per 100g</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
