const BASE = '/api'

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const recipesApi = {
  list: (search) => {
    const url = search
      ? `${BASE}/recipes?search=${encodeURIComponent(search)}`
      : `${BASE}/recipes`
    return fetch(url).then(handleResponse)
  },

  get: (id) => fetch(`${BASE}/recipes/${id}`).then(handleResponse),

  create: (data) =>
    fetch(`${BASE}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id, data) =>
    fetch(`${BASE}/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id) =>
    fetch(`${BASE}/recipes/${id}`, { method: 'DELETE' }).then(handleResponse),
}
