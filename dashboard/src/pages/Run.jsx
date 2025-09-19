import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Sessions() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [sessionID, setSessionID] = useState('')
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState([])

  async function createSession() {
    setCreating(true)
    setError('')
    setSessionID('')
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `mutation { sessionCreate }` })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      const id = json.data?.sessionCreate ?? ''
      setSessionID(id)
      await fetchSessions()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function deleteSession(id) {
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `mutation($id:String){ sessionDelete(sessionId:$id) }`, variables: { id } })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      await fetchSessions()
    } catch (e) {
      console.error(e)
      setError(e.message)
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `query { sessions(first: 100) { edges { node { id } } } }` })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      const items = json.data?.sessions?.edges?.map(e => e.node) ?? []
      setSessions(items)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchSessions() }, [])

  return (
    <section>
      <h1>Sessions</h1>
      <button onClick={createSession} disabled={creating}>
        {creating ? 'Creating…' : 'Create New Session'}
      </button>
      {sessionID && (
        <div style={{ marginTop: 12 }}>
          Created session: <code>{sessionID}</code>
        </div>
      )}
      {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        <h2>Existing Sessions</h2>
        <ul>
          {sessions.map(s => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/session/${s.id}`)}>
                <code>{s.id}</code> {s.createdAt ? `— ${new Date(s.createdAt).toLocaleString()}` : ''}
              </span>
              <button
                title="Delete session"
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                style={{ color: 'white', background: '#c62828', border: 'none', padding: '4px 8px', borderRadius: 4 }}
              >Delete</button>
            </li>
          ))}
          {sessions.length === 0 && <li>No sessions found.</li>}
        </ul>
      </div>
    </section>
  )
}
