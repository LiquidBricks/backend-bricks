// Centralized configuration for the dashboard
// Override via NEXT_PUBLIC_GRAPHQL_ENDPOINT at build time.

export const DEFAULT_GRAPHQL_ENDPOINT = 'http://10.88.0.59:4000/graphql';

export const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || DEFAULT_GRAPHQL_ENDPOINT;
