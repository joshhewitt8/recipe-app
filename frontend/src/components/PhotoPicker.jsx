import { useState, useEffect, useRef } from 'react'
import { recipesApi } from '../api/recipes'

export default function PhotoPicker({ recipeId, currentUrl, onSelect, onClose }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchPhotos()
  }, [])

  const fetchPhotos = async (q) => {
    setLoading(true)
    setError(null)
    try {
      const results = await recipesApi.getImageOptions(recipeId, q || undefined)
      setPhotos(results)
      if (results.length === 0) setError('No photos found — try a different search term.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setQuery(search)
    fetchPhotos(search)
  }

  const handleSelect = async (photo) => {
    setSaving(photo.id)
    try {
      const updated = await recipesApi.setImageUrl(recipeId, photo.url)
      onSelect(updated)
    } catch (err) {
      setError(err.message)
      setSaving(null)
    }
  }

  return (
    <div className="photo-picker-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="photo-picker-modal">
        <div className="photo-picker-header">
          <h3 className="photo-picker-title">Choose a photo</h3>
          <button className="photo-picker-close" onClick={onClose}>×</button>
        </div>

        <form className="photo-picker-search" onSubmit={handleSearch}>
          <input
            ref={inputRef}
            className="photo-picker-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for a different photo…"
          />
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>

        {error && <div className="alert alert-error" style={{ margin: '0 16px 12px' }}>{error}</div>}

        {loading ? (
          <div className="photo-picker-loading">
            <div className="spinner" />
          </div>
        ) : (
          <div className="photo-picker-grid">
            {photos.map((photo) => (
              <button
                key={photo.id}
                className={`photo-option ${currentUrl === photo.url ? 'photo-option-current' : ''}`}
                onClick={() => handleSelect(photo)}
                disabled={saving !== null}
              >
                <img
                  src={photo.thumb}
                  alt=""
                  className="photo-option-img"
                  loading="lazy"
                />
                {saving === photo.id && (
                  <div className="photo-option-saving">
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                  </div>
                )}
                {currentUrl === photo.url && (
                  <div className="photo-option-badge">Current</div>
                )}
                <div className="photo-option-credit">{photo.photographer}</div>
              </button>
            ))}
          </div>
        )}

        <p className="photo-picker-attribution">
          Photos provided by <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a>
        </p>
      </div>
    </div>
  )
}
