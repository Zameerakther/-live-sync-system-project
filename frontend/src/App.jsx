import { useEffect, useState } from 'react'
import './App.css'
import { socket } from './socket'

const ITEM_TYPES = ['info', 'success', 'warning', 'error']

export default function App() {
  const [items, setItems] = useState([])
  const [connected, setConnected] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState('info')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadInitialData() {
      try {
        const res = await fetch('/api/live-data')
        if (res.ok) {
          const data = await res.json()
          if (!ignore) setItems(data)
        }
      } catch (err) {
        console.error('Failed to load initial data', err)
      }
    }

    loadInitialData()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('live-data:updated', (data) => setItems([...data]))

    return () => {
      ignore = true
      socket.off('connect')
      socket.off('disconnect')
      socket.off('live-data:updated')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    try {
      const res = await fetch('/api/live-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type }),
      })

      if (res.ok) {
        setTitle('')
        setContent('')
        setType('info')
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to publish')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/live-data/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to delete')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Live Sync System</h1>
          <p>Real-time monitor with admin portal</p>
        </div>
        <div className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Live' : 'Offline'}
        </div>
      </header>

      <section className="admin-panel">
        <h2>Admin Portal</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit">Publish</button>
          {error && <span className="form-error">{error}</span>}
        </form>
      </section>

      <section className="monitor">
        <h2>Live Monitor</h2>
        {items.length === 0 ? (
          <p className="empty">No live data yet.</p>
        ) : (
          <ul className="card-list">
            {items.map((item) => (
              <li key={item.id} className={`card ${item.type}`}>
                <div className="card-header">
                  <h3>{item.title}</h3>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(item.id)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
                <p>{item.content}</p>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
