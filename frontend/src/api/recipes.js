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
    const url = search ? `${BASE}/recipes?search=${encodeURIComponent(search)}` : `${BASE}/recipes`
    return fetch(url).then(handleResponse)
  },
  get: (id) => fetch(`${BASE}/recipes/${id}`).then(handleResponse),
  create: (data) => fetch(`${BASE}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  update: (id, data) => fetch(`${BASE}/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handleResponse),
  delete: (id) => fetch(`${BASE}/recipes/${id}`, { method: 'DELETE' }).then(handleResponse),

  getImageOptions: (id, q) => {
    const url = q
      ? `${BASE}/recipes/${id}/image-options?q=${encodeURIComponent(q)}`
      : `${BASE}/recipes/${id}/image-options`
    return fetch(url).then(handleResponse)
  },

  setImageUrl: (id, url) =>
    fetch(`${BASE}/recipes/${id}/image-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(handleResponse),
}

export async function streamChat(messages, onChunk, onDone) {
  const res = await fetch(`${BASE}/design/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat failed' }))
    throw new Error(err.detail || 'Chat failed')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const { text } = JSON.parse(data)
        if (text) { fullText += text; onChunk(fullText) }
      } catch {}
    }
  }
  onDone(fullText)
}
