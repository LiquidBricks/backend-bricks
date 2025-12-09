"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import { logClientError, serializeError } from '@/lib/logClientError';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import 'reactflow/dist/style.css';

function useComponentSpec(identifier) {
  const endpoint = useMemo(() => GRAPHQL_ENDPOINT, []);
  const [state, setState] = useState({ status: 'idle', componentSpec: null, error: null });

  useEffect(() => {
    if (!identifier) {
      setState({ status: 'idle', componentSpec: null, error: null });
      return;
    }

    let cancelled = false;

    async function load() {
      setState({ status: 'loading', componentSpec: null, error: null });
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ComponentSpecDetail($hash: String) {
              componentSpec(hash: $hash) {
                hash
                name
                createdAt
                updatedAt
                data {
                  totalCount
                  edges {
                    node {
                      name
                      fnc
                      codeRef {
                        file
                        line
                        column
                        functionName
                        vscodeUrl
                      }
                      dependencies {
                        data
                        task
                        deferred
                      }
                    }
                  }
                }
                tasks {
                  totalCount
                  edges {
                    node {
                      name
                      fnc
                      codeRef {
                        file
                        line
                        column
                        functionName
                        vscodeUrl
                      }
                    }
                  }
                }
                imports {
                  totalCount
                  edges {
                    cursor
                    node {
                      alias
                      name
                      hash
                      createdAt
                      updatedAt
                    }
                  }
                }
                deferred {
                  totalCount
                  edges {
                    node {
                      name
                    }
                  }
                }
              }
            }`,
            variables: { hash: identifier },
          }),
        });

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.errors?.length) {
          throw new Error(payload.errors.map((error) => error.message).join(', '));
        }

        if (!cancelled) {
          setState({ status: 'loaded', componentSpec: payload.data?.componentSpec ?? null, error: null });
        }
      } catch (error) {
        console.error('Failed to load component spec detail:', error);
        logClientError(endpoint, {
          message: 'ComponentSpecDetail fetch failed',
          details: {
            endpoint,
            identifier,
            operationName: 'ComponentSpecDetail',
            error: serializeError(error),
          },
        });
        if (!cancelled) {
          setState({ status: 'error', componentSpec: null, error: error.message ?? 'Failed to load component spec' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [endpoint, identifier]);

  return state;
}

function toVscodeHref(codeRef) {
  if (!codeRef) return null;
  if (codeRef.vscodeUrl) return codeRef.vscodeUrl;
  if (!codeRef.file) return null;
  const normalized = String(codeRef.file).replace(/\\/g, '/');
  const safePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const rawLine = codeRef.line != null ? Number(codeRef.line) : null;
  const rawColumn = codeRef.column != null ? Number(codeRef.column) : null;
  const lineNumber = Number.isFinite(rawLine) ? rawLine : 1;
  const columnNumber = Number.isFinite(rawColumn) ? rawColumn : 1;
  return `vscode://file${safePath}:${lineNumber}:${columnNumber}`;
}

const COLUMN_X = {
  data: -220,
  task: 220,
  external: -460,
};

const KIND_STYLE = {
  data: {
    border: '1px solid #2563eb',
    background: '#0b1220',
    color: '#bfdbfe',
  },
  task: {
    border: '1px solid #22c55e',
    background: '#052e16',
    color: '#bbf7d0',
  },
  external: {
    border: '1px solid #475569',
    background: '#111827',
    color: '#cbd5f5',
  },
};

function toIdentifier(kind, label, fallbackIndex) {
  const safe = typeof label === 'string' && label.length
    ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : `node-${fallbackIndex}`;
  return `${kind}:${safe || `node-${fallbackIndex}`}`;
}

function flattenDependencyValue(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenDependencyValue(item));
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.edges)) {
      return value.edges
        .map((edge) => {
          if (typeof edge === 'string') return edge;
          if (edge && typeof edge.node === 'string') return edge.node;
          if (edge && edge.node && typeof edge.node.name === 'string') return edge.node.name;
          return null;
        })
        .filter(Boolean);
    }
    const fallback = value.name ?? value.hash ?? value.fnc ?? value.id;
    return typeof fallback === 'string' ? [fallback] : [];
  }
  return [];
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function extractDependencyLabels(node) {
  const labels = new Set();

  if (Array.isArray(node?.deps?.edges)) {
    node.deps.edges.forEach((edge) => {
      flattenDependencyValue(edge).forEach((label) => labels.add(label));
    });
  }

  if (node?.dependencies && typeof node.dependencies === 'object') {
    Object.values(node.dependencies).forEach((value) => {
      flattenDependencyValue(value).forEach((label) => labels.add(label));
    });
  }

  return Array.from(labels);
}

function extractDependencyGroups(node) {
  if (!node?.dependencies || typeof node.dependencies !== 'object') {
    const legacy = extractDependencyLabels(node);
    return legacy.length ? { other: legacy } : {};
  }

  return Object.entries(node.dependencies).reduce((groups, [kind, value]) => {
    const labels = flattenDependencyValue(value);
    if (labels.length) groups[kind] = labels;
    return groups;
  }, {});
}

function DependencyGraph({ dataConnection, taskConnection }) {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map();
    const edgesList = [];
    const columnCounts = new Map([
      ['external', 0],
      ['data', 0],
      ['task', 0],
    ]);

    const registerNode = (kind, label, source, indexHint = 0) => {
      const id = toIdentifier(kind, label, columnCounts.get(kind) || indexHint);
      if (nodeMap.has(id)) {
        return id;
      }
      const count = columnCounts.get(kind) ?? 0;
      const position = {
        x: COLUMN_X[kind] ?? 0,
        y: count * 110,
      };
      columnCounts.set(kind, count + 1);
      nodeMap.set(id, {
        id,
        position,
        data: { label, kind, source },
        style: {
          borderRadius: 10,
          padding: '0.5rem 0.75rem',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
          width: 180,
          ...(KIND_STYLE[kind] || KIND_STYLE.external),
        },
      });
      return id;
    };

    const dataEdges = Array.isArray(dataConnection?.edges) ? dataConnection.edges : [];
    const taskEdges = Array.isArray(taskConnection?.edges) ? taskConnection.edges : [];

    dataEdges.forEach(({ node }, index) => {
      const label = node?.name ?? node?.fnc ?? `data-${index + 1}`;
      const nodeId = registerNode('data', label, node, index);
      const deps = extractDependencyLabels(node);
      deps.forEach((depLabel, depIndex) => {
        const matchInData = dataEdges.find(({ node: candidate }) => (candidate?.name ?? candidate?.fnc) === depLabel);
        const matchInTask = taskEdges.find(({ node: candidate }) => (candidate?.name ?? candidate?.fnc) === depLabel);

        let sourceId;
        if (matchInData) {
          sourceId = registerNode('data', depLabel, matchInData.node, depIndex);
        } else if (matchInTask) {
          sourceId = registerNode('task', depLabel, matchInTask.node, depIndex);
        } else {
          sourceId = registerNode('external', depLabel, { name: depLabel }, depIndex);
        }

        edgesList.push({
          id: `${sourceId}->${nodeId}-${depIndex}`,
          source: sourceId,
          target: nodeId,
          animated: false,
        });
      });
    });

    taskEdges.forEach(({ node }, index) => {
      const label = node?.name ?? node?.fnc ?? `task-${index + 1}`;
      const nodeId = registerNode('task', label, node, index);
      const deps = extractDependencyLabels(node);
      deps.forEach((depLabel, depIndex) => {
        let sourceKind = 'external';
        const matchingDataId = Array.from(nodeMap.keys()).find((id) => id.startsWith('data:') && nodeMap.get(id)?.data?.label === depLabel);
        const matchingTaskId = Array.from(nodeMap.keys()).find((id) => id.startsWith('task:') && nodeMap.get(id)?.data?.label === depLabel);
        let sourceId = matchingDataId || matchingTaskId;
        if (sourceId) {
          sourceKind = sourceId.split(':')[0];
        } else {
          sourceId = registerNode('external', depLabel, { name: depLabel }, depIndex + index);
        }

        // Move known dependencies into data/task columns if discovered later
        if (!matchingDataId && !matchingTaskId && (dataEdges.length || taskEdges.length)) {
          const matchInData = dataEdges.find(({ node: candidate }) => (candidate?.name ?? candidate?.fnc) === depLabel);
          const matchInTask = taskEdges.find(({ node: candidate }) => (candidate?.name ?? candidate?.fnc) === depLabel);
          if (matchInData) {
            sourceId = registerNode('data', depLabel, matchInData.node, depIndex);
          } else if (matchInTask) {
            sourceId = registerNode('task', depLabel, matchInTask.node, depIndex);
          } else {
            sourceId = registerNode(sourceKind, depLabel, { name: depLabel }, depIndex);
          }
        }

        edgesList.push({
          id: `${sourceId}->${nodeId}-${depIndex}-${index}`,
          source: sourceId,
          target: nodeId,
          animated: false,
        });
      });
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgesList };
  }, [dataConnection, taskConnection]);

  if (!nodes.length) {
    return null;
  }

  return (
    <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#0b1220', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Dependency Graph</h2>
      </header>
      <div style={{ height: 420 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.4 }}
            panOnScroll
            nodesDraggable={false}
            nodesFocusable={false}
            zoomOnScroll
            panOnDrag
            defaultEdgeOptions={{ markerEnd: { type: 'arrowclosed', width: 20, height: 20 } }}
          >
            <Background color="#1e293b" gap={24} />
            <Controls position="top-left" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );
}

function renderNodeList(title, connection) {
  const edges = connection?.edges ?? [];

  return (
    <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          {title}
          <span style={{ marginLeft: 8, fontSize: '0.9rem', color: '#94a3b8' }}>
            ({connection?.totalCount ?? edges.length})
          </span>
        </h2>
      </header>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {edges.length === 0 && (
          <li style={{ padding: '1.25rem 1.5rem', color: '#94a3b8' }}>No entries.</li>
        )}
        {edges.map((edge, index) => {
          const node = edge?.node ?? {};
          const key = node.name ?? node.fnc ?? `${title}-node-${index}`;
          const href = toVscodeHref(node.codeRef);
          const locationLabel = node.codeRef?.file
            ? `${node.codeRef.file}${node.codeRef.line ? `:${node.codeRef.line}` : ''}${node.codeRef.column ? `:${node.codeRef.column}` : ''}`
            : null;
          const dependencyGroups = extractDependencyGroups(node);
          const dependencyCount = Object.values(dependencyGroups).reduce((count, items) => count + items.length, 0);

          return (
            <li
              key={key}
              style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <strong>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: '#a5b4fc', textDecoration: 'underline' }}>
                      {node.name ?? 'Unnamed node'}
                    </a>
                  ) : (
                    node.name ?? 'Unnamed node'
                  )}
                </strong>
                {dependencyCount > 0 ? (
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    deps: {dependencyCount}
                  </span>
                ) : null}
              </div>
              {locationLabel && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{locationLabel}</div>
              )}
              {node.fnc && (
                <pre style={{ margin: 0, padding: '0.75rem', background: '#0f172a', borderRadius: 8, overflowX: 'auto', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {node.fnc}
                </pre>
              )}
              {dependencyCount > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: '#cbd5f5' }}>
                  {Object.entries(dependencyGroups).map(([kind, items]) => (
                    <div key={`${key}-${kind}`}>
                      <span style={{ textTransform: 'capitalize', color: '#94a3b8' }}>{kind}:</span> {items.join(', ')}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function renderImportsList(connection) {
  const edges = connection?.edges ?? [];

  return (
    <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          Imported Components
          <span style={{ marginLeft: 8, fontSize: '0.9rem', color: '#94a3b8' }}>
            ({connection?.totalCount ?? edges.length})
          </span>
        </h2>
      </header>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {edges.length === 0 && (
          <li style={{ padding: '1.25rem 1.5rem', color: '#94a3b8' }}>No imports.</li>
        )}
        {edges.map((edge, index) => {
          const node = edge?.node ?? {};
          const alias = node.alias;
          const key = edge?.cursor
            ?? (alias ? `${alias}-${node.hash ?? node.name ?? index}` : node.hash ?? node.name ?? `import-node-${index}`);
          const href = node.hash ? `/component-specs/${encodeURIComponent(node.hash)}` : null;
          const created = formatDateTime(node.createdAt);
          const updated = formatDateTime(node.updatedAt);

          return (
            <li
              key={key}
              style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <strong>
                  {href ? (
                    <Link href={href} style={{ color: '#a5b4fc', textDecoration: 'underline' }}>
                      {node.name ?? 'Unnamed component'}
                    </Link>
                  ) : (
                    node.name ?? 'Unnamed component'
                  )}
                </strong>
                {node.hash ? (
                  <code style={{ background: '#0f172a', padding: '0.2rem 0.4rem', borderRadius: 6, color: '#e2e8f0' }}>
                    {node.hash}
                  </code>
                ) : null}
              </div>
              {alias ? (
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  Alias: <code style={{ background: '#0f172a', padding: '0.15rem 0.35rem', borderRadius: 6 }}>{alias}</code>
                </div>
              ) : null}
              {(created || updated) && (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {created ? <span>Created: {created}</span> : null}
                  {updated ? <span style={{ marginLeft: created ? '0.75rem' : 0 }}>Updated: {updated}</span> : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ComponentSpecDetailPage({ params }) {
  const identifier = params?.componentSpecId;
  const { status, componentSpec, error } = useComponentSpec(identifier);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleCreateInstance = useCallback(async () => {
    const componentHash = componentSpec?.hash;
    if (!componentHash) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ComponentSpecCreateInstance($componentHash: String!) {
            componentSpecCreateInstance(componentHash: $componentHash) {
              instanceId
            }
          }`,
          variables: { componentHash },
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      if (payload.errors?.length) {
        throw new Error(payload.errors.map((err) => err.message).join(', '));
      }

      const instanceId = payload.data?.componentSpecCreateInstance?.instanceId;
      if (!instanceId) throw new Error('Instance creation did not return an ID');
      router.push(`/component-instances/${encodeURIComponent(instanceId)}`);
    } catch (err) {
      console.error('Failed to create component instance:', err);
      logClientError(GRAPHQL_ENDPOINT, {
        message: 'ComponentSpecCreateInstance mutation failed',
        details: {
          componentHash,
          error: serializeError(err),
        },
      });
      setCreateError(err.message ?? 'Failed to create component instance');
    } finally {
      setCreating(false);
    }
  }, [componentSpec?.hash, router]);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Link href="/component-specs" style={{ color: '#a5b4fc' }}>&larr; Back to component specs</Link>

      {status === 'loading' && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>Loading component spec…</p>
        </section>
      )}

      {status === 'error' && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <h1 style={{ marginTop: 0 }}>Unable to load component spec</h1>
          <p style={{ color: '#fca5a5' }}>{error}</p>
        </section>
      )}

      {status === 'loaded' && !componentSpec && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <h1 style={{ marginTop: 0 }}>Component spec not found</h1>
          <p style={{ color: '#fca5a5' }}>We could not load component spec details for identifier “{identifier}”.</p>
        </section>
      )}

      {status === 'loaded' && componentSpec && (
        <>
          <header style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '2.5rem' }}>{componentSpec.name ?? 'Unnamed component spec'}</h1>
              <button
                type="button"
                onClick={handleCreateInstance}
                disabled={creating || !componentSpec?.hash}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #4338ca',
                  background: creating ? '#312e81' : '#4338ca',
                  color: '#e2e8f0',
                  cursor: creating || !componentSpec?.hash ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Creating…' : 'Create Instance'}
              </button>
              <Link
                href={`/component-specs/${encodeURIComponent(componentSpec.hash ?? identifier ?? '')}/instances`}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  color: '#cbd5f5',
                  background: '#1e293b',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                }}
              >
                View Instances
              </Link>
            </div>
            <div style={{ color: '#cbd5f5', fontSize: '1rem' }}>
              <span>Hash: <code>{componentSpec.hash}</code></span>
              {componentSpec.createdAt && (
                <span style={{ marginLeft: '1rem' }}>Created: {new Date(componentSpec.createdAt).toLocaleString()}</span>
              )}
              {componentSpec.updatedAt && (
                <span style={{ marginLeft: '1rem' }}>Updated: {new Date(componentSpec.updatedAt).toLocaleString()}</span>
              )}
            </div>
            {createError && (
              <div style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{createError}</div>
            )}
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <DependencyGraph dataConnection={componentSpec.data} taskConnection={componentSpec.tasks} />
            {renderImportsList(componentSpec.imports)}
            {renderNodeList('Data Nodes', componentSpec.data)}
            {renderNodeList('Task Nodes', componentSpec.tasks)}
          </div>
        </>
      )}
    </main>
  );
}
