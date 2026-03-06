# Server-Side Rules

## Architecture: Hexagonal / DDD

All new server-side features MUST follow the hexagonal architecture pattern.
See @docs/hexagonal-architecture.md for full explanation.

```
<feature>/
├── domain/
│   ├── entities/          # Domain entities with behavior
│   ├── repositories/      # Repository INTERFACES (ports)
│   └── types.ts           # Domain-specific types
├── application/
│   ├── dto/               # Request/Response DTOs
│   └── use-cases/         # One class per use case
└── infrastructure/
    └── persistence/       # Repository implementations (adapters)
```

## Layer Rules

- **Domain**: Pure business logic. No framework imports, no Supabase, no HTTP concerns. Entities contain behavior (e.g., `toInvoiceItem()`).
- **Application**: Use cases orchestrate domain logic. Receive repository interfaces via constructor injection. Use DTOs at boundaries — never expose domain entities to the API.
- **Infrastructure**: Implements repository interfaces. This is the **only layer** that knows about Supabase.

## Use Case Rules

- One use case per file, one public method (`execute`).
- Use cases are **independent** — no use case may call another use case.
- Receive dependencies (repositories) through constructor injection.
- Validate input via DTOs before executing business logic.

## Repository Pattern

- Define the interface in `domain/repositories/`.
- Implement in `infrastructure/persistence/` (e.g., `SupabaseSpreadsheetRepository`).
- **NEVER** access Supabase directly from use cases or domain entities.

## Server-Only Dependencies

These packages MUST stay in server-side code only (configured in `next.config.ts`):
- `@napi-rs/canvas` — Node.js native canvas
- `pdfjs-dist` — PDF parsing with Node.js binaries

Importing them in client components will cause build failures.

## PDF Generation

- Core engine: `src/server/label-renderer.ts`
- Specialized renderers: `src/server/renderers/`
- `@ts-nocheck` is used in `label-renderer.ts` due to pdf-lib types
- See @docs/pdf-generation.md for label types, templates, coordinates, and debugging.

## Canonical Example

See `src/server/spreadsheets/` as the reference implementation of the hexagonal pattern.
