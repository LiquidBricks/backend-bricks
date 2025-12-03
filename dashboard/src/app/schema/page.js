"use client";

import { useCallback, useState } from "react";
import { ReactFlowProvider } from "reactflow";
import LabelPanel from "./components/LabelPanel";
import SchemaCanvas from "./components/SchemaCanvas";
import useGraphQLTypes from "./hooks/useGraphQLTypes";

export default function SchemaPage() {
  const { status, types } = useGraphQLTypes();
  const [usedTypes, setUsedTypes] = useState([]);
  const [addHelper, setAddHelper] = useState(null);

  const handleNodesUpdate = useCallback((nodes = []) => {
    const next = new Set();
    nodes.forEach((node) => {
      const label = node?.data?.label;
      if (label) next.add(label);
    });
    setUsedTypes(Array.from(next));
  }, []);

  return (
    <main
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "2rem" }}>GraphQL Schema</h1>
      <p style={{ margin: 0, color: "#94a3b8", maxWidth: 680 }}>
        Pull types straight from the GraphQL API, drag them into the canvas, and sketch how things connect.
      </p>

      <ReactFlowProvider>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
          <LabelPanel
            status={status}
            types={types}
            usedTypeNames={usedTypes}
            onAddLabel={(payload) => {
              if (typeof addHelper === "function") addHelper(payload);
            }}
          />
          <SchemaCanvas onNodesUpdate={handleNodesUpdate} exposeAddHelper={setAddHelper} />
        </div>
      </ReactFlowProvider>
    </main>
  );
}
