"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  useStore,
} from "reactflow";
import "reactflow/dist/style.css";
import { GRAPHQL_ENDPOINT } from '@/lib/config';
const DND_DATA_FORMAT = "application/x-schema-label";

function useGraphLabels() {
  const [state, setState] = useState({
    status: "idle",
    vertexLabels: [],
    edgeLabels: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `query GraphLabels {
              graphVertexLabels
              graphEdgeLabels
            }`,
          }),
        });

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (payload.errors?.length) {
          throw new Error(payload.errors.map((error) => error.message).join(", "));
        }

        if (!cancelled) {
          setState({
            status: "loaded",
            vertexLabels: payload.data?.graphVertexLabels ?? [],
            edgeLabels: payload.data?.graphEdgeLabels ?? [],
            error: null,
          });
        }
      } catch (error) {
        console.error("Failed to load graph labels", error);
        if (!cancelled) {
          setState({ status: "error", vertexLabels: [], edgeLabels: [], error: error.message ?? "Failed to load graph labels" });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedVertex = useMemo(() => [...state.vertexLabels].sort((a, b) => a.localeCompare(b)), [state.vertexLabels]);
  const sortedEdge = useMemo(() => [...state.edgeLabels].sort((a, b) => a.localeCompare(b)), [state.edgeLabels]);

  return { ...state, vertexLabels: sortedVertex, edgeLabels: sortedEdge };
}

function LabelPanel({ status, vertexLabels, edgeLabels }) {
  const handleDragStart = useCallback((event, payload) => {
    event.dataTransfer.setData(DND_DATA_FORMAT, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const sections = useMemo(
    () => [
      { title: "Vertex Labels", kind: "vertex", items: vertexLabels },
      { title: "Edge Labels", kind: "edge", items: edgeLabels },
    ],
    [vertexLabels, edgeLabels]
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

      {status === "loaded" && sections.map((section) => (
        <section key={section.kind} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#cbd5f5" }}>{section.title}</h3>
          {section.items.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>No {section.kind === "vertex" ? "vertex" : "edge"} labels found.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {section.items.map((label) => (
                <li key={`${section.kind}-${label}`}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, { kind: section.kind, label })}
                    style={{
                      width: "100%",
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
                    <span style={{ display: "block", fontWeight: 500 }}>{label}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>{section.kind === "vertex" ? "Vertex" : "Edge"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}

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

function SchemaNode({ id, data, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const color = data?.kind === "vertex" ? "#2563eb" : data?.kind === "edge" ? "#22c55e" : "#e2e8f0";
  const isEdge = data?.kind === "edge";
  const { hasIncoming, hasOutgoing } = useEdgeConnectionStatus(id);

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
      <span>{data?.label ?? "Node"}</span>
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

function SchemaCanvas({ onNodesUpdate = () => {} }) {
  const wrapperRef = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [initialViewport, setInitialViewport] = useState(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState("");
  const [saveError, setSaveError] = useState(null);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const autosaveRef = useRef(autosaveEnabled);
  const viewportAppliedRef = useRef(false);
  const saveIndicatorTimerRef = useRef(null);
  const edgeUpdateSuccessfulRef = useRef(true);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    autosaveRef.current = autosaveEnabled;
  }, [autosaveEnabled]);

  useEffect(() => {
    return () => {
      if (saveIndicatorTimerRef.current) {
        clearTimeout(saveIndicatorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch("/api/schema/load", {
          method: "GET",
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Load failed: ${response.status}`);
        }

        const payload = await response.json();
        if (cancelled) return;

        const loadedNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        const loadedEdges = Array.isArray(payload.edges) ? payload.edges : [];
        const getViewportValue = (value, fallback) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        };
        const loadedViewport =
          payload && typeof payload.viewport === "object"
            ? {
                x: getViewportValue(payload.viewport.x, 0),
                y: getViewportValue(payload.viewport.y, 0),
                zoom: getViewportValue(payload.viewport.zoom, 1),
              }
            : null;
        const loadedAutosave = Boolean(payload?.autosaveEnabled);

        nodesRef.current = loadedNodes;
        edgesRef.current = loadedEdges;
        viewportRef.current = loadedViewport ?? { x: 0, y: 0, zoom: 1 };

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setAutosaveEnabled(loadedAutosave);
        setInitialViewport(loadedViewport);
        onNodesUpdate(loadedNodes);
      } catch (error) {
        console.error("Failed to load schema state", error);
      } finally {
        if (!cancelled) {
          setIsLoadingState(false);
        }
      }
    }

    loadState();
    return () => {
      cancelled = true;
    };
  }, [onNodesUpdate]);

  useEffect(() => {
    if (reactFlowInstance && initialViewport && !viewportAppliedRef.current) {
      reactFlowInstance.setViewport(initialViewport, { duration: 0 });
      viewportAppliedRef.current = true;
    }
  }, [reactFlowInstance, initialViewport]);

  const showSaveIndicator = useCallback((message) => {
    setSaveIndicator(message);
    if (saveIndicatorTimerRef.current) {
      clearTimeout(saveIndicatorTimerRef.current);
    }
    saveIndicatorTimerRef.current = setTimeout(() => {
      setSaveIndicator("");
    }, 1400);
  }, []);

  const saveState = useCallback(
    async (reason, overrideNodes, overrideEdges, overrideViewport) => {
      const nodesToSave = overrideNodes ?? nodesRef.current;
      const edgesToSave = overrideEdges ?? edgesRef.current;
      const viewportToSave = overrideViewport ?? viewportRef.current;

      setIsSaving(true);
      setSaveError(null);
      try {
        const response = await fetch("/api/schema/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nodes: nodesToSave,
            edges: edgesToSave,
            viewport: viewportToSave,
            autosaveEnabled: autosaveRef.current,
            reason,
            savedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Save failed: ${response.status}`);
        }

        showSaveIndicator(autosaveRef.current ? "Autosaved" : "Saved");
      } catch (error) {
        console.error("Failed to save schema state", error);
        setSaveError(error.message ?? "Failed to save state");
      } finally {
        setIsSaving(false);
      }
    },
    [showSaveIndicator]
  );

  const maybeAutoSave = useCallback(
    (reason) => {
      if (!autosaveRef.current) return;
      saveState(reason);
    },
    [saveState]
  );

  const createNode = useCallback((payload, position) => ({
    id: `${payload.kind}-${payload.label}-${Math.random().toString(36).slice(2, 8)}`,
    type: "schemaNode",
    position,
    data: { label: payload.label, kind: payload.kind },
  }), []);

  const addNodeFromLabel = useCallback(
    (payload, position) => {
      const newNode = createNode(payload, position);
      nodesRef.current = [...nodesRef.current, newNode];
      setNodes(nodesRef.current);
      onNodesUpdate(nodesRef.current);
      if (autosaveRef.current) {
        saveState("node-added", nodesRef.current);
      }
    },
    [createNode, onNodesUpdate, saveState]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DND_DATA_FORMAT);
      if (!raw || !reactFlowInstance) return;

      try {
        const payload = JSON.parse(raw);
        if (!payload?.label) return;

        const bounds = wrapperRef.current?.getBoundingClientRect();
        const projectPosition = reactFlowInstance.project({
          x: event.clientX - (bounds?.left ?? 0),
          y: event.clientY - (bounds?.top ?? 0),
        });

        addNodeFromLabel(payload, projectPosition);
      } catch (error) {
        console.error("Failed to handle drop", error);
      }
    },
    [addNodeFromLabel, reactFlowInstance]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleNodesChange = useCallback(
    (changes) => {
      const positionChanged = changes.some((change) => change.type === "position" && change.dragging === false);
      nodesRef.current = applyNodeChanges(changes, nodesRef.current);
      setNodes(nodesRef.current);
      onNodesUpdate(nodesRef.current);
      if (positionChanged) {
        maybeAutoSave("node-moved");
      }
    },
    [maybeAutoSave, onNodesUpdate]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      edgesRef.current = applyEdgeChanges(changes, edgesRef.current);
      setEdges(edgesRef.current);
      maybeAutoSave("edge-updated");
    },
    [maybeAutoSave]
  );

  const handleConnect = useCallback(
    (connection) => {
      edgesRef.current = addEdge({ ...connection }, edgesRef.current);
      setEdges(edgesRef.current);
      maybeAutoSave("edge-updated");
    },
    [maybeAutoSave]
  );

  const handleEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection?.source || !newConnection?.target) {
        return;
      }
      edgeUpdateSuccessfulRef.current = true;
      edgesRef.current = edgesRef.current.map((edge) =>
        edge.id === oldEdge.id
          ? {
              ...edge,
              source: newConnection.source,
              sourceHandle: newConnection.sourceHandle,
              target: newConnection.target,
              targetHandle: newConnection.targetHandle,
            }
          : edge
      );
      setEdges(edgesRef.current);
      maybeAutoSave("edge-updated");
    },
    [maybeAutoSave]
  );

  const handleEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessfulRef.current = false;
  }, []);

  const handleEdgeUpdateEnd = useCallback(
    (_event, edge) => {
      if (edgeUpdateSuccessfulRef.current) {
        return;
      }
      const edgeId = edge?.id;
      if (!edgeId) {
        return;
      }
      edgesRef.current = edgesRef.current.filter((existing) => existing.id !== edgeId);
      setEdges(edgesRef.current);
      maybeAutoSave("edge-deleted");
    },
    [maybeAutoSave]
  );

  const handleEdgesDelete = useCallback(
    (edgesToRemove) => {
      if (!edgesToRemove?.length) return;
      const ids = new Set(edgesToRemove.map((edge) => edge.id));
      edgesRef.current = edgesRef.current.filter((edge) => !ids.has(edge.id));
      setEdges(edgesRef.current);
      maybeAutoSave("edge-deleted");
    },
    [maybeAutoSave]
  );

  const handleMoveEnd = useCallback((_evt, viewport) => {
    viewportRef.current = viewport;
  }, []);

  const toggleAutosave = useCallback(() => {
    const next = !autosaveRef.current;
    autosaveRef.current = next;
    setAutosaveEnabled(next);
    saveState("autosave-toggle");
  }, [saveState]);

  const deleteNodeById = useCallback(
    (nodeId) => {
      nodesRef.current = nodesRef.current.filter((node) => node.id !== nodeId);
      edgesRef.current = edgesRef.current.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      setNodes([...nodesRef.current]);
      setEdges([...edgesRef.current]);
      onNodesUpdate(nodesRef.current);
      maybeAutoSave("node-deleted");
    },
    [maybeAutoSave, onNodesUpdate]
  );

  const nodeTypes = useMemo(
    () => ({
      schemaNode: (props) => <SchemaNode {...props} onDelete={deleteNodeById} />,
    }),
    [deleteNodeById]
  );

  return (
    <section style={{ flex: 1, position: "relative" }}>
      <div
        ref={wrapperRef}
        style={{
          height: "calc(100vh - 6rem)",
          minHeight: 480,
          border: "1px solid #1e293b",
          borderRadius: 12,
          overflow: "hidden",
          background: "#020617",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onEdgesDelete={handleEdgesDelete}
          onConnect={handleConnect}
          onEdgeUpdate={handleEdgeUpdate}
          onEdgeUpdateStart={handleEdgeUpdateStart}
          onEdgeUpdateEnd={handleEdgeUpdateEnd}
          onInit={setReactFlowInstance}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onMoveEnd={handleMoveEnd}
          fitView
          defaultViewport={initialViewport ?? { x: 0, y: 0, zoom: 1 }}
          panOnScroll
          fitViewOptions={{ padding: 0.2 }}
          nodeTypes={nodeTypes}
        >
          <Background color="#1e293b" gap={24} />
          <Controls position="top-left" />
        </ReactFlow>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={toggleAutosave}
          style={{
            borderRadius: 999,
            border: "1px solid #1e293b",
            background: autosaveEnabled ? "#22c55e" : "#111827",
            color: autosaveEnabled ? "#04110a" : "#e2e8f0",
            padding: "0.4rem 0.9rem",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            boxShadow: autosaveEnabled ? "0 0 10px rgba(34,197,94,0.4)" : "none",
          }}
        >
          Autosave: {autosaveEnabled ? "On" : "Off"}
        </button>

        {(isSaving || saveIndicator) && (
          <div
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 999,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid #1e293b",
              color: "#cbd5f5",
              fontSize: "0.8rem",
            }}
          >
            {isSaving ? "Saving…" : saveIndicator}
          </div>
        )}

        {saveError && (
          <div style={{ color: "#f97316", fontSize: "0.75rem", maxWidth: 200, textAlign: "right" }}>
            {saveError}
          </div>
        )}

        {isLoadingState && (
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Loading canvas…</div>
        )}
      </div>
    </section>
  );
}

export default function SchemaPage() {
  const { status, vertexLabels, edgeLabels } = useGraphLabels();
  const [usedVertexLabels, setUsedVertexLabels] = useState([]);
  const [usedEdgeLabels, setUsedEdgeLabels] = useState([]);

  const handleNodesUpdate = useCallback((nodes) => {
    const vertex = new Set();
    const edge = new Set();
    nodes.forEach((node) => {
      const kind = node?.data?.kind;
      const label = node?.data?.label;
      if (!label) return;
      if (kind === "vertex") {
        vertex.add(label);
      } else if (kind === "edge") {
        edge.add(label);
      }
    });
    setUsedVertexLabels(Array.from(vertex));
    setUsedEdgeLabels(Array.from(edge));
  }, []);

  const availableVertexLabels = useMemo(() => {
    const used = new Set(usedVertexLabels);
    return vertexLabels.filter((label) => !used.has(label));
  }, [vertexLabels, usedVertexLabels]);

  const availableEdgeLabels = useMemo(() => {
    const used = new Set(usedEdgeLabels);
    return edgeLabels.filter((label) => !used.has(label));
  }, [edgeLabels, usedEdgeLabels]);

  return (
    <main
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Graph Schema</h1>
      <p style={{ margin: 0, color: "#94a3b8", maxWidth: 680 }}>
        Explore graph labels and lay out schema ideas. Drag vertex and edge labels onto the canvas to build your view.
      </p>

      <ReactFlowProvider>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
          <LabelPanel status={status} vertexLabels={availableVertexLabels} edgeLabels={availableEdgeLabels} />
          <SchemaCanvas onNodesUpdate={handleNodesUpdate} />
        </div>
      </ReactFlowProvider>
    </main>
  );
}
