# AGENTS.md

**ProcesIA** — Agricultural label automation platform (Next.js 16, TypeScript, Supabase).

## Work Methodology

- Always write an implementation plan in `.ai/plans/` and get developer approval BEFORE coding.
- Conventional commits in English: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Branches and issue titles in English (no accents or special characters).
- GitHub Board columns: Ready, In Progress, Review.

## General Rules

- **Language**: UI text in Spanish. Code (variables, functions, types, comments, commits) in English.
- **Validation**: Use Zod at API boundaries and in forms (react-hook-form + zod).
- **Imports**: Use `@/*` alias for `src/*`.
- **Server-only packages**: NEVER import `@napi-rs/canvas` or `pdfjs-dist` in client components. They cause build failures.
- **File discipline**: Prefer editing existing files over creating new ones. Do not create unnecessary helpers or utilities for one-time operations.
- **TypeScript**: Strict mode. Follow official React and TypeScript best practices.
- **No automated tests**: Manual testing via UI is the current workflow.

## Development Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Cross-cutting Gotchas

- **Spreadsheet data types**: API returns numeric fields (`kg`, `bundles`, `price`) as JavaScript numbers, but client stores everything as strings. Always wrap with `String()` when loading from API to avoid `.trim()` crashes.
- **Invoice generation**: Uses server Supabase client (not browser client) to bypass RLS on `facturas` table from API routes.
- **Environment variables**: Create `.env.local` with all required vars. See @docs/environment-variables.md.
- **Supabase bucket permissions**: Buckets must be public for dashboard file retrieval.

## Reference Documentation

- @docs/architecture-overview.md
- @docs/hexagonal-architecture.md
- @docs/database-structure.md
- @docs/environment-variables.md
- @docs/api-routes.md
- @docs/pdf-generation.md
- @docs/supabase-integration.md
