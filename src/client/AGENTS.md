# Client Feature Module Rules

## Module Structure

Every feature in `src/client/<feature>/` MUST follow this structure:

```
<feature>/
├── types/index.ts       # TypeScript types, column definitions, defaults, constants
├── hooks/               # React hooks for state management and operations
├── services/            # HTTP API client functions (calls to src/app/api/)
└── components/          # React components specific to this feature
```

## Folder Rules

- **types/**: Pure TypeScript. No React imports. Export interfaces, type aliases, enums, constants, and default/example data.
- **hooks/**: Custom React hooks only. Each hook manages a specific concern (e.g., `useSpreadsheet` for state, `useAutoSave` for persistence). No direct fetch calls — delegate to `services/`.
- **services/**: Plain async functions that call API routes. No React imports, no hooks. Return typed data.
- **components/**: React components scoped to this feature. Use hooks from `../hooks/` for state. Use services indirectly through hooks.

## State Management

- No Redux, no Zustand. React hooks only (`useState`, `useReducer`, `useContext`, custom hooks).
- Shared state within a feature flows through a main hook (e.g., `useSpreadsheet`).

## Styling

- TailwindCSS classes only. No CSS modules, no styled-components.

## Data Type Handling

- API responses return numeric fields as JavaScript numbers.
- Client-side state stores all cell values as **strings**.
- ALWAYS wrap API values with `String()` when loading into client state to prevent `.trim()` crashes on numbers.

## Canonical Example

See `src/client/spreadsheets/` as the reference implementation of this pattern.
