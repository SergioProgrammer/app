# ProcesIA

Agricultural label automation platform for Spanish produce suppliers. Generates supermarket-specific product labels (etiquetas) and delivery notes (albaranes) for major chains (Mercadona, Aldi, Lidl...). Uses AI vision to parse order PDFs/images and automates label generation with precise formatting requirements.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Auth/Database/Storage**: Supabase
- **PDF Generation**: pdf-lib + @pdf-lib/fontkit
- **PDF Reading**: pdfjs-dist + @napi-rs/canvas (server-side only)
- **AI Vision**: OpenAI GPT-4o-mini + Google Vision API
- **Forms**: react-hook-form + zod
- **UI**: TailwindCSS 4 + Framer Motion + lucide-react

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `env.sample` to `.env.local` and fill in the values:

```bash
cp env.sample .env.local
```

See [Environment Variables](#environment-variables) section for details.

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # 12 API endpoints (vision, storage, stock, n8n)
│   ├── panel/              # Main user dashboard
│   ├── pedidos-vision/     # AI order parsing UI
│   └── [other routes]
├── components/             # React components
├── lib/                    # Client-side utilities & config
│   ├── panel-config.ts     # Dashboard configuration
│   ├── product-selection.ts# Label types & product mappings
│   └── vision-orders.ts    # Vision order models
├── server/                 # Server-side business logic
│   ├── label-renderer.ts   # Main PDF engine (7 label types)
│   ├── label-automation.ts # Label processing pipeline
│   ├── label-ocr.ts        # Google Vision OCR
│   ├── vision-order-parser.ts # OpenAI Vision parsing
│   ├── supabase-storage.ts # Storage integration
│   ├── inventory.ts        # Stock management
│   └── renderers/          # Specialized label renderers
│       ├── aldi-renderer.ts
│       ├── lidl-renderer.ts
│       ├── hiperdino-renderer.ts
│       └── kanali-renderer.ts
├── utils/supabase/         # Supabase client initialization
├── types/                  # TypeScript type definitions
└── workflows/              # N8N workflow templates (JSON)
```

## Supported Label Types

| Type | Description |
|------|-------------|
| `mercadona` | Template-based fixed layout |
| `aldi` | Multi-label with variable lot numbers (E00001-E99999) |
| `lidl` | 3-label system (base + 2 white labels) |
| `hiperdino` | Customizable weight and lot |
| `kanali` | Dedicated design |
| `blanca-grande` | Generic large white label |
| `blanca-pequena` | Generic small white label |

## Environment Variables

Create a `.env.local` file with the following variables (see `env.sample`):

### Supabase (Required)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-role-key  # Server-side only
```

### Storage Buckets (Required)

```bash
SUPABASE_ETIQUETAS_BUCKET=etiquetas_final
SUPABASE_ALBARANES_BUCKET=albaranes_finales
SUPABASE_ALBARANES_FOLDER=path/inside/bucket
NEXT_PUBLIC_SUPABASE_ETIQUETAS_BUCKET=etiquetas_final
```

> **Note**: Buckets must be set to **public** mode for the dashboard to retrieve files.

### AI Services (Required)

```bash
OPENAI_API_KEY=sk-...
```

### Cloudflare Turnstile (Required)

```bash
TURNSTILE_SECRET_KEY=...
```

### Google OAuth (Required)

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REDIRECT_URI=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
```

### N8N Automation (Optional)

```bash
N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=...
```

## Storage Configuration

Generated files are stored in Supabase Storage buckets:

- `albaranes_finales` - Delivery notes
- `etiquetas_final` - Final label PDFs
- `pedidos_subidos` - Uploaded order files
- `grande_final`, `grande2_final` - Lidl-specific buckets

Buckets must be configured as **public** for the dashboard to retrieve files.

## API Routes

### Vision Order Processing
- `POST /api/vision-orders/parse` - Parse PDF/image using OpenAI Vision
- `POST /api/vision-orders/generate` - Generate labels from parsed orders

### File Management
- `POST /api/pedidos-subidos/upload` - Upload order files
- `GET /api/pedidos-subidos/list` - List uploaded files
- `POST /api/pedidos-subidos/process` - Process uploaded order

### Stock Management
- `GET /api/stock/list` - Get inventory levels
- `POST /api/stock/adjust` - Adjust inventory

### Other
- `POST /api/n8n/create` - Create N8N email automation workflow
- `POST /api/google/token` - Google OAuth token exchange
- `POST /api/storage/callback` - Storage upload callback
- `POST /api/turnstile` - Cloudflare CAPTCHA verification

## Important Notes

### Server-Only Dependencies

The following packages **MUST** remain server-side only (configured in `next.config.ts`):
- `@napi-rs/canvas` - Node.js native canvas
- `pdfjs-dist` - PDF parsing

**Never import these in client components.** They will cause build failures.

### PDF Coordinate System

The coordinate origin (0,0) is at the **bottom-left corner**, not top-left.

### Aldi Trace Numbers

Auto-generated as E00001, E00002, ... E99999 (5 digits).

### Lidl Labels

Always generate 3 PDFs (1 base + 2 white labels).

## Testing

This project does not have automated tests configured. Manual testing via the UI is the current workflow.
