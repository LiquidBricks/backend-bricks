import React, { useEffect, useState } from 'react'
import ComponentListItem from '../components/ComponentListItem.jsx'
import { useParams } from 'react-router-dom'

export default function Session() {
  const { id } = useParams()
  const [components, setComponents] = useState([])
  const [attached, setAttached] = useState([])
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')

  async function fetchComponents() {
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `query { components(first: 100) { edges { node { name hash } } } }` })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      const items = json.data?.components?.edges?.map(e => e.node) ?? []
      setComponents(items)
    } catch (e) {
      setError(e.message)
    }
  }

  async function addComponent(componentId) {
    setAdding(componentId)
    setError('')
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($sid:String,$cid:String){ sessionAddComponent(sessionId:$sid, componentId:$cid) }`,
          variables: { sid: id, cid: componentId }
        })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      await fetchSession()
    } catch (e) {
      setError(e.message)
    } finally {
      setAdding('')
    }
  }

  async function fetchSession() {
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `query($id:String){ session(id:$id){ id components { edges { node } totalCount } } }`, variables: { id } })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      const items = json.data?.session?.components?.edges?.map(e => e.node) ?? []
      setAttached(items)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchComponents(); fetchSession() }, [])

  return (
    <section>
      <h1>Your on session: {id}</h1>

      <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 6, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Current Components</h2>
        <ul>
          {attached.map(cid => (
            <ComponentListItem key={cid} id={cid} />
          ))}
          {attached.length === 0 && <li>No components attached.</li>}
        </ul>
      </div>

      <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 6, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add Component</h2>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        <ul>
          {components.map(c => (
            <li key={c.hash} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ minWidth: 360, display: 'inline-block' }}>{c.hash}</code>
              <button
                onClick={() => addComponent(c.hash)}
                disabled={adding === c.hash || attached.includes(c.hash)}
                title={attached.includes(c.hash) ? 'Already added to session' : 'Add to session'}
              >+
              </button>
            </li>
          ))}
          {components.length === 0 && <li>No components found.</li>}
        </ul>
      </div>
    </section>
  )
}
