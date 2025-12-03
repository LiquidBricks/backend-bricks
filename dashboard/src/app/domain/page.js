"use client";

import { useCallback, useState } from "react";
import { ReactFlowProvider } from "reactflow";
import LabelPanel from "./components/LabelPanel";
import SchemaCanvas from "./components/SchemaCanvas";
import useGraphLabels from "./hooks/useGraphLabels";

export default function DomainPage() {
  const { status, vertexLabels, edgeLabels } = useGraphLabels();
  const [usedVertexLabels, setUsedVertexLabels] = useState([]);
  const [usedEdgeLabels, setUsedEdgeLabels] = useState([]);
  const [addHelper, setAddHelper] = useState(null);

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

  const availableVertexLabels = vertexLabels;
  const availableEdgeLabels = edgeLabels;

  return (
    <main
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "2rem" }}>Domain Schema</h1>
      <p style={{ margin: 0, color: "#94a3b8", maxWidth: 680 }}>
        Explore graph labels and lay out domain ideas. Drag vertex and edge labels onto the canvas to build your view.
      </p>

      <ReactFlowProvider>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
          <LabelPanel
            status={status}
            vertexLabels={availableVertexLabels}
            edgeLabels={availableEdgeLabels}
            usedVertexLabels={usedVertexLabels}
            usedEdgeLabels={usedEdgeLabels}
            onAddLabel={(payload) => {
              if (typeof addHelper === 'function') addHelper(payload);
            }}
          />
          <SchemaCanvas
            onNodesUpdate={handleNodesUpdate}
            exposeAddHelper={setAddHelper}
            edgeLabels={availableEdgeLabels}
          />
        </div>
      </ReactFlowProvider>
    </main>
  );
}
