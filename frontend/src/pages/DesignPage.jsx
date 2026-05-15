import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { streamChat } from '../api/recipes'

function extractRecipe(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    return parsed.recipe || null
  } catch {
    return null
  }
}

function MessageBubble({ msg, isStreaming }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`chat-row ${isUser ? 'chat-row-user' : 'chat-row-assistant'}`}>
      {!isUser && (
        <div className="chat-avatar">C</div>
      )}
      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
        <MessageContent text={msg.content} />
        {isStreaming && !msg.content && <span className="chat-cursor" />}
      </div>
    </div>
  )
}

function MessageContent({ text }) {
  if (!text) return <span className="chat-cursor" />
  // Render code blocks differently
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('```') ? (
          <pre key={i} className="chat-code">{part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')}</pre>
        ) : (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
        )
      )}
    </>
  )
}

const STARTERS = [
  'Design me a high-protein chicken meal prep recipe',
  'I want a quick weeknight pasta with what\'s in most fridges',
  'Create a show-stopping dinner party dessert',
  'Build a healthy Buddha bowl with macros under 600 kcal',
]

export default function DesignPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [detectedRecipe, setDetectedRecipe] = useState(null)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const content = (text || input).trim()
    if (!content || streaming) return

    setInput('')
    setError(null)
    setDetectedRecipe(null)

    const userMsg = { role: 'user', content }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      await streamChat(
        history,
        (fullText) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: fullText }
            return updated
          })
        },
        (fullText) => {
          const recipe = extractRecipe(fullText)
          if (recipe) setDetectedRecipe(recipe)
        }
      )
    } catch (err) {
      setError(err.message)
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const loadRecipe = () => {
    navigate('/new', { state: { recipe: detectedRecipe } })
  }

  return (
    <Layout>
      <div className="design-layout">
        {/* Header */}
        <div className="design-hero">
          <div className="design-hero-inner">
            <h1 className="design-hero-title">Recipe Designer</h1>
            <p className="design-hero-sub">
              Describe what you want to cook — Claude will design the full recipe with you, then load it straight into your collection.
            </p>
          </div>
        </div>

        <div className="design-body">
          {/* Chat area */}
          <div className="chat-area">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p className="chat-empty-title">What would you like to cook?</p>
                <p className="chat-empty-sub">Try one of these to get started</p>
                <div className="chat-starters">
                  {STARTERS.map((s) => (
                    <button key={s} className="chat-starter-btn" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    msg={msg}
                    isStreaming={streaming && i === messages.length - 1}
                  />
                ))}
                {detectedRecipe && (
                  <div className="recipe-ready-card">
                    <div className="recipe-ready-info">
                      <span className="recipe-ready-label">Recipe ready</span>
                      <span className="recipe-ready-title">{detectedRecipe.title}</span>
                    </div>
                    <button onClick={loadRecipe} className="btn btn-primary">
                      Load into app →
                    </button>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          {error && <div className="alert alert-error" style={{ margin: '0 0 12px' }}>{error}</div>}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Describe what you'd like to cook… (Enter to send, Shift+Enter for new line)"
              rows={2}
              disabled={streaming}
            />
            <button
              className="chat-send-btn"
              onClick={() => send()}
              disabled={streaming || !input.trim()}
            >
              {streaming ? (
                <span className="chat-send-spinner" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
