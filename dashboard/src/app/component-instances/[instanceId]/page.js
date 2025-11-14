"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logClientError, serializeError } from '@/lib/logClientError';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

function useComponentSpecInstance(instanceId) {
  const endpoint = useMemo(() => GRAPHQL_ENDPOINT, []);
  const [state, setState] = useState({ status: 'idle', instance: null, error: null });

  useEffect(() => {
    if (!instanceId) {
      setState({ status: 'idle', instance: null, error: null });
      return;
    }

    let cancelled = false;

    async function load() {
      setState({ status: 'loading', instance: null, error: null });
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ComponentSpecInstanceDetail($instanceId: String) {
              componentSpecInstance(instanceId: $instanceId) {
                instanceId
                createdAt
                updatedAt
                componentSpec {
                  name
                  hash
                }
                data {
                  totalCount
                  edges {
                    node {
                      name
                      fnc
                      stateId
                      status
                      result
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
                      stateId
                      status
                      result
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
              }
            }`,
            variables: { instanceId },
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
          setState({ status: 'loaded', instance: payload.data?.componentSpecInstance ?? null, error: null });
        }
      } catch (error) {
        console.error('Failed to load component spec instance:', error);
        logClientError(GRAPHQL_ENDPOINT, {
          message: 'ComponentSpecInstanceDetail fetch failed',
          details: {
            endpoint,
            instanceId,
            operationName: 'ComponentSpecInstanceDetail',
            error: serializeError(error),
          },
        });
        if (!cancelled) {
          setState({ status: 'error', instance: null, error: error.message ?? 'Failed to load component instance' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [endpoint, instanceId]);

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

function getDependencyGroups(node) {
  if (node?.dependencies && typeof node.dependencies === 'object') {
    return Object.entries(node.dependencies).reduce((groups, [kind, value]) => {
      const labels = flattenDependencyValue(value);
      if (labels.length) groups[kind] = labels;
      return groups;
    }, {});
  }

  if (Array.isArray(node?.deps?.edges)) {
    const legacy = flattenDependencyValue({ edges: node.deps.edges });
    return legacy.length ? { other: legacy } : {};
  }

  return {};
}

function InstanceStateList({
  title,
  connection,
  deferredInputs,
  onDeferredInputChange,
  onDeferredSubmit,
  submitState,
}) {
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
          const rawKey = node?.stateId ?? node?.id ?? node?.name ?? `${title}-node-${index}`;
          const nodeKey = String(rawKey);
          const href = toVscodeHref(node.codeRef);
          const locationLabel = node.codeRef?.file
            ? `${node.codeRef.file}${node.codeRef.line ? `:${node.codeRef.line}` : ''}${node.codeRef.column ? `:${node.codeRef.column}` : ''}`
            : null;
          const logs = Array.isArray(node.logs) ? node.logs : [];
          const dependencyGroups = getDependencyGroups(node);
          const depsList = Object.values(dependencyGroups).flat();
          const isDeferredStatus = (node.status ?? '').toLowerCase() === 'deferred';
          const deferredGroup = dependencyGroups.deferred ?? [];
          const isDeferredDependency = deferredGroup.length > 0 || depsList.some((dep) => dep?.toLowerCase?.().startsWith('deferred:'));
          const isDeferred = isDeferredStatus || isDeferredDependency;
          const submitInfo = submitState[nodeKey] ?? { status: 'idle', message: null };
          const textareaValue = deferredInputs[nodeKey] ?? '';
          const rawResult = node.result;
          const hasResultValue = typeof rawResult === 'string'
            ? rawResult.trim().length > 0
            : rawResult != null && rawResult !== '';
          const resultDisplay = hasResultValue ? rawResult : '—';

          return (
            <li
              key={nodeKey}
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: 6,
                      background: isDeferred ? 'rgba(234, 179, 8, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: isDeferred ? '#facc15' : '#94a3b8',
                      textTransform: 'capitalize',
                    }}
                  >
                    {(node.status ?? 'unknown').toString()}
                  </span>
                  {isDeferred && (
                    <span style={{ fontSize: '0.75rem', color: '#facc15' }}>Deferred input required</span>
                  )}
                </div>
              </div>
              {locationLabel && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{locationLabel}</div>
              )}
              {node.fnc && (
                <pre style={{ margin: 0, padding: '0.75rem', background: '#0f172a', borderRadius: 8, overflowX: 'auto', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {node.fnc}
                </pre>
              )}
              <div style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>
                <strong>Result:</strong> <span style={{ marginLeft: '0.35rem' }}>{resultDisplay}</span>
              </div>
              {logs.length > 0 && (
                <details style={{ background: '#0f172a', borderRadius: 8, padding: '0.75rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Logs ({logs.length})</summary>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', fontSize: '0.85rem', color: '#cbd5f5' }}>
                    {logs.map((entry, idx) => (
                      <li key={`${nodeKey}-log-${idx}`}>{entry}</li>
                    ))}
                  </ul>
                </details>
              )}

              {depsList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {Object.entries(dependencyGroups).map(([kind, items]) => (
                    <div key={`${nodeKey}-${kind}`}>
                      <span style={{ textTransform: 'capitalize' }}>{kind}:</span> {items.join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {isDeferred && (node.stateId || node.id) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#cbd5f5' }}>
                    Provide JSON data
                  </label>
                  <textarea
                    value={textareaValue}
                    onChange={(event) => onDeferredInputChange(nodeKey, event.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      border: '1px solid #334155',
                      background: '#020617',
                      color: '#e2e8f0',
                      padding: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                    placeholder='{"example": true}'
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onDeferredSubmit(nodeKey, node)}
                      disabled={submitInfo.status === 'loading' || (!node.stateId && !node.id)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 999,
                        border: '1px solid #22c55e',
                        background: submitInfo.status === 'loading' ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.15)',
                        color: '#22c55e',
                        fontWeight: 600,
                        cursor: submitInfo.status === 'loading' || (!node.stateId && !node.id) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {submitInfo.status === 'loading' ? 'Submitting…' : 'Submit Data'}
                    </button>
                  {submitInfo.status === 'success' && (
                    <span style={{ fontSize: '0.8rem', color: '#34d399' }}>{submitInfo.message ?? 'Data provided'}</span>
                  )}
                  {submitInfo.status === 'error' && (
                    <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{submitInfo.message ?? 'Failed to submit'}</span>
                  )}
                </div>
                {!node.stateId && !node.id && (
                  <div style={{ fontSize: '0.75rem', color: '#facc15' }}>
                    Deferred submission unavailable: missing state identifier.
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
      </ul>
    </section>
  );
}

export default function ComponentSpecInstanceDetailPage({ params }) {
  const instanceId = params?.instanceId;
  const { status, instance, error } = useComponentSpecInstance(instanceId);
  const [startStatus, setStartStatus] = useState('idle');
  const [startMessage, setStartMessage] = useState('');
  const [startError, setStartError] = useState(null);
  const [deferredInputs, setDeferredInputs] = useState({});
  const [deferredSubmitState, setDeferredSubmitState] = useState({});
  const specInfo = instance?.componentSpec ?? null;

  const handleStartInstance = useCallback(async () => {
    if (!instanceId) return;
    setStartStatus('loading');
    setStartMessage('');
    setStartError(null);
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ComponentInstanceStart($instanceId: String!) {
            componentInstanceStart(instanceId: $instanceId) {
              ok
            }
          }`,
          variables: { instanceId },
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      if (payload.errors?.length) {
        throw new Error(payload.errors.map((err) => err.message).join(', '));
      }

      const ok = payload.data?.componentInstanceStart?.ok === true;
      if (!ok) {
        throw new Error('Start command not acknowledged');
      }

      setStartStatus('success');
      setStartMessage('Start command sent');
    } catch (err) {
      console.error('Failed to start component instance:', err);
      setStartStatus('error');
      setStartError(err.message ?? 'Failed to start component instance');
      logClientError(GRAPHQL_ENDPOINT, {
        message: 'ComponentInstanceStart mutation failed',
        details: {
          instanceId,
          error: serializeError(err),
        },
      });
    }
  }, [instanceId]);

  const handleDeferredInputChange = useCallback((nodeId, value) => {
    setDeferredInputs((prev) => ({ ...prev, [nodeId]: value }));
    setDeferredSubmitState((prev) => {
      const next = { ...prev };
      if (next[nodeId]?.status === 'error') {
        next[nodeId] = { status: 'idle', message: null };
      }
      return next;
    });
  }, []);

  const handleDeferredSubmit = useCallback(async (nodeKey, node) => {
    if (!instanceId) return;
    const rawInput = (deferredInputs[nodeKey] ?? '').trim();
    if (!rawInput) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: 'Enter JSON before submitting' },
      }));
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawInput);
    } catch (err) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: err.message ?? 'Invalid JSON' },
      }));
      return;
    }

    setDeferredSubmitState((prev) => ({
      ...prev,
      [nodeKey]: { status: 'loading', message: null },
    }));

    try {
      const stateId = node?.stateId ?? node?.id;
      if (!stateId) {
        throw new Error('Node state id missing');
      }

      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ComponentInstanceProvideData($instanceId: String!, $stateId: String!, $payload: String!) {
            componentInstanceProvideData(instanceId: $instanceId, stateId: $stateId, payload: $payload) {
              ok
            }
          }`,
          variables: {
            instanceId,
            stateId,
            payload: JSON.stringify(parsedPayload),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      if (payload.errors?.length) {
        throw new Error(payload.errors.map((err) => err.message).join(', '));
      }

      const ok = payload.data?.componentInstanceProvideData?.ok === true;
      if (!ok) {
        throw new Error('Provide data command not acknowledged');
      }

      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'success', message: 'Data submitted' },
      }));
      setDeferredInputs((prev) => ({ ...prev, [nodeKey]: '' }));
    } catch (err) {
      console.error('Failed to provide data:', err);
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: err.message ?? 'Failed to submit' },
      }));
      logClientError(GRAPHQL_ENDPOINT, {
        message: 'ComponentInstanceProvideData mutation failed',
        details: {
          instanceId,
          stateId: node?.stateId ?? node?.id,
          error: serializeError(err),
        },
      });
    }
  }, [deferredInputs, instanceId]);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Link href="/component-instances" style={{ color: '#a5b4fc' }}>&larr; Back to component instances</Link>

      {status === 'loading' && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>Loading component instance…</p>
        </section>
      )}

      {status === 'error' && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <h1 style={{ marginTop: 0 }}>Unable to load component instance</h1>
          <p style={{ color: '#fca5a5' }}>{error}</p>
        </section>
      )}

      {status === 'loaded' && !instance && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <h1 style={{ marginTop: 0 }}>Component instance not found</h1>
          <p style={{ color: '#fca5a5' }}>We could not load details for instance “{instanceId}”.</p>
        </section>
      )}

      {status === 'loaded' && instance && (
        <>
          <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Instance {instance.instanceId}</h1>
            <div style={{ color: '#cbd5f5', fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>Component Spec: <code>{specInfo?.name ?? 'Unnamed component spec'}</code></span>
              <span>Hash: <code>{specInfo?.hash ?? '—'}</code></span>
              <span>Created: {instance.createdAt ? new Date(instance.createdAt).toLocaleString() : '—'}</span>
              <span>Updated: {instance.updatedAt ? new Date(instance.updatedAt).toLocaleString() : '—'}</span>
            </div>
            {specInfo?.hash && (
              <div>
                <Link href={`/component-specs/${encodeURIComponent(specInfo.hash)}`} style={{ color: '#a5b4fc', textDecoration: 'underline' }}>
                  View Component Spec
                </Link>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleStartInstance}
                disabled={startStatus === 'loading'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: 999,
                  border: '1px solid #1e293b',
                  background: '#0f172a',
                  color: '#22c55e',
                  padding: '0.45rem 0.9rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: startStatus === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: startStatus === 'loading' ? 0.6 : 1,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1rem' }}>▶</span>
                {startStatus === 'loading' ? 'Starting…' : 'Start Component'}
              </button>
              {startStatus === 'success' && (
                <span style={{ fontSize: '0.85rem', color: '#34d399' }}>{startMessage}</span>
              )}
              {startStatus === 'error' && (
                <span style={{ fontSize: '0.85rem', color: '#f87171' }}>{startError}</span>
              )}
            </div>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <InstanceStateList
              title="Data Nodes"
              connection={instance.data}
              deferredInputs={deferredInputs}
              onDeferredInputChange={handleDeferredInputChange}
              onDeferredSubmit={handleDeferredSubmit}
              submitState={deferredSubmitState}
            />
            <InstanceStateList
              title="Task Nodes"
              connection={instance.tasks}
              deferredInputs={deferredInputs}
              onDeferredInputChange={handleDeferredInputChange}
              onDeferredSubmit={handleDeferredSubmit}
              submitState={deferredSubmitState}
            />
          </div>
        </>
      )}
    </main>
  );
}
