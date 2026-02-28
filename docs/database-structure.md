# Database Structure

## Database Tables

### pedidos_subidos
Uploaded order files metadata.

### inventory
Product stock levels. Supports real-time subscriptions for live dashboard updates.

### facturas
Generated invoices.
- `invoice_path` - Path to invoice PDF in storage
- `anexo_path` - Path to Anexo IV PDF in storage
- Additional metadata fields

### spreadsheets
Spreadsheet metadata.
- `id` - UUID primary key
- `user_id` - Owner (foreign key to auth.users)
- `name` - Spreadsheet name
- `header_data` - JSONB with invoice header fields
- `archived_at` - Soft delete timestamp (null = active)
- `created_at`, `updated_at` - Timestamps

### spreadsheets_rows
Spreadsheet row data.
- `position` - Row order within spreadsheet
- `week` - Week number
- Date fields for tracking
- `kg` - numeric
- `bundles` - integer
- `price` - numeric
- `product` - Product name
- Other order-specific fields

**RLS**: All operations filtered by `auth.uid() = user_id`.

## Storage Buckets

Buckets must be **public** for the dashboard to retrieve files.

| Bucket | Purpose |
|--------|---------|
| `albaranes_finales` | Delivery notes |
| `etiquetas_final` | Final label PDFs |
| `pedidos_subidos` | Uploaded order files |
| `grande_final`, `grande2_final` | Lidl-specific buckets |

File path pattern: `{bucket}/{folder}/{filename}_{timestamp}.pdf`

## Authentication

Supabase Auth with email/password + OAuth2.
