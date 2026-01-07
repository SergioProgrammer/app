create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  date date not null,
  customer_name text not null,
  customer_tax_id text,
  total numeric(18,2),
  currency text default 'EUR',
  file_path text,
  created_at timestamptz default now()
);

create index if not exists facturas_invoice_number_idx on public.facturas (invoice_number);
create index if not exists facturas_date_idx on public.facturas (date desc);
