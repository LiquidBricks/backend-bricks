"use client";

import { useEffect, useMemo, useState } from "react";
import { GRAPHQL_ENDPOINT } from "@/lib/config";

const INTROSPECTION_QUERY = `
  query SchemaTypes {
    __schema {
      types {
        name
        kind
      }
    }
  }
`;

export default function useGraphQLTypes() {
  const [state, setState] = useState({
    status: "idle",
    types: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({
        ...prev,
        status: "loading",
        error: null,
      }));
      try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ query: INTROSPECTION_QUERY }),
        });
        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.errors?.length) {
          const firstError = payload.errors[0];
          throw new Error(firstError?.message || "GraphQL error");
        }
        const rawTypes = payload?.data?.__schema?.types;
        const normalized = Array.isArray(rawTypes)
          ? rawTypes
              .filter((type) => type?.name && !type.name.startsWith("__"))
              .map((type) => ({
                name: type.name,
                kind: type.kind || "UNKNOWN",
              }))
          : [];
        if (!cancelled) {
          setState({
            status: "loaded",
            types: normalized,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            types: [],
            error: error?.message || String(error),
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTypes = useMemo(
    () => [...state.types].sort((a, b) => a.name.localeCompare(b.name)),
    [state.types]
  );

  return {
    status: state.status,
    error: state.error,
    types: sortedTypes,
  };
}
