# Architecture Overview

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode, target ES2017)
- **Auth/Database/Storage**: Supabase
- **PDF Generation**: pdf-lib + @pdf-lib/fontkit
- **PDF Reading**: pdfjs-dist + @napi-rs/canvas (server-side only)
- **AI Vision**: OpenAI GPT-4o-mini + Google Vision API
- **Forms**: react-hook-form + zod validation
- **UI**: TailwindCSS 4 + Framer Motion + lucide-react icons

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # API endpoints (vision, storage, stock, n8n, spreadsheets)
│   │   └── spreadsheets/   # Spreadsheet CRUD + invoice generation
│   │       ├── route.ts                    # POST (create) + GET (list)
│   │       ├── trash/route.ts              # GET (list trash)
│   │       └── [id]/
│   │           ├── route.ts                # GET + PATCH + DELETE
│   │           ├── archive/route.ts        # POST (soft delete)
│   │           ├── restore/route.ts        # POST (restore)
│   │           └── generate-invoice/route.ts # POST (generate invoice PDF)
│   ├── hojas-calculo/      # Spreadsheet pages
│   │   ├── page.tsx                        # List (server component)
│   │   ├── nueva/page.tsx                  # Create new (client)
│   │   ├── [id]/page.tsx                   # Edit existing (client)
│   │   └── papelera/page.tsx               # Trash view
│   ├── panel/              # Main user dashboard
│   ├── pedidos-vision/     # AI order parsing UI
│   └── [other routes]
├── client/                 # Feature-specific client code (hooks, components, services)
│   └── spreadsheets/       # Spreadsheet module (client-side)
│       ├── types/index.ts                  # Types, columns, defaults, example row
│       ├── hooks/
│       │   ├── useSpreadsheet.ts           # Main hook (state + operations)
│       │   ├── useAutoSave.ts              # Auto-save with debounce
│       │   └── useSpreadsheetList.ts       # List hook
│       ├── services/
│       │   └── spreadsheetApi.ts           # HTTP API client
│       └── components/
│           ├── SpreadsheetTable.tsx         # Editable grid (15 columns)
│           ├── SpreadsheetToolbar.tsx       # Action bar
│           ├── SpreadsheetHeaderForm.tsx    # Invoice header form (18 fields)
│           ├── PasteFromExcel.tsx           # Paste from Excel
│           ├── SpreadsheetList.tsx          # List view
│           ├── SpreadsheetCard.tsx          # Individual card
│           └── TrashBin.tsx                 # Trash view
├── components/             # React components (minimal - most UI is colocated)
├── lib/                    # Client-side utilities & config
│   ├── panel-config.ts     # Dashboard configuration & templates
│   ├── product-selection.ts# Label types & product mappings
│   └── vision-orders.ts    # Vision order models
├── server/                 # Server-side business logic (IMPORTANT)
│   ├── label-renderer.ts   # Main PDF engine (1800+ lines, 7 label types)
│   ├── label-automation.ts # Label processing pipeline
│   ├── label-ocr.ts        # Google Vision OCR
│   ├── vision-order-parser.ts # OpenAI Vision parsing
│   ├── supabase-storage.ts # Storage integration
│   ├── inventory.ts        # Stock management
│   ├── renderers/          # Specialized label renderers
│   │   ├── aldi-renderer.ts
│   │   ├── lidl-renderer.ts
│   │   ├── hiperdino-renderer.ts
│   │   └── kanali-renderer.ts
│   └── spreadsheets/       # Spreadsheet module (server-side, DDD pattern)
│       ├── domain/
│       │   ├── entities/Spreadsheet.ts
│       │   ├── entities/SpreadsheetRow.ts  # Includes toInvoiceItem()
│       │   ├── repositories/SpreadsheetRepository.ts
│       │   └── types.ts
│       ├── application/
│       │   ├── dto/SpreadsheetRequest.ts
│       │   ├── dto/SpreadsheetResponse.ts
│       │   └── use-cases/
│       │       ├── CreateSpreadsheet.ts
│       │       ├── UpdateSpreadsheet.ts
│       │       ├── ArchiveSpreadsheet.ts
│       │       ├── RestoreSpreadsheet.ts
│       │       ├── DeleteSpreadsheet.ts
│       │       └── GenerateInvoiceFromSpreadsheet.ts
│       └── persistence/
│           └── SupabaseSpreadsheetRepository.ts
├── utils/supabase/         # Supabase client initialization
├── types/                  # TypeScript type definitions
└── workflows/              # N8N workflow templates (JSON)
```

## Feature Module Pattern

### Client-side (`src/client/<feature>/`)

- **types/**: TypeScript types, column definitions, defaults
- **hooks/**: React hooks for state management and operations
- **services/**: API client functions (HTTP calls to `src/app/api/`)
- **components/**: React components specific to the feature

### Server-side (`src/server/<feature>/`)

Uses DDD (Domain-Driven Design):

- **domain/**: Entities, repository interfaces, domain types
- **application/**: DTOs, use cases (business logic)
- **persistence/**: Repository implementations (Supabase)

## `.ai/` Directory

Internal project documentation (not shipped to production):

- **`.ai/context/`**: Session context files documenting what was built and decisions made
- **`.ai/plans/`**: Implementation plans written before coding (reviewed and approved by devs)
- **`.ai/meetings/`**: Meeting transcripts and summaries with extracted tasks
