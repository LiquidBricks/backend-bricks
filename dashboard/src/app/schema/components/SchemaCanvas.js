"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import SchemaNode from "../../domain/components/SchemaNode";
import { DND_DATA_FORMAT } from "../../domain/constants";

const createNodeId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function SchemaCanvas({ onNodesUpdate = () => {}, exposeAddHelper }) {
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

  const showIndicator = useCallback((text) => {
    setSaveIndicator(text);
    if (saveIndicatorTimerRef.current) {
      clearTimeout(saveIndicatorTimerRef.current);
    }
    saveIndicatorTimerRef.current = setTimeout(() => {
      setSaveIndicator("");
    }, 1200);
  }, []);

  const saveState = useCallback(
    async (reason, nextNodes = nodesRef.current, nextEdges = edgesRef.current, nextViewport = viewportRef.current) => {
      try {
        setIsSaving(true);
        setSaveError(null);
        const payload = {
          nodes: nextNodes,
          edges: nextEdges,
          viewport: nextViewport,
          autosaveEnabled: !!autosaveRef.current,
          reason,
          savedAt: new Date().toISOString(),
        };
        await fetch("/api/schema/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setIsSaving(false);
        showIndicator("Saved");
      } catch (error) {
        setIsSaving(false);
        setSaveError(error?.message || String(error));
      }
    },
    [showIndicator]
  );

  const maybeAutoSave = useCallback(
    (reason) => {
      if (autosaveRef.current) {
        saveState(reason);
      }
    },
    [saveState]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoadingState(true);
        const res = await fetch("/api/schema/load");
        if (!res.ok) throw new Error(`Failed to load schema canvas: ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;
        const loadedNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
        const loadedEdges = Array.isArray(payload?.edges) ? payload.edges : [];
        const viewport = payload?.viewport ?? null;
        const autosaveFlag = !!payload?.autosaveEnabled;
        nodesRef.current = loadedNodes;
        edgesRef.current = loadedEdges;
        viewportRef.current = viewport || { x: 0, y: 0, zoom: 1 };
        autosaveRef.current = autosaveFlag;
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setInitialViewport(viewport);
        setAutosaveEnabled(autosaveFlag);
        setIsLoadingState(false);
        setSaveError(null);
        onNodesUpdate(loadedNodes);
      } catch (error) {
        if (!cancelled) {
          setIsLoadingState(false);
          setSaveError(error?.message || String(error));
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [onNodesUpdate]);

  const onInit = useCallback((instance) => {
    setReactFlowInstance(instance);
    const viewport = viewportRef.current;
    if (viewport && !viewportAppliedRef.current) {
      instance.setViewport(viewport);
      viewportAppliedRef.current = true;
    }
  }, []);

  const createNode = useCallback((payload = {}, position) => {
    const id = createNodeId();
    const { label, kind = "type", graphqlKind } = payload;
    return {
      id,
      type: "schemaNode",
      position: position || { x: 0, y: 0 },
      data: { label, kind, graphqlKind },
      style: {
        boxShadow: "0 0 18px rgba(59,130,246,0.15)",
      },
    };
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleNodesChange = useCallback(
    (changes) => {
      const positionChanged = changes.some(
        (change) => change.type === "position" && change.dragging === false
      );
      nodesRef.current = applyNodeChanges(changes, nodesRef.current);
      setNodes([...nodesRef.current]);
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

  const defaultPositionForNewNode = useCallback(() => {
    const vp = viewportRef.current || { x: 0, y: 0, zoom: 1 };
    const jitter = () => Math.round(Math.random() * 40) - 20;
    return { x: (vp.x || 0) + 120 + jitter(), y: (vp.y || 0) + 120 + jitter() };
  }, []);

  const addNodeFromLabel = useCallback(
    (payload, position) => {
      const newNode = createNode(payload, position || defaultPositionForNewNode());
      nodesRef.current = [...nodesRef.current, newNode];
      setNodes([...nodesRef.current]);
      onNodesUpdate(nodesRef.current);
      maybeAutoSave("node-added");
    },
    [createNode, defaultPositionForNewNode, maybeAutoSave, onNodesUpdate]
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

  const addByLabel = useCallback(
    (payload) => {
      if (!payload || !payload.label) return;
      addNodeFromLabel(payload);
    },
    [addNodeFromLabel]
  );

  useEffect(() => {
    if (typeof exposeAddHelper === "function") {
      exposeAddHelper(() => addByLabel);
      return () => exposeAddHelper(null);
    }
  }, [addByLabel, exposeAddHelper]);

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
          onInit={onInit}
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
          <div style={{ color: "#f97316", fontSize: "0.75rem", maxWidth: 240, textAlign: "right" }}>
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
