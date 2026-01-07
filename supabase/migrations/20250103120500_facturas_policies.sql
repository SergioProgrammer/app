-- Ensure bucket exists
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', true)
on conflict (id) do nothing;

-- Storage policies for bucket "facturas"
create policy "facturas_bucket_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'facturas');

create policy "facturas_bucket_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'facturas');

create policy "facturas_bucket_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'facturas')
with check (bucket_id = 'facturas');

-- Table policies for public.facturas
alter table public.facturas enable row level security;

create policy "facturas_select_authenticated"
on public.facturas
for select
to authenticated
using (true);

create policy "facturas_insert_authenticated"
on public.facturas
for insert
to authenticated
with check (true);

