"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { logClientError, serializeError } from '@/lib/logClientError';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

async function fetchJSON(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(', '));
  }

  return payload.data;
}

function useComponentSpecInstancesForSpec(identifier) {
  const [state, setState] = useState({ status: 'idle', spec: null, instances: [], error: null });

  useEffect(() => {
    if (!identifier) {
      setState({ status: 'idle', spec: null, instances: [], error: null });
      return;
    }

    let cancelled = false;

    async function load() {
      setState({ status: 'loading', spec: null, instances: [], error: null });
      try {
        const specData = await fetchJSON(
          `query ComponentSpecBasic($hash: String) {
            componentSpec(hash: $hash) {
              hash
              name
              createdAt
            }
          }`,
          { hash: identifier },
        );

        const spec = specData?.componentSpec ?? null;
        if (!spec) {
          if (!cancelled) setState({ status: 'loaded', spec: null, instances: [], error: null });
          return;
        }

        const instancesData = await fetchJSON(
          `query ComponentSpecInstancesBySpec($first: Int) {
            componentSpecInstances(first: $first) {
              edges {
                node {
                  instanceId
                  createdAt
                  componentSpec {
                    hash
                    name
                  }
                }
              }
              totalCount
            }
          }`,
          { first: 200 },
        );

        const allInstances = instancesData?.componentSpecInstances?.edges?.map(({ node }) => node) ?? [];
        const normalize = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
        const matchHash = spec?.hash || identifier || '';
        const instances = matchHash
          ? allInstances.filter((instance) => normalize(instance?.componentSpec?.hash) === normalize(matchHash))
          : allInstances;
        if (!cancelled) setState({ status: 'loaded', spec, instances, error: null });
      } catch (error) {
        console.error('Failed to load component spec instances:', error);
        logClientError(GRAPHQL_ENDPOINT, {
          message: 'ComponentSpecInstancesBySpec fetch failed',
          details: {
            endpoint: GRAPHQL_ENDPOINT,
            identifier,
            variables: { first: 200 },
            error: serializeError(error),
          },
        });
        if (!cancelled) setState({ status: 'error', spec: null, instances: [], error: error.message ?? 'Failed to load component instances' });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [identifier]);

  return state;
}

export default function ComponentSpecInstancesForSpecPage({ params }) {
  const identifier = params?.componentSpecId;
  const { status, spec, instances, error } = useComponentSpecInstancesForSpec(identifier);

  const specName = spec?.name ?? 'Component Spec';
  const specHashForLink = spec?.hash ?? identifier ?? '';

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <Link href={`/component-specs/${encodeURIComponent(specHashForLink)}`} style={{ color: '#a5b4fc' }}>
          &larr; Back to spec detail
        </Link>
        <Link href="/component-instances" style={{ color: '#a5b4fc' }}>
          View all component instances
        </Link>
      </div>

      <header>
        <h1 style={{ margin: 0, fontSize: '2.25rem' }}>Instances of {specName}</h1>
        {spec?.hash && (
          <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
            Spec hash: <code>{spec.hash}</code>
          </p>
        )}
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

      {status === 'loaded' && spec == null && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <p style={{ margin: 0, color: '#fca5a5' }}>Component spec “{identifier}” not found.</p>
        </section>
      )}

      {status === 'loaded' && spec != null && instances.length === 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>No instances have been created for this component spec yet.</p>
        </section>
      )}

      {status === 'loaded' && spec != null && instances.length > 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
          <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Instance</span>
            <span style={{ fontWeight: 600 }}>Created</span>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {instances.map((instance) => {
              const specInfo = instance.componentSpec ?? {};
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
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{specInfo.name ?? 'Unnamed component spec'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}><code>{specInfo.hash ?? '—'}</code></div>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'right' }}>
                    {instance.createdAt ? new Date(instance.createdAt).toLocaleString() : '—'}
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
