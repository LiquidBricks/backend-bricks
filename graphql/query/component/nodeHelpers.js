export function resolveNodeId(source) {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'object') {
    if (typeof source.id === 'string') return source.id;
    if (typeof source.nodeId === 'string') return source.nodeId;
  }
  return null;
}

export function getStateField(source, key) {
  if (!source || typeof source !== 'object') return null;
  if (source[key] != null) return source[key];
  if (source.state && source.state[key] != null) return source.state[key];
  return null;
}

export async function fetchVertexProp(source, prop, g) {
  const nodeId = resolveNodeId(source);
  if (!nodeId || !g) return null;
  const rows = await g.V(nodeId).valueMap(prop);
  const first = Array.isArray(rows) ? rows[0] : null;
  const raw = first ? first[prop] : null;
  if (Array.isArray(raw)) {
    return raw.length ? raw[0] ?? null : null;
  }
  return raw ?? null;
}
