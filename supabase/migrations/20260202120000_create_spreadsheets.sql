-- Tabla principal: hojas de cálculo
create table if not exists public.spreadsheets (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sin nombre',
  user_id uuid not null,
  header_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz default null
);

-- Tabla de filas: 15 columnas fijas del inventario
create table if not exists public.spreadsheet_rows (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id uuid not null references public.spreadsheets(id) on delete cascade,
  position integer not null default 0,
  week text,
  invoice_date text,
  date text,
  final_client text,
  kg numeric(12,2),
  product text,
  box_type text,
  bundles integer,
  price numeric(12,4),
  order_number text,
  awb text,
  delivery_note text,
  invoice_number text,
  line text,
  search text
);

-- Índices
create index if not exists spreadsheets_user_id_idx on public.spreadsheets (user_id);
create index if not exists spreadsheets_archived_at_idx on public.spreadsheets (archived_at);
create index if not exists spreadsheet_rows_spreadsheet_position_idx on public.spreadsheet_rows (spreadsheet_id, position);

-- RLS: spreadsheets
alter table public.spreadsheets enable row level security;

create policy "spreadsheets_select_own"
on public.spreadsheets
for select
to authenticated
using (user_id = auth.uid());

create policy "spreadsheets_insert_own"
on public.spreadsheets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "spreadsheets_update_own"
on public.spreadsheets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "spreadsheets_delete_own"
on public.spreadsheets
for delete
to authenticated
using (user_id = auth.uid());

-- RLS: spreadsheet_rows (acceso a través de la relación con spreadsheets)
alter table public.spreadsheet_rows enable row level security;

create policy "spreadsheet_rows_select_own"
on public.spreadsheet_rows
for select
to authenticated
using (
  spreadsheet_id in (
    select id from public.spreadsheets where user_id = auth.uid()
  )
);

create policy "spreadsheet_rows_insert_own"
on public.spreadsheet_rows
for insert
to authenticated
with check (
  spreadsheet_id in (
    select id from public.spreadsheets where user_id = auth.uid()
  )
);

create policy "spreadsheet_rows_update_own"
on public.spreadsheet_rows
for update
to authenticated
using (
  spreadsheet_id in (
    select id from public.spreadsheets where user_id = auth.uid()
  )
)
with check (
  spreadsheet_id in (
    select id from public.spreadsheets where user_id = auth.uid()
  )
);

create policy "spreadsheet_rows_delete_own"
on public.spreadsheet_rows
for delete
to authenticated
using (
  spreadsheet_id in (
    select id from public.spreadsheets where user_id = auth.uid()
  )
);
