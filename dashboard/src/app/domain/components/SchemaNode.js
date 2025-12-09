"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useStore } from "reactflow";
import { DEFAULT_DOMAIN_ENDPOINT } from '@/lib/config';

function MenuIcon(props) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function TrashIcon(props) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7.5 3.5h5m-8 3h11m-1 0-.7 9.1a1.5 1.5 0 0 1-1.5 1.4H8.7a1.5 1.5 0 0 1-1.5-1.4L6.5 6.5m3 2v6m3-6v6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowInIcon(props) {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M2 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9.5 2.5 14 6l-4.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowOutIcon(props) {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M2 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M10 2.5 14.5 6 10 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useEdgeConnectionStatus(nodeId) {
  const selector = useCallback(
    (state) => {
      const hasIncoming = state.edges.some((edge) => edge.target === nodeId);
      const hasOutgoing = state.edges.some((edge) => edge.source === nodeId);
      return { hasIncoming, hasOutgoing };
    },
    [nodeId]
  );
  return useStore(selector);
}

export default function SchemaNode({ id, data, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const color = data?.kind === "vertex" ? "#2563eb" : data?.kind === "edge" ? "#22c55e" : "#e2e8f0";
  const isEdge = data?.kind === "edge";
  const { hasIncoming, hasOutgoing } = useEdgeConnectionStatus(id);
  const [propKeys, setPropKeys] = useState([]);
  const [propsStatus, setPropsStatus] = useState('idle');

  // Helpers to map res.* labels back to domain.* and collect schema property keys
  const toDomainLabel = useCallback((resLabel, kind) => {
    if (typeof resLabel !== 'string') return null;
    if (kind === 'vertex') {
      const m = resLabel.match(/^res\.vertex\.(.+)$/);
      return m ? `domain.vertex.${m[1]}` : null;
    }
    if (kind === 'edge') {
      const m = resLabel.match(/^res\.edge\.([^\.]+)\.(.+?)_(.+)$/);
      if (!m) return null;
      const [, edgeLabel, from, to] = m;
      return `domain.edge.${edgeLabel}.${from}__${to}`;
    }
    return null;
  }, []);

  // Depth-first search through domain meta to find matching schema props
  const findSchemaPropsByDomainLabel = useCallback((metaRoot, domainLabel) => {
    if (!metaRoot || typeof metaRoot !== 'object' || !domainLabel) return [];
    let result = null;
    const visit = (obj) => {
      if (!obj || typeof obj !== 'object' || result) return;
      const maybe = obj?.constants?.LABEL;
      if (maybe === domainLabel) {
        const props = obj?.schema?.properties || {};
        result = Object.keys(props);
        return;
      }
      for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') visit(v);
        if (result) return;
      }
    };
    visit(metaRoot);
    return Array.isArray(result) ? result : [];
  }, []);

  // Load property keys for vertex/edge labels from domain meta endpoint
  useEffect(() => {
    const label = data?.label;
    const kind = data?.kind;
    if (!label || (kind !== 'vertex' && kind !== 'edge')) return;
    let cancelled = false;
    async function loadProps() {
      setPropsStatus('loading');
      try {
        const domainLabel = toDomainLabel(label, kind);
        if (!domainLabel) throw new Error('Invalid label');
        const response = await fetch(DEFAULT_DOMAIN_ENDPOINT, {
          method: 'GET',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Domain meta error: ${response.status}`);
        const payload = await response.json();
        const metaRoot = kind === 'edge' ? payload?.edge : payload?.vertex;
        const keys = findSchemaPropsByDomainLabel(metaRoot, domainLabel);
        if (!cancelled) {
          setPropKeys(Array.isArray(keys) ? keys : []);
          setPropsStatus('loaded');
        }
      } catch (e) {
        if (!cancelled) {
          setPropKeys([]);
          setPropsStatus('error');
        }
      }
    }
    loadProps();
    return () => { cancelled = true };
  }, [data?.label, data?.kind, findSchemaPropsByDomainLabel, toDomainLabel]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handleClick);
    return () => {
      window.removeEventListener("pointerdown", handleClick);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleDelete = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      if (typeof onDelete === "function") {
        onDelete(id);
      }
    },
    [id, onDelete]
  );

  // Derive display name from label based on naming scheme without changing underlying label used for queries
  const displayName = useMemo(() => {
    const raw = data?.label;
    if (!raw) return 'Node';
    if (data?.kind === 'vertex') {
      const m = raw.match(/^res\.vertex\.(.+)$/);
      return m ? m[1] : raw;
    }
    if (data?.kind === 'edge') {
      const m = raw.match(/^res\.edge\.([^\.]+)\.(.+?)_(.+)$/);
      return m ? m[1] : raw;
    }
    return raw;
  }, [data?.label, data?.kind]);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${color}`,
        padding: "0.65rem 1rem",
        background: "#0b1220",
        color: "#e2e8f0",
        fontWeight: 500,
        minWidth: 150,
        textAlign: "center",
        position: "relative",
      }}
    >
      <div
        ref={menuRef}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={toggleMenu}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            background: "rgba(15, 23, 42, 0.7)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MenuIcon />
        </button>
        {menuOpen && (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "rgba(2, 6, 23, 0.95)",
              boxShadow: "0 8px 16px rgba(2, 6, 23, 0.4)",
              padding: "0.35rem 0.5rem",
              minWidth: 120,
            }}
          >
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={handleDelete}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                border: "none",
                background: "transparent",
                color: "#f87171",
                fontSize: "0.85rem",
                fontWeight: 600,
                padding: "0.25rem 0.3rem",
                cursor: "pointer",
              }}
            >
              <TrashIcon />
              Delete node
            </button>
          </div>
        )}
      </div>
      {isEdge && hasIncoming && (
        <span
          style={{
            position: "absolute",
            left: -28,
            top: "50%",
            transform: "translateY(-50%)",
            color,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowInIcon />
        </span>
      )}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, border: "none", width: 10, height: 10 }}
      />
      <span>{displayName}</span>
      {(data?.kind === 'vertex' || data?.kind === 'edge') && (
        <div style={{ marginTop: 6 }}>
          {propsStatus === 'loading' && (
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>loading props…</div>
          )}
          {propsStatus !== 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
              {propKeys.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>no properties</span>
              ) : (
                propKeys.map((k) => (
                  <span key={k} style={{
                    border: '1px solid #1e293b',
                    background: '#0b1220',
                    color: '#cbd5f5',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: 6,
                    display: 'block',
                    textAlign: 'center',
                  }}>{k}</span>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {isEdge && hasOutgoing && (
        <span
          style={{
            position: "absolute",
            right: -28,
            top: "50%",
            transform: "translateY(-50%)",
            color,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowOutIcon />
        </span>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, border: "none", width: 10, height: 10 }}
      />
    </div>
  );
}
