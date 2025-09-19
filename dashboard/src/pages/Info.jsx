import React, { useEffect, useState } from 'react'

export default function Info() {
  const [componentId, setComponentId] = useState('')
  const [component, setComponent] = useState(null)
  const [error, setError] = useState(null)
  const [list, setList] = useState([])
  const [loadingList, setLoadingList] = useState(false)

  async function fetchComponent(id) {
    setError(null)
    setComponent(null)
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query($id:String){
            component(id:$id){
              name
              hash
              data { edges { node { name deps { edges { node } totalCount } fnc } } }
              tasks { edges { node { name deps { edges { node } totalCount } fnc } } }
            }
          }`,
          variables: { id }
        })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      setComponent(json.data?.component ?? null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function fetchComponents() {
    setLoadingList(true)
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `query { components(first: 100) { edges { node { name hash } } } }` })
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
      const items = json.data?.components?.edges?.map(e => e.node) ?? []
      setList(items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { fetchComponents() }, [])

  return (
    <section>
      <h1>Fullflow Dashboard</h1>
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0 }}>Components</h2>
          <button onClick={fetchComponents} disabled={loadingList}>{loadingList ? 'Loading…' : 'Refresh'}</button>
        </div>
        <ul>
          {list.map((c) => (
            <li key={c.hash} style={{ cursor: 'pointer' }} onClick={() => { setComponentId(c.hash); fetchComponent(c.hash) }}>
              <b>{c.name}</b>
              <div style={{ fontSize: 12, color: '#666' }}>{c.hash}</div>
            </li>
          ))}
          {(!loadingList && list.length === 0) && <li>No components found.</li>}
        </ul>
      </section>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          value={componentId}
          onChange={(e) => setComponentId(e.target.value)}
          placeholder="Component ID or Hash"
          style={{ padding: 8, minWidth: 320 }}
        />
        <button onClick={() => componentId && fetchComponent(componentId)}>Load</button>
      </div>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {component && (
        <div style={{ marginTop: 12 }}>
          <h2>{component.name}</h2>
          <div><b>Hash:</b> {component.hash}</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <b>Data Nodes</b>
              <ul>
                {(component.data?.edges ?? []).map(({ node: n }) => (
                  <li key={n.name}>
                    <div><code>{n.name}</code></div>
                    {(n.deps?.edges?.length ?? 0) ? (
                      <ul>
                        {n.deps.edges.map((e) => (
                          <li key={`${n.name}-${e.node}`}>{e.node}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b>Task Nodes</b>
              <ul>
                {(component.tasks?.edges ?? []).map(({ node: n }) => (
                  <li key={n.name}>
                    <div><code>{n.name}</code></div>
                    {(n.deps?.edges?.length ?? 0) ? (
                      <ul>
                        {n.deps.edges.map((e) => (
                          <li key={`${n.name}-${e.node}`}>{e.node}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
        </div>
      )}
    </section>
  )
}
