"use client";

import { useCallback, useMemo } from "react";
import { DND_DATA_FORMAT } from "../constants";

export default function LabelPanel({
  status,
  vertexLabels,
  edgeLabels,
  usedVertexLabels = [],
  usedEdgeLabels = [],
  onAddLabel,
}) {
  const handleDragStart = useCallback((event, payload) => {
    event.dataTransfer.setData(DND_DATA_FORMAT, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const formatVertexName = useCallback((label) => {
    const m = typeof label === 'string' ? label.match(/^res\.vertex\.(.+)$/) : null;
    return m ? m[1] : label;
  }, []);

  const formatEdgeName = useCallback((label) => {
    const m = typeof label === 'string' ? label.match(/^res\.edge\.([^\.]+)\.(.+?)_(.+)$/) : null;
    if (!m) return label;
    const [, edgeLabel, from, to] = m;
    return `${from} - ${edgeLabel} - ${to}`;
  }, []);

  const usedVertex = useMemo(() => new Set(usedVertexLabels), [usedVertexLabels]);
  const usedEdge = useMemo(() => new Set(usedEdgeLabels), [usedEdgeLabels]);

  const sections = useMemo(
    () => [
      { title: "Vertex Labels", kind: "vertex", items: vertexLabels, formatter: formatVertexName, usedSet: usedVertex },
      { title: "Edge Labels", kind: "edge", items: edgeLabels, formatter: formatEdgeName, usedSet: usedEdge },
    ],
    [vertexLabels, edgeLabels, formatEdgeName, formatVertexName, usedVertex, usedEdge]
  );

  return (
    <aside
      style={{
        width: 260,
        minWidth: 220,
        border: "1px solid #1e293b",
        borderRadius: 12,
        background: "#0f172a",
        padding: "1.25rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        height: "fit-content",
        maxHeight: "calc(100vh - 6rem)",
        overflowY: "auto",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Schema Labels</h2>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>
          Drag labels onto the canvas to create nodes.
        </p>
      </header>

      {status === "loading" && (
        <div style={{ color: "#cbd5f5", fontSize: "0.95rem" }}>Loading labels…</div>
      )}

      {status === "error" && (
        <div style={{ color: "#f87171", fontSize: "0.95rem" }}>Unable to load labels.</div>
      )}

      {status === "loaded" && sections.map((section) => {
        const visibleItems = section.items.filter((label) => !section.usedSet?.has(label));
        return (
        <section key={section.kind} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#cbd5f5" }}>{section.title}</h3>
          {visibleItems.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
              {section.items.length === 0
                ? `No ${section.kind === "vertex" ? "vertex" : "edge"} labels found.`
                : "All labels already on the canvas."}
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {visibleItems.map((label) => {
                const isUsed = section.usedSet?.has(label);
                return (
                <li key={`${section.kind}-${label}`} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isUsed ? 0.7 : 1 }}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, { kind: section.kind, label })}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "0.5rem 0.75rem",
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                      background: "#111827",
                      color: "#e2e8f0",
                      fontSize: "0.95rem",
                      cursor: "grab",
                    }}
                  >
                    <span style={{ display: "block", fontWeight: 500 }}>{typeof section.formatter === 'function' ? section.formatter(label) : label}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: isUsed ? "#f59e0b" : "#64748b" }}>{section.kind === "vertex" ? (isUsed ? "Vertex (in canvas)" : "Vertex") : (isUsed ? "Edge (in canvas)" : "Edge")}</span>
                  </button>
                  <button
                    type="button"
                    title="Add"
                    onClick={() => typeof onAddLabel === 'function' && onAddLabel({ kind: section.kind, label })}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                      background: "#0b1220",
                      color: "#cbd5f5",
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </li>
              )})}
            </ul>
          )}
        </section>
        );
      })}
    </aside>
  );
}
