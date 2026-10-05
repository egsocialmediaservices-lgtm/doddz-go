-- ================================================================
-- Doddz Go — الجداول الأساسية الستة، بالحرف زي ما هي مشغّلة على القاعدة
-- مأخوذة من تصدير القاعدة الحيّة (2026-10-03) — شوف export/DRIFT-REPORT.md
--
-- ليه الملف ده؟ الجداول دي اتعملت من داشبورد Supabase بإيد زمان، فمفيش
-- أي ملف SQL في المجلد بيعملها. من غيرها أي قاعدة جديدة تتبنى على الملفات
-- بس بتقع من أول صفحة (مالهاش profiles ولا products ولا orders).
--
-- الترتيب مهم (التبعية): profiles ← products ← orders ← order_items
--                        ← signup_requests ← barber_status
--
-- آمن على القاعدة الحالية: كل قيد متلف بـ do $$ … exception $$ فسكت لو
-- موجود، والسياسات بتتعمل drop ثم create بنفس التعريف حرفيًا.
--
-- لو ظهر مربع «Enable Row Level Security؟» أي اختيار يمشي: الملف نفسه
-- بيفعّل RLS لكل جدول في نصّه.
--
-- ⚠️ الترتيب على قاعدة جديدة: 01 → 02 → 03 → 04 → 05 → 06 → **07** → 91.
--    السياسات هنا بتستدعي `is_admin()`، فلازم تكون معرّفة قبله (بيتعرف
--    في 04 و05 و06). على القاعدة الحالية الملف ده توثيق بس — مش لازم
--    يتنفّش تاني.
--
-- ملاحظة: التعريفات بتطابق الواقع الحالي بما فيه السياسات القديمة
-- السمحة (زي `Users read own profile … OR true`). تشديدها قرار تاني
-- مشمول في DRIFT-REPORT.md نقطة ٥ — الملف ده توثيق مش توصية.
-- ================================================================

-- ══ profiles ════════════════════════════════════════════════
create table if not exists public.profiles (
  id uuid not null,
  is_admin boolean default false not null,
  role text default 'seller'::text not null,
  display_name text,
  created_at timestamp with time zone default now() not null,
  provider_type text,
  phone text,
  email text,
  governorate text,
  area text,
  street text,
  building text,
  floor text,
  category text,
  provider_id text
);

-- القيود
do $$ begin
  alter table public.profiles add constraint profiles_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['barbers'::text, 'carwash'::text, 'handmade'::text, 'merchants'::text]))));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_provider_type_check CHECK (((provider_type = ANY (ARRAY['merchant'::text, 'service_provider'::text])) OR (provider_type IS NULL)));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['visitor'::text, 'seller'::text, 'admin'::text, 'merchant'::text, 'service_provider'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

-- RLS
alter table public.profiles enable row level security;

-- الفهارس
CREATE INDEX IF NOT EXISTS profiles_category_idx ON public.profiles USING btree (category);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_uidx ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

-- السياسات
drop policy if exists "Admin can manage profiles" on public.profiles;
create policy "Admin can manage profiles" on public.profiles as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Auth update profiles" on public.profiles;
create policy "Auth update profiles" on public.profiles as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Auth upsert profiles" on public.profiles;
create policy "Auth upsert profiles" on public.profiles as permissive for insert to authenticated with check (true);
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles as permissive for select to authenticated using ((id = auth.uid()));
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles as permissive for select to authenticated using (((id = auth.uid()) OR true));
drop policy if exists "profiles_insert_auth" on public.profiles;
create policy "profiles_insert_auth" on public.profiles as permissive for insert to authenticated with check (true);
drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth" on public.profiles as permissive for select to authenticated using (true);
drop policy if exists "profiles_update_auth" on public.profiles;
create policy "profiles_update_auth" on public.profiles as permissive for all to authenticated using (true) with check (true);

-- ══ products ════════════════════════════════════════════════
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
do $$ begin
  alter table public.products add constraint products_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.products add constraint products_pkey PRIMARY KEY (id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.products add constraint products_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

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

-- ══ orders ══════════════════════════════════════════════════
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
do $$ begin
  alter table public.orders add constraint orders_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.orders add constraint orders_order_number_key UNIQUE (order_number);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.orders add constraint orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'shipping'::text, 'delivered'::text, 'cancelled'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

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

-- ══ order_items ═════════════════════════════════════════════
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
do $$ begin
  alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

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

-- ══ signup_requests ═════════════════════════════════════════
create table if not exists public.signup_requests (
  id uuid default gen_random_uuid() not null,
  request_type text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  business_name text,
  description text,
  status text default 'pending'::text not null,
  admin_notes text,
  created_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  category text,
  user_id uuid,
  provider_id text
);

-- القيود
do $$ begin
  alter table public.signup_requests add constraint signup_requests_pkey PRIMARY KEY (id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.signup_requests add constraint signup_requests_request_type_check CHECK ((request_type = ANY (ARRAY['merchant'::text, 'service_provider'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.signup_requests add constraint signup_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

-- RLS
alter table public.signup_requests enable row level security;

-- الفهارس
CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_pkey ON public.signup_requests USING btree (id);

-- السياسات
drop policy if exists "Admin can update signup requests" on public.signup_requests;
create policy "Admin can update signup requests" on public.signup_requests as permissive for all to public using (is_admin());
drop policy if exists "Admin can view signup requests" on public.signup_requests;
create policy "Admin can view signup requests" on public.signup_requests as permissive for select to public using (is_admin());
drop policy if exists "Anon can submit signup requests" on public.signup_requests;
create policy "Anon can submit signup requests" on public.signup_requests as permissive for insert to anon, authenticated with check ((status = 'pending'::text));
drop policy if exists "Authenticated read signup requests" on public.signup_requests;
create policy "Authenticated read signup requests" on public.signup_requests as permissive for select to authenticated using (true);
drop policy if exists "Authenticated update signup requests" on public.signup_requests;
create policy "Authenticated update signup requests" on public.signup_requests as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Public can submit signup requests" on public.signup_requests;
create policy "Public can submit signup requests" on public.signup_requests as permissive for insert to public with check (true);

-- ══ barber_status ═══════════════════════════════════════════
create table if not exists public.barber_status (
  barber_id text not null,
  status text not null,
  updated_at timestamp with time zone default now()
);

-- القيود
do $$ begin
  alter table public.barber_status add constraint barber_status_pkey PRIMARY KEY (barber_id);
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;
do $$ begin
  alter table public.barber_status add constraint barber_status_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
exception when others then
  if sqlstate not in ('42P07', '42710') then raise; end if;
end $$;

-- RLS
alter table public.barber_status enable row level security;

-- الفهارس
CREATE UNIQUE INDEX IF NOT EXISTS barber_status_pkey ON public.barber_status USING btree (barber_id);

-- السياسات
drop policy if exists "Auth write barber_status" on public.barber_status;
create policy "Auth write barber_status" on public.barber_status as permissive for all to authenticated using (true) with check (true);
drop policy if exists "Public read barber_status" on public.barber_status;
create policy "Public read barber_status" on public.barber_status as permissive for select to anon, authenticated using (true);
