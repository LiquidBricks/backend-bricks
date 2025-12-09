"use client";

import { useCallback, useMemo } from "react";
import { DND_DATA_FORMAT } from "../../domain/constants";

export default function LabelPanel({
  status,
  types = [],
  usedTypeNames = [],
  onAddLabel,
}) {
  const usedSet = useMemo(() => new Set(usedTypeNames), [usedTypeNames]);

  const handleDragStart = useCallback((event, payload) => {
    event.dataTransfer.setData(DND_DATA_FORMAT, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const availableTypes = useMemo(
    () => types.filter((type) => !usedSet.has(type.name)),
    [types, usedSet]
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
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>GraphQL Types</h2>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>
          Drag a type onto the canvas to start laying out your schema.
        </p>
      </header>

      {status === "loading" && (
        <div style={{ color: "#cbd5f5", fontSize: "0.95rem" }}>Loading types…</div>
      )}

      {status === "error" && (
        <div style={{ color: "#f87171", fontSize: "0.95rem" }}>Unable to load GraphQL schema.</div>
      )}

      {status === "loaded" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {availableTypes.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
              {types.length === 0 ? "No types found." : "All types already on the canvas."}
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {availableTypes.map((type) => (
                <li key={type.name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, {
                        kind: "type",
                        label: type.name,
                        graphqlKind: type.kind,
                      })
                    }
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
                    <span style={{ display: "block", fontWeight: 500 }}>{type.name}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>
                      {type.kind}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Add"
                    onClick={() =>
                      typeof onAddLabel === "function" &&
                      onAddLabel({ kind: "type", label: type.name, graphqlKind: type.kind })
                    }
                    style={{
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                      background: "#0b1220",
                      color: "#cbd5f5",
                      width: 32,
                      height: 32,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  );
}
