"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { logClientError, serializeError } from '@/lib/logClientError';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

function useComponentSpecInstances() {
  const [state, setState] = useState({ status: 'idle', items: [], error: null });
  const endpoint = useMemo(() => GRAPHQL_ENDPOINT, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ComponentSpecInstancesList($first: Int) {
              componentSpecInstances(first: $first) {
                edges {
                  node {
                    instanceId
                    createdAt
                    componentSpec {
                      name
                      hash
                    }
                  }
                }
                totalCount
              }
            }`,
            variables: { first: 200 },
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
          setState({
            status: 'loaded',
            items: payload.data?.componentSpecInstances?.edges?.map(({ node }) => node) ?? [],
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to load component spec instances:', error);
        logClientError(endpoint, {
          message: 'ComponentSpecInstancesList fetch failed',
          details: {
            endpoint,
            variables: { first: 200 },
            error: serializeError(error),
          },
        });
        if (!cancelled) {
          setState({ status: 'error', items: [], error: error.message ?? 'Failed to load component instances' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [endpoint]);

  return state;
}

export default function ComponentSpecInstancesPage() {
  const { items: instances, status, error } = useComponentSpecInstances();

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Component Instances</h1>
        <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
          View active component spec instances and track their progress.
        </p>
      </header>

      {status === 'loading' && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>Loading component instances…</p>
        </section>
      )}

      {status === 'error' && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <p style={{ margin: 0, color: '#fca5a5' }}>Unable to load component instances: {error}</p>
        </section>
      )}

      {status === 'loaded' && instances.length === 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>No component instances found.</p>
        </section>
      )}

      {status === 'loaded' && instances.length > 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
          <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Instance</span>
            <span style={{ fontWeight: 600 }}>Component Spec</span>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {instances.map((instance) => {
              const spec = instance?.componentSpec ?? {};
              return (
                <li key={instance.instanceId}>
                <Link
                  href={`/component-instances/${encodeURIComponent(instance.instanceId)}`}
                  style={{
                    padding: '1.1rem 1.5rem',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'background 0.2s ease',
                    background: 'transparent',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>Instance {instance.instanceId}</div>
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{instance.createdAt ? new Date(instance.createdAt).toLocaleString() : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{spec.name ?? 'Unnamed spec'}</div>
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}><code>{spec.hash ?? '—'}</code></div>
                  </div>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
