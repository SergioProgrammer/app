# Frontend & API Routes Rules

## Next.js App Router

- Use the App Router (NOT Pages Router).
- Default to Server Components. Add `"use client"` only when the component needs interactivity (hooks, event handlers, browser APIs).
- Page-level data fetching happens in Server Components or route handlers, not in client components with useEffect.

## API Route Rules

- API routes are **thin orchestrators**: parse request -> call use case -> return response.
- **NO business logic** in API routes. All logic lives in `src/server/` use cases.
- Validate request bodies with Zod schemas before passing to use cases.
- Always return typed JSON responses with appropriate HTTP status codes.
- Use server Supabase client (`SUPABASE_SERVICE_ROLE_KEY`) for operations that need to bypass RLS.
- See @docs/api-routes.md for the full endpoint catalog.

## Styling

- **TailwindCSS is mandatory**. No CSS modules, no styled-components, no inline style objects.
- Icons: lucide-react.
- Animations: Framer Motion.

## State Management

- **No Redux, no Zustand**, no external state libraries.
- Use React hooks (`useState`, `useReducer`, `useContext`) and custom hooks in `src/client/<feature>/hooks/`.

## Component Colocation

- Feature-specific components go in `src/client/<feature>/components/`, NOT in `src/components/`.
- `src/components/` is reserved for truly shared/global components only.

## File Upload Pattern

- Client sends FormData to API route.
- API route reads as Buffer, processes, uploads to Supabase Storage via `uploadFileToBucket()`.
- Returns signed URL to client.
- See @docs/supabase-integration.md for details.
