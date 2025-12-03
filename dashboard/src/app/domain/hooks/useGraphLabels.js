"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_DOMAIN_ENDPOINT } from "@/lib/config";

// Convert a domain label (domain.vertex.X or domain.edge.Y.from__to) to the res.* format
function toResLabel(domainLabel) {
  if (typeof domainLabel !== 'string') return null;
  if (domainLabel.startsWith('domain.vertex.')) {
    return `res.vertex.${domainLabel.slice('domain.vertex.'.length)}`;
  }
  if (domainLabel.startsWith('domain.edge.')) {
    const rest = domainLabel.slice('domain.edge.'.length); // e.g., has_data_state.componentInstance__data
    const firstDot = rest.indexOf('.');
    if (firstDot === -1) return `res.edge.${rest}`;
    const edgeLabel = rest.slice(0, firstDot);
    const pair = rest.slice(firstDot + 1);
    const [from, to] = pair.split('__');
    if (!from || !to) return `res.edge.${rest.replace('__', '_')}`;
    return `res.edge.${edgeLabel}.${from}_${to}`;
  }
  return domainLabel;
}

function collectLabelsFromDomainMeta(metaRoot) {
  const labels = [];
  const visit = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const maybe = obj?.constants?.LABEL;
    if (typeof maybe === 'string') {
      const resLabel = toResLabel(maybe);
      if (resLabel) labels.push(resLabel);
      return;
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(metaRoot);
  return labels;
}

export default function useGraphLabels() {
  const [state, setState] = useState({ status: 'idle', vertexLabels: [], edgeLabels: [], error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, status: 'loading', error: null }));
      try {
        const res = await fetch(DEFAULT_DOMAIN_ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`Domain meta request failed: ${res.status}`);
        const payload = await res.json();
        const vertex = Array.isArray(payload?.vertex) || typeof payload?.vertex === 'object' ? payload.vertex : {};
        const edge = Array.isArray(payload?.edge) || typeof payload?.edge === 'object' ? payload.edge : {};
        const allVertex = collectLabelsFromDomainMeta(vertex).filter((s) => s.startsWith('res.vertex.'));
        const allEdge = collectLabelsFromDomainMeta(edge).filter((s) => s.startsWith('res.edge.'));
        if (!cancelled) {
          setState({ status: 'loaded', vertexLabels: allVertex, edgeLabels: allEdge, error: null });
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', vertexLabels: [], edgeLabels: [], error: e.message ?? String(e) });
      }
    }
    load();
    return () => { cancelled = true };
  }, []);

  const sortedVertex = useMemo(() => [...state.vertexLabels].sort((a, b) => a.localeCompare(b)), [state.vertexLabels]);
  const sortedEdge = useMemo(() => [...state.edgeLabels].sort((a, b) => a.localeCompare(b)), [state.edgeLabels]);
  return { status: state.status, error: state.error, vertexLabels: sortedVertex, edgeLabels: sortedEdge };
}
