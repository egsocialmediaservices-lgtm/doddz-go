create table if not exists public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id text not null,
  product_id text,
  product_name text not null,
  product_image text,
  unit_price numeric not null,
  quantity integer not null,
  line_total numeric not null
);

-- القيود
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));

-- RLS
alter table public.order_items enable row level security;

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS order_items_pkey ON public.order_items USING btree (id);

-- السياسات
drop policy if exists "Admin can view order items" on public.order_items;
create policy "Admin can view order items" on public.order_items as permissive for select to public using (is_admin());
drop policy if exists "Anon can insert order items" on public.order_items;
create policy "Anon can insert order items" on public.order_items as permissive for insert to anon, authenticated with check (true);
drop policy if exists "Anyone create order items" on public.order_items;
create policy "Anyone create order items" on public.order_items as permissive for insert to anon, authenticated with check (true);
drop policy if exists "Public can create order items" on public.order_items;
create policy "Public can create order items" on public.order_items as permissive for insert to public with check (true);
drop policy if exists "order_items_delete_admin" on public.order_items;
create policy "order_items_delete_admin" on public.order_items as permissive for delete to authenticated using (is_admin());
drop policy if exists "order_items_insert_any" on public.order_items;
create policy "order_items_insert_any" on public.order_items as permissive for insert to anon, authenticated with check (true);
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.customer_user_id = auth.uid())))));
