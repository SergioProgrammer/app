# API Routes

All backend operations use Next.js API Routes (not Server Actions).

## Vision Order Processing

- `POST /api/vision-orders/parse` - Parse PDF/image using OpenAI Vision
  - Converts PDF -> PNG using `pdfjs-dist` + `@napi-rs/canvas`
  - Extracts: client name, products, quantities
  - Returns structured JSON
- `POST /api/vision-orders/generate` - Generate labels from parsed orders
  - Processes each item via `processLabelAutomation()`
  - Uploads to Supabase Storage
  - Adjusts inventory

## File Management

- `POST /api/pedidos-subidos/upload` - Upload order files
- `GET /api/pedidos-subidos/list` - List uploaded files
- `POST /api/pedidos-subidos/process` - Process uploaded order

## Stock Management

- `GET /api/stock/list` - Get inventory levels
- `POST /api/stock/adjust` - Adjust inventory (add/subtract units)

## Spreadsheets

- `POST /api/spreadsheets` - Create new spreadsheet
- `GET /api/spreadsheets` - List user's spreadsheets
- `GET /api/spreadsheets/trash` - List archived spreadsheets
- `GET /api/spreadsheets/[id]` - Get spreadsheet with rows
- `PATCH /api/spreadsheets/[id]` - Update spreadsheet + rows
- `DELETE /api/spreadsheets/[id]` - Permanently delete
- `POST /api/spreadsheets/[id]/archive` - Soft delete (archive)
- `POST /api/spreadsheets/[id]/restore` - Restore from archive
- `POST /api/spreadsheets/[id]/generate-invoice` - Generate invoice PDF + Anexo IV

## Other

- `POST /api/n8n/create` - Create N8N email automation workflow
- `POST /api/google/token` - Google OAuth token exchange
- `POST /api/storage/callback` - Storage upload callback
- `POST /api/turnstile` - Cloudflare CAPTCHA verification
