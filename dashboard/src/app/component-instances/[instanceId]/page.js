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
                state
                imports {
                  totalCount
                  edges {
                    node {
                      alias
                      instanceId
                      createdAt
                      updatedAt
                      state
                      componentSpec {
                        name
                        hash
                      }
                    }
                  }
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

function InstanceImportsList({ connection }) {
  const edges = connection?.edges ?? [];
  const totalCount = connection?.totalCount ?? edges.length;

  return (
    <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          Imported Components
          <span style={{ marginLeft: 8, fontSize: '0.9rem', color: '#94a3b8' }}>
            ({totalCount})
          </span>
        </h2>
      </header>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {edges.length === 0 && (
          <li style={{ padding: '1.25rem 1.5rem', color: '#94a3b8' }}>No imports.</li>
        )}
        {edges.map((edge, index) => {
          const node = edge?.node ?? {};
          const spec = node.componentSpec ?? {};
          const alias = (node.alias ?? spec.name ?? 'Imported component').toString();
          const instanceId = node.instanceId ?? '';
          const nodeKey = instanceId || `${alias}-${index}`;
          const stateLabel = (node.state ?? 'unknown').toString();
          const stateKey = stateLabel.toLowerCase();
          const stateBadgeStyle = {
            fontSize: '0.85rem',
            padding: '0.1rem 0.35rem',
            borderRadius: 6,
            background: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            textTransform: 'capitalize',
            border: '1px solid #1e293b',
          };
          if (stateKey === 'running') {
            stateBadgeStyle.background = 'rgba(34, 197, 94, 0.15)';
            stateBadgeStyle.color = '#22c55e';
            stateBadgeStyle.border = '1px solid rgba(34, 197, 94, 0.4)';
          } else if (stateKey === 'starting' || stateKey === 'pending') {
            stateBadgeStyle.background = 'rgba(59, 130, 246, 0.16)';
            stateBadgeStyle.color = '#93c5fd';
            stateBadgeStyle.border = '1px solid rgba(59, 130, 246, 0.45)';
          } else if (stateKey === 'error' || stateKey === 'failed' || stateKey === 'stopped') {
            stateBadgeStyle.background = 'rgba(248, 113, 113, 0.15)';
            stateBadgeStyle.color = '#f87171';
            stateBadgeStyle.border = '1px solid rgba(248, 113, 113, 0.4)';
          }
          const createdLabel = node.createdAt ? new Date(node.createdAt).toLocaleString() : null;
          const updatedLabel = node.updatedAt ? new Date(node.updatedAt).toLocaleString() : null;

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                  <strong style={{ fontSize: '1rem' }}>{alias}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#cbd5f5' }}>
                    Component: <span style={{ fontWeight: 600 }}>{spec.name ?? 'Unnamed component'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Hash: <code>{spec.hash ?? '—'}</code>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Instance ID: <code>{instanceId || '—'}</code>
                  </div>
                  {(createdLabel || updatedLabel) && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {createdLabel && <span>Created: {createdLabel}</span>}
                      {updatedLabel && <span>Updated: {updatedLabel}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <span style={stateBadgeStyle}>{stateLabel}</span>
                  {instanceId ? (
                    <Link
                      href={`/component-instances/${encodeURIComponent(instanceId)}`}
                      style={{
                        padding: '0.4rem 0.9rem',
                        borderRadius: 999,
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#a5b4fc',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      View instance
                    </Link>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#f87171' }}>Instance id unavailable</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InstanceStateList({
  title,
  connection,
  deferredInputs,
  onDeferredInputChange,
  onDeferredSubmit,
  submitState,
  providePhases,
  onProvideOpen,
  onProvideLock,
  onProvideReset,
  onClearDeferredInput,
}) {
  const edges = connection?.edges ?? [];
  const isDataList = title?.toLowerCase?.().includes('data');

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
          const statusLabel = (node.status ?? 'unknown').toString();
          const statusKey = statusLabel.toLowerCase();
          const hasProvidedData = statusKey === 'provided' || hasResultValue;
          const statusBadgeStyle = {
            fontSize: '0.85rem',
            padding: '0.1rem 0.35rem',
            borderRadius: 6,
            background: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            textTransform: 'capitalize',
            border: '1px solid #1e293b',
          };

          if (statusKey === 'provided') {
            statusBadgeStyle.background = 'rgba(34, 197, 94, 0.15)';
            statusBadgeStyle.color = '#22c55e';
            statusBadgeStyle.border = '1px solid rgba(34, 197, 94, 0.4)';
          } else if (statusKey === 'waiting') {
            statusBadgeStyle.background = 'rgba(59, 130, 246, 0.16)';
            statusBadgeStyle.color = '#93c5fd';
            statusBadgeStyle.border = '1px solid rgba(59, 130, 246, 0.45)';
          } else if (isDeferred) {
            statusBadgeStyle.background = 'rgba(234, 179, 8, 0.15)';
            statusBadgeStyle.color = '#facc15';
            statusBadgeStyle.border = '1px solid rgba(234, 179, 8, 0.4)';
          }
          const providePhase = providePhases?.[nodeKey] ?? 'button';
          const trimmedInput = (textareaValue ?? '').trim();
          const hasInputValue = trimmedInput.length > 0;
          const showProvideSection = isDataList && !hasProvidedData;
          const shouldShowProvideButton = showProvideSection && providePhase === 'button' && !hasInputValue;
          const isProvideLocked = showProvideSection && providePhase === 'locked';
          const nodeType = isDataList ? 'data' : 'task';

          const handleProvideBlur = (event) => {
            if (!showProvideSection) return;
            const nextValue = event?.target?.value ?? '';
            const trimmed = nextValue.trim();
            if (!trimmed) {
              onClearDeferredInput?.(nodeKey);
              onProvideReset?.(nodeKey);
              return;
            }
            onProvideLock?.(nodeKey);
          };

          const handleProvideKeyDown = (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            const nextValue = event.currentTarget?.value ?? '';
            const trimmed = nextValue.trim();
            if (!trimmed) {
              onClearDeferredInput?.(nodeKey);
              onProvideReset?.(nodeKey);
              event.currentTarget?.blur();
              return;
            }
            onProvideLock?.(nodeKey);
            event.currentTarget?.blur();
          };

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
                      ...statusBadgeStyle,
                    }}
                  >
                    {statusLabel}
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

              {!isDataList && isDeferred && (node.stateId || node.id) && (
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
                      onClick={() => onDeferredSubmit(nodeKey, node, nodeType)}
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
              {showProvideSection && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem' }}>Provide Data</strong>
                    {!node.stateId && !node.id && (
                      <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Missing state identifier</span>
                    )}
                  </div>
                  {shouldShowProvideButton ? (
                    <button
                      type="button"
                      onClick={() => onProvideOpen?.(nodeKey)}
                      disabled={!node.stateId && !node.id}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '0.5rem 1rem',
                        borderRadius: 999,
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#e2e8f0',
                        fontWeight: 600,
                        cursor: !node.stateId && !node.id ? 'not-allowed' : 'pointer',
                        opacity: !node.stateId && !node.id ? 0.6 : 1,
                      }}
                    >
                      Provide Data
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        value={textareaValue}
                        onChange={(event) => onDeferredInputChange(nodeKey, event.target.value)}
                        onBlur={handleProvideBlur}
                        onKeyDown={handleProvideKeyDown}
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
                          opacity: isProvideLocked ? 0.8 : 1,
                          borderColor: isProvideLocked ? '#1f2937' : '#334155',
                          backgroundColor: isProvideLocked ? '#0b1220' : '#020617',
                        }}
                        placeholder='{"example": true}'
                      />
                      {hasInputValue && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => onDeferredSubmit(nodeKey, node, nodeType)}
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
                            {submitInfo.status === 'loading' ? 'Submitting…' : 'Submit'}
                          </button>
                          {submitInfo.status === 'success' && (
                            <span style={{ fontSize: '0.8rem', color: '#34d399' }}>{submitInfo.message ?? 'Data provided'}</span>
                          )}
                          {submitInfo.status === 'error' && (
                            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{submitInfo.message ?? 'Failed to submit'}</span>
                          )}
                        </div>
                      )}
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
  const [providePhases, setProvidePhases] = useState({});
  const specInfo = instance?.componentSpec ?? null;
  const stateMachineStatus = (instance?.state ?? 'unknown').toString();
  const stateStatusColor = stateMachineStatus.toLowerCase() === 'running' ? '#22c55e' : '#94a3b8';
  const stateStatusBg = stateMachineStatus.toLowerCase() === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)';
  const isRunning = stateMachineStatus.toLowerCase() === 'running';

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

  const openProvidePhase = useCallback((nodeId) => {
    if (!nodeId) return;
    setProvidePhases((prev) => ({ ...prev, [nodeId]: 'editing' }));
  }, []);

  const lockProvidePhase = useCallback((nodeId) => {
    if (!nodeId) return;
    setProvidePhases((prev) => ({ ...prev, [nodeId]: 'locked' }));
  }, []);

  const resetProvidePhase = useCallback((nodeId) => {
    if (!nodeId) return;
    setProvidePhases((prev) => {
      if (!prev[nodeId]) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  const clearDeferredInput = useCallback((nodeId) => {
    setDeferredInputs((prev) => {
      if (prev[nodeId] == null) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setDeferredSubmitState((prev) => {
      if (!prev[nodeId] || prev[nodeId].status !== 'error') return prev;
      const next = { ...prev };
      next[nodeId] = { status: 'idle', message: null };
      return next;
    });
  }, []);

  const handleDeferredSubmit = useCallback(async (nodeKey, node, nodeType = 'data') => {
    if (!instanceId) return;
    const rawInput = (deferredInputs[nodeKey] ?? '').trim();
    if (!rawInput) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: 'Enter JSON before submitting' },
      }));
      return;
    }

    try {
      JSON.parse(rawInput);
    } catch (err) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: err.message ?? 'Invalid JSON' },
      }));
      return;
    }

    const stateId = node?.stateId ?? node?.id;
    if (!stateId) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: 'Node state id missing' },
      }));
      return;
    }

    const name = (node?.name ?? '').trim();
    if (!name) {
      setDeferredSubmitState((prev) => ({
        ...prev,
        [nodeKey]: { status: 'error', message: 'Node name missing' },
      }));
      return;
    }

    const type = (nodeType ?? 'data').toString().trim().toLowerCase() || 'data';

    setDeferredSubmitState((prev) => ({
      ...prev,
      [nodeKey]: { status: 'loading', message: null },
    }));

    try {

      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ComponentInstanceProvideData($instanceId: String!, $stateId: String!, $name: String!, $type: String!, $payload: String!) {
            componentInstanceProvideData(instanceId: $instanceId, stateId: $stateId, name: $name, type: $type, payload: $payload) {
              ok
            }
          }`,
          variables: {
            instanceId,
            stateId,
            name,
            type,
            payload: rawInput,
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
          name,
          type,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Instance {instance.instanceId}</h1>
              <span
                style={{
                  fontSize: '0.95rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 999,
                  background: stateStatusBg,
                  color: stateStatusColor,
                  textTransform: 'capitalize',
                  border: '1px solid #1e293b',
                }}
              >
                {stateMachineStatus}
              </span>
            </div>
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
                onClick={() => {
                  if (isRunning) return;
                  return handleStartInstance();
                }}
                disabled={startStatus === 'loading' || isRunning}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: 999,
                  border: '1px solid #1e293b',
                  background: '#0f172a',
                  color: isRunning ? '#f87171' : '#22c55e',
                  padding: '0.45rem 0.9rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: startStatus === 'loading' || isRunning ? 'not-allowed' : 'pointer',
                  opacity: startStatus === 'loading' || isRunning ? 0.6 : 1,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1rem' }}>▶</span>
                {isRunning ? 'Stop Component' : startStatus === 'loading' ? 'Starting…' : 'Start Component'}
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
            <InstanceImportsList connection={instance.imports} />
            <InstanceStateList
              title="Data Nodes"
              connection={instance.data}
              deferredInputs={deferredInputs}
              onDeferredInputChange={handleDeferredInputChange}
              onDeferredSubmit={handleDeferredSubmit}
              submitState={deferredSubmitState}
              providePhases={providePhases}
              onProvideOpen={openProvidePhase}
              onProvideLock={lockProvidePhase}
              onProvideReset={resetProvidePhase}
              onClearDeferredInput={clearDeferredInput}
            />
            <InstanceStateList
              title="Task Nodes"
              connection={instance.tasks}
              deferredInputs={deferredInputs}
              onDeferredInputChange={handleDeferredInputChange}
              onDeferredSubmit={handleDeferredSubmit}
              submitState={deferredSubmitState}
              providePhases={providePhases}
              onProvideOpen={openProvidePhase}
              onProvideLock={lockProvidePhase}
              onProvideReset={resetProvidePhase}
              onClearDeferredInput={clearDeferredInput}
            />
          </div>
        </>
      )}
    </main>
  );
}
