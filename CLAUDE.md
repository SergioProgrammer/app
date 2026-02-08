# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ProcesIA** - An agricultural label automation platform for Spanish produce suppliers. Generates supermarket-specific product labels (etiquetas) and delivery notes (albaranes) for major chains (Mercadona, Aldi, Lidl, Hiperdino, Kanali). Uses AI vision to parse order PDFs/images and automates label generation with precise formatting requirements.

The platform also includes a **Spreadsheet module** (Hojas de Calculo) that allows users to create/edit spreadsheets with agricultural order data and generate invoices (facturas) + Anexo IV PDFs directly from them.

## Development Commands

### Essential Commands
```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### No Test Suite
This project does not have automated tests configured. Manual testing via the UI is the current workflow.

## Architecture

### Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode, target ES2017)
- **Auth/Database/Storage**: Supabase
- **PDF Generation**: pdf-lib + @pdf-lib/fontkit
- **PDF Reading**: pdfjs-dist + @napi-rs/canvas (server-side only)
- **AI Vision**: OpenAI GPT-4o-mini + Google Vision API
- **Forms**: react-hook-form + zod validation
- **UI**: TailwindCSS 4 + Framer Motion + lucide-react icons

### Import Aliases
Use `@/*` to reference `src/*`:
```typescript
import { LabelType } from '@/lib/product-selection'
import { renderLabelPdf } from '@/server/label-renderer'
```

### Key Directory Structure
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

### Feature Module Pattern (`src/client/`)

New features follow the pattern in `src/client/<feature>/`:
- **types/**: TypeScript types, column definitions, defaults
- **hooks/**: React hooks for state management and operations
- **services/**: API client functions (HTTP calls to `src/app/api/`)
- **components/**: React components specific to the feature

The server counterpart lives in `src/server/<feature>/` using DDD:
- **domain/**: Entities, repository interfaces, domain types
- **application/**: DTOs, use cases (business logic)
- **persistence/**: Repository implementations (Supabase)

### `.ai/` Directory

The `.ai/` directory contains internal project documentation (not shipped to production):
- **`.ai/context/`**: Session context files documenting what was built and decisions made
- **`.ai/plans/`**: Implementation plans written before coding (reviewed and approved by devs)
- **`.ai/meetings/`**: Meeting transcripts and summaries with extracted tasks

## Critical Server-Side Rendering Notes

### Heavy Dependencies (Server-Only)
The following packages MUST stay server-side only (configured in `next.config.ts`):
- `@napi-rs/canvas` - Node.js native canvas (PDF rendering)
- `pdfjs-dist` - PDF parsing (uses Node.js binaries)

**Never import these in client components.** They will cause build failures.

### PDF Generation Pipeline

The core PDF engine is `src/server/label-renderer.ts`:

**Supported Label Types** (7 types):
```typescript
type LabelType =
  | 'mercadona'      // Template-based fixed layout
  | 'aldi'           // Multi-label with variable lot numbers (E00001-E99999)
  | 'lidl'           // 3-label system (base + 2 white labels)
  | 'hiperdino'      // Customizable weight and lot
  | 'kanali'         // Dedicated design
  | 'blanca-grande'  // Generic large white label
  | 'blanca-pequena' // Generic small white label
```

**Key Functions**:
- `renderLabelPdf()` - Main entry point for single labels
- `renderAldiLabelSet()` - Generates Aldi labels with trace numbers (E00001, E00002, etc.)
- `renderLidlLabelSet()` - Generates 3 PDFs for Lidl (base + 2 white labels)
- `processLabelAutomation()` in `label-automation.ts` - Orchestrates rendering → upload → inventory

**Template Resolution**:
Templates are loaded from `public/` directory:
- Default: `Etiqueta.pdf` or `Etiqueta.png`
- Aldi: `Etiqueta-Aldi.pdf`
- Environment variable: `LABEL_TEMPLATE_PATH` (optional override)

**Font Loading**:
- Tries `LABEL_FONT_PATH` env var first
- Fallback candidates: `public/fonts/Arial.ttf`, system fonts
- Uses `@pdf-lib/fontkit` for custom fonts

**Layout System**:
Text is positioned using pixel coordinates based on a 1262×768px canvas (67mm × 41mm label):
```typescript
const TEXT_LAYOUT: Record<TemplateLayoutField, LayoutEntry> = {
  fechaEnvasado: { baseX: 325, baseY: 415, align: 'left', fontSize: 34 },
  lote: { baseX: 215, baseY: 490, align: 'left', fontSize: 34 },
  codigoCoc: { baseX: 205, baseY: 630, align: 'left', fontSize: 34 },
  codigoR: { baseX: 1020, baseY: 505, align: 'left', fontSize: 27 },
}
```
Modifying layouts requires adjusting these coordinates.

## Supabase Integration

### Environment Variables (Required)
```bash
# Supabase Core
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Client-side

# Storage Buckets
SUPABASE_ETIQUETAS_BUCKET=etiquetas_final
SUPABASE_ALBARANES_BUCKET=albaranes_finales
SUPABASE_ALBARANES_FOLDER=ruta/dentro/del/bucket
NEXT_PUBLIC_SUPABASE_ETIQUETAS_BUCKET=etiquetas_final

# AI Services
GOOGLE_VISION_CREDENTIALS_JSON={"type":"service_account",...}
# OR GOOGLE_VISION_CREDENTIALS_B64=base64_encoded_json
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o-mini  # Default model for order parsing

# N8N Automation
N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=...

# Optional
LABEL_TEMPLATE_PATH=/custom/path/to/template.pdf
LABEL_FONT_PATH=/custom/path/to/font.ttf
```

### Storage Buckets
Buckets must be **public** for the dashboard to retrieve files:
- `albaranes_finales` - Delivery notes
- `etiquetas_final` - Final label PDFs
- `pedidos_subidos` - Uploaded order files
- `grande_final`, `grande2_final` - Lidl-specific buckets

File paths follow pattern: `{bucket}/{folder}/{filename}_{timestamp}.pdf`

### Database Tables
- `pedidos_subidos` - Uploaded order files metadata
- `inventory` - Product stock levels (real-time subscriptions)
- `facturas` - Generated invoices (invoice_path, anexo_path, metadata)
- `spreadsheets` - Spreadsheet metadata (id, user_id, name, header_data JSONB, archived_at, timestamps)
- `spreadsheets_rows` - Spreadsheet row data (position, week, dates, kg, product, price, etc.)
  - Numeric columns: `kg` (numeric), `bundles` (integer), `price` (numeric)
  - RLS: All operations filtered by `auth.uid() = user_id`

Authentication uses Supabase Auth (email/password + OAuth2).

## API Routes

### Vision Order Processing
- `POST /api/vision-orders/parse` - Parse PDF/image using OpenAI Vision
  - Converts PDF → PNG using `pdfjs-dist` + `@napi-rs/canvas`
  - Extracts: client name, products, quantities
  - Returns structured JSON
- `POST /api/vision-orders/generate` - Generate labels from parsed orders
  - Processes each item via `processLabelAutomation()`
  - Uploads to Supabase Storage
  - Adjusts inventory

### File Management
- `POST /api/pedidos-subidos/upload` - Upload order files
- `GET /api/pedidos-subidos/list` - List uploaded files
- `POST /api/pedidos-subidos/process` - Process uploaded order

### Stock Management
- `GET /api/stock/list` - Get inventory levels
- `POST /api/stock/adjust` - Adjust inventory (add/subtract units)

### Spreadsheets
- `POST /api/spreadsheets` - Create new spreadsheet
- `GET /api/spreadsheets` - List user's spreadsheets
- `GET /api/spreadsheets/trash` - List archived spreadsheets
- `GET /api/spreadsheets/[id]` - Get spreadsheet with rows
- `PATCH /api/spreadsheets/[id]` - Update spreadsheet + rows
- `DELETE /api/spreadsheets/[id]` - Permanently delete
- `POST /api/spreadsheets/[id]/archive` - Soft delete (archive)
- `POST /api/spreadsheets/[id]/restore` - Restore from archive
- `POST /api/spreadsheets/[id]/generate-invoice` - Generate invoice PDF + Anexo IV

### Other
- `POST /api/n8n/create` - Create N8N email automation workflow
- `POST /api/google/token` - Google OAuth token exchange
- `POST /api/storage/callback` - Storage upload callback
- `POST /api/turnstile` - Cloudflare CAPTCHA verification

## Common Workflows

### Adding a New Label Type

1. **Define the label type** in `src/lib/product-selection.ts`:
   ```typescript
   export type LabelType = 'mercadona' | 'aldi' | ... | 'new-type'
   ```

2. **Create a specialized renderer** (if complex) in `src/server/renderers/`:
   ```typescript
   // src/server/renderers/new-type-renderer.ts
   export async function renderNewTypeLabel(fields: LabelRenderFields): Promise<LabelRenderResult> {
     // Custom rendering logic
   }
   ```

3. **Update `label-renderer.ts`** to route to your renderer:
   ```typescript
   if (labelType === 'new-type') {
     return renderNewTypeLabel(fields)
   }
   ```

4. **Add template file** to `public/` (e.g., `Etiqueta-NewType.pdf`)

5. **Update `panel-config.ts`** if UI changes needed

### Modifying Label Layouts

Edit `TEXT_LAYOUT` constants in `src/server/label-renderer.ts`:
```typescript
const TEXT_LAYOUT: Record<TemplateLayoutField, LayoutEntry> = {
  fechaEnvasado: {
    baseX: 325,    // Horizontal position (pixels)
    baseY: 415,    // Vertical position (pixels)
    align: 'left', // Text alignment
    fontSize: 34   // Font size
  },
  // ... other fields
}
```

Coordinate system: Origin (0,0) is bottom-left corner.

### Debugging PDF Generation

1. **Check template file exists**: Templates must be in `public/` directory
2. **Verify font loading**: Check console for font load errors
3. **Inspect coordinates**: Use `console.log()` in `label-renderer.ts` to debug positioning
4. **Test with different data**: Empty strings or special characters may cause issues
5. **Check buffer size**: Large PDFs may timeout API routes

## Important Patterns

### Server Actions vs API Routes
- **Server Actions**: Not heavily used in this codebase
- **API Routes**: Primary pattern for all backend operations (12 routes in `src/app/api/`)

### Client Initialization Pattern
```typescript
// Client-side (uses anon key)
import { createClient } from '@/utils/supabase/client'
const supabase = createClient()

// Server-side (uses service role key)
import { createClient as createServiceClient } from '@supabase/supabase-js'
const supabase = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### File Upload Flow
```
User uploads file
  → FormData sent to API route
  → File read as Buffer/ArrayBuffer
  → Process (parse/generate labels)
  → Upload to Supabase Storage via uploadFileToBucket()
  → Return signed URL
```

### Real-time Updates
The dashboard uses Supabase real-time subscriptions to show pending uploads count:
```typescript
const channel = supabase
  .channel('pedidos_subidos_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_subidos' }, () => {
    // Refetch data
  })
  .subscribe()
```

## Security Notes

- **CAPTCHA**: Cloudflare Turnstile on login page (`/api/turnstile`)
- **Service Role Key**: Never expose in client code (server-side only)
- **File Validation**: MIME type checks on uploads
- **Row-Level Security**: Assumed configured in Supabase

## Common Gotchas

1. **PDF imports fail in client components** - Ensure `@napi-rs/canvas` and `pdfjs-dist` stay server-side
2. **Template not found** - Check file exists in `public/` with exact case-sensitive name
3. **Font rendering issues** - Verify Arial.ttf exists or set `LABEL_FONT_PATH`
4. **Supabase bucket permissions** - Buckets must be public for dashboard file retrieval
5. **Coordinate system confusion** - PDF origin is bottom-left, not top-left
6. **Aldi trace numbers** - Auto-generated as E00001, E00002, ... E99999 (5 digits)
7. **Lidl labels** - Always generates 3 PDFs (1 base + 2 white labels)
8. **Environment variables** - Create `.env.local` with all required vars (see README.md)
9. **Spreadsheet data types** - API returns numeric fields (`kg`, `bundles`, `price`) as JavaScript numbers, but client stores everything as strings. Always wrap with `String()` when loading from API to avoid `.trim()` crashes
10. **Invoice from spreadsheet** - Uses server Supabase client (not browser client) to avoid RLS issues when writing to `facturas` table from API routes

## Repository Conventions

- **UI text**: Spanish (labels, error messages, user-facing strings)
- **Code**: English (variables, functions, types, technical comments)
- **Commit messages**: Conventional commits in English (e.g., `feat: add spreadsheet UI components`, `fix: resolve trim crash`)
- **Branches/Issues**: English titles to avoid problems with accents and special characters
- **Plans**: Always write implementation plans in `.ai/plans/` and get developer approval BEFORE implementing
- **No tests**: Manual testing via UI is the current workflow
- **TypeScript**: Strict mode enabled, but `@ts-nocheck` used in `label-renderer.ts` due to pdf-lib types
- **GitHub Board**: Columns: Ready, In Progress, Review
