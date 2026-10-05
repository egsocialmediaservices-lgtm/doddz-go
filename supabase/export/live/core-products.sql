create table if not exists public.products (
  id text not null,
  name text not null,
  category text default ''::text not null,
  subcategory text default ''::text,
  section text default 'sell'::text not null,
  price numeric(12,2) default 0 not null,
  old_price numeric(12,2),
  taager_cost numeric(12,2) default 0,
  stock integer default 0 not null,
  product_type text default 'physical'::text not null,
  source text default 'doddz'::text not null,
  primary_image text,
  additional_images jsonb default '[]'::jsonb not null,
  image text,
  image_class text default 'img-art'::text,
  colors jsonb default '[]'::jsonb not null,
  sizes jsonb default '[]'::jsonb not null,
  description text default ''::text,
  tags jsonb default '[]'::jsonb not null,
  badge text,
  featured boolean default false not null,
  is_best_seller boolean default false not null,
  is_new boolean default false not null,
  rating numeric(3,1) default 0 not null,
  reviews_count integer default 0 not null,
  source_product_id text,
  source_url text,
  taager_url text,
  sku text,
  brand text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  owner_id uuid,
  status text default 'approved'::text not null,
  contact_phone text,
  provider_id text
);

-- القيود
alter table public.products add constraint products_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

-- RLS
alter table public.products enable row level security;

-- الفهارس
CREATE UNIQUE INDEX IF NOT EXISTS products_pkey ON public.products USING btree (id);
CREATE INDEX IF NOT EXISTS products_provider_id_idx ON public.products USING btree (provider_id);
CREATE INDEX IF NOT EXISTS products_section_idx ON public.products USING btree (section);

-- السياسات
drop policy if exists "Authenticated can insert products" on public.products;
create policy "Authenticated can insert products" on public.products as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
drop policy if exists "Owner or admin can delete products" on public.products;
create policy "Owner or admin can delete products" on public.products as permissive for delete to public using ((is_admin() OR (owner_id = auth.uid())));
drop policy if exists "Owner or admin can update products" on public.products;
create policy "Owner or admin can update products" on public.products as permissive for all to public using ((is_admin() OR (owner_id = auth.uid())));
drop policy if exists "Public can view approved products" on public.products;
create policy "Public can view approved products" on public.products as permissive for select to public using (((status = 'approved'::text) OR is_admin() OR (owner_id = auth.uid())));
drop policy if exists "Public read approved products" on public.products;
create policy "Public read approved products" on public.products as permissive for select to public using (((status = 'approved'::text) OR (auth.role() = 'authenticated'::text)));
drop policy if exists "products_delete_owner_or_admin" on public.products;
create policy "products_delete_owner_or_admin" on public.products as permissive for delete to authenticated using ((is_admin() OR (owner_id = auth.uid())));
drop policy if exists "products_insert_authenticated" on public.products;
create policy "products_insert_authenticated" on public.products as permissive for insert to authenticated with check (true);
