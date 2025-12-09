# backend-bricks

A lightweight Next.js scaffold for the backend-bricks dashboard.

## Getting Started

1. Install dependencies
   ```bash
   npm install
   ```
2. Run the development server (listens on http://localhost:64209)
   ```bash
   npm run dev
   ```
3. Build for production
   ```bash
   npm run build
   npm run start
   ```

Feel free to expand the `src/app` directory with routes, layouts, and components tailored to your workflow.

## Configuration

- GraphQL endpoint
  - Override the default endpoint by setting `NEXT_PUBLIC_GRAPHQL_ENDPOINT` in an `.env.local` file at the project root:
    ```bash
    # .env.local
    NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://10.88.0.5:4000/graphql
    ```
  - If not set, the dashboard uses the default from `src/lib/config.js`.
