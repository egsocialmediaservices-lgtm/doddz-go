create table if not exists public.orders (
  id text not null,
  order_number bigint default nextval('orders_order_number_seq'::regclass) not null,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_area text,
  customer_notes text,
  items_subtotal numeric default 0 not null,
  delivery_fee numeric default 0 not null,
  total numeric default 0 not null,
  payment_method text default 'cash'::text not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  customer_user_id uuid
);

-- القيود
alter table public.orders add constraint orders_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_order_number_key UNIQUE (order_number);
alter table public.orders add constraint orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text])));
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'shipping'::text, 'delivered'::text, 'cancelled'::text])));

-- RLS
alter table public.orders enable row level security;

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS orders_customer_user_id_idx ON public.orders USING btree (customer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders USING btree (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_pkey ON public.orders USING btree (id);

-- السياسات
drop policy if exists "Admin can update orders" on public.orders;
create policy "Admin can update orders" on public.orders as permissive for all to public using (is_admin());
drop policy if exists "Admin can view orders" on public.orders;
create policy "Admin can view orders" on public.orders as permissive for select to public using (is_admin());
drop policy if exists "Anon can create orders" on public.orders;
create policy "Anon can create orders" on public.orders as permissive for insert to anon, authenticated with check (true);
drop policy if exists "Anyone create orders" on public.orders;
create policy "Anyone create orders" on public.orders as permissive for insert to anon, authenticated with check (true);
drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders" on public.orders as permissive for insert to public with check (true);
drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin" on public.orders as permissive for delete to authenticated using (is_admin());
drop policy if exists "orders_insert_any" on public.orders;
create policy "orders_insert_any" on public.orders as permissive for insert to anon, authenticated with check (true);
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders as permissive for select to authenticated using ((customer_user_id = auth.uid()));
