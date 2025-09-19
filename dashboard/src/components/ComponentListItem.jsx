import React, { useEffect, useState } from 'react'

export default function ComponentListItem({ id, right = null, onClick }) {
  const [component, setComponent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchComponent() {
      setLoading(true)
      setError(null)
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
        if (!cancelled) setComponent(json.data?.component ?? null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) fetchComponent()
    return () => { cancelled = true }
  }, [id])

  const name = component?.name
  const dataNodes = component?.data?.edges?.map(e => e.node) ?? []
  const taskNodes = component?.tasks?.edges?.map(e => e.node) ?? []

  return (
    <li style={{ display: 'block', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          {name ? <b>{name}</b> : <span style={{ color: '#999' }}>{loading ? 'Loading…' : 'Unnamed Component'}</span>}
          <div style={{ fontSize: 12, color: '#666' }}><code>{id}</code></div>
        </div>
        {right}
      </div>
      {error && <div style={{ color: 'crimson', marginTop: 4 }}>{error}</div>}
      {component && (
        <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
          <div>
            <b>Data Nodes</b>
            <ul>
              {dataNodes.map((n) => (
                <li key={`data-${n.name}`}>
                  <div><code>{n.name}</code></div>
                  {(n.deps?.edges?.length ?? 0) ? (
                    <ul>
                      {n.deps.edges.map((e) => (
                        <li key={`data-dep-${n.name}-${e.node}`}>{e.node}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
              {dataNodes.length === 0 && <li style={{ color: '#666' }}>None</li>}
            </ul>
          </div>
          <div>
            <b>Task Nodes</b>
            <ul>
              {taskNodes.map((n) => (
                <li key={`task-${n.name}`}>
                  <div><code>{n.name}</code></div>
                  {(n.deps?.edges?.length ?? 0) ? (
                    <ul>
                      {n.deps.edges.map((e) => (
                        <li key={`task-dep-${n.name}-${e.node}`}>{e.node}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
              {taskNodes.length === 0 && <li style={{ color: '#666' }}>None</li>}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

