"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { logClientError, serializeError } from '@/lib/logClientError';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

function useComponentSpecs() {
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
            query: `query ComponentSpecsList($first: Int) {
              componentSpecs(first: $first) {
                edges {
                  node {
                    hash
                    name
                    createdAt
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
            items: payload.data?.componentSpecs?.edges?.map(({ node }) => node) ?? [],
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to load component spec list:', error);
        logClientError(endpoint, {
          message: 'ComponentSpecsList fetch failed',
          details: {
            endpoint,
            variables: { first: 200 },
            error: serializeError(error),
          },
        });
        if (!cancelled) {
          setState({ status: 'error', items: [], error: error.message ?? 'Failed to load component specs' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [endpoint]);

  return state;
}

export default function ComponentSpecsPage() {
  const { items: specs, status, error } = useComponentSpecs();
  const sortedSpecs = useMemo(() => {
    const parseCreatedAt = (value) => {
      const timestamp = value ? Date.parse(value) : NaN;
      return Number.isFinite(timestamp) ? timestamp : -Infinity;
    };

    return [...specs].sort((a, b) => {
      const createdDiff = parseCreatedAt(b?.createdAt) - parseCreatedAt(a?.createdAt);
      if (createdDiff !== 0) {
        return createdDiff;
      }

      const nameA = a?.name ?? '';
      const nameB = b?.name ?? '';
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }

      return (a?.hash ?? '').localeCompare(b?.hash ?? '');
    });
  }, [specs]);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Component Specs</h1>
        <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
          Review the registered backend bricks component specs and their identifiers.
        </p>
        <Link href="/component-instances" style={{ color: '#a5b4fc', textDecoration: 'underline', fontSize: '0.95rem' }}>
          View all component instances
        </Link>
      </header>

      {status === 'loading' && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>Loading component specs…</p>
        </section>
      )}

      {status === 'error' && (
        <section style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: '1.5rem', background: '#1f2937' }}>
          <p style={{ margin: 0, color: '#fca5a5' }}>Unable to load component specs: {error}</p>
        </section>
      )}

      {status === 'loaded' && specs.length === 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', background: '#111827' }}>
          <p style={{ margin: 0, color: '#cbd5f5' }}>No component specs found.</p>
        </section>
      )}

      {status === 'loaded' && specs.length > 0 && (
        <section style={{ border: '1px solid #1e293b', borderRadius: 12, background: '#111827' }}>
          <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Component Spec</span>
            <span style={{ fontWeight: 600 }}>Hash</span>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sortedSpecs.map((spec) => {
              const identifier = spec?.hash ?? spec?.id ?? spec?.name ?? 'unknown';
              const specDetailHref = `/component-specs/${encodeURIComponent(identifier)}`;
              const specInstancesHref = `/component-specs/${encodeURIComponent(identifier)}/instances`;
              return (
                <li key={identifier} style={{ borderBottom: '1px solid #1e293b' }}>
                  <div style={{ padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 240 }}>
                      <Link href={specDetailHref} style={{ fontWeight: 600, color: '#cbd5f5', fontSize: '1.05rem', textDecoration: 'underline' }}>
                        {spec.name ?? 'Unnamed component spec'}
                      </Link>
                      {spec.createdAt && (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          Created {new Date(spec.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <code style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>{spec.hash}</code>
                      <Link href={specInstancesHref} style={{ fontSize: '0.9rem', color: '#a5b4fc', textDecoration: 'underline' }}>
                        View instances
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
