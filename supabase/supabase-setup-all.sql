-- ================================================================
-- Doddz Go — السكريبت الكامل (يشغّل مرة واحدة)
-- التشغيل: Supabase Dashboard → SQL Editor → الصق المحتوى كله → Run
-- آمن للتكرار: لو نفّذته قبل كده مش هيعمل مشاكل
-- ================================================================


-- ================================================================
-- 0) إصلاح عاجل: أي مشترٍ مسجّل دخوله كان طلبه بيفشل
--    السبب: قيد في القاعدة بيرفض order_items لأي مستخدم
--    ("غير مسموح بتعديل منتج مش ملكك") — وده بيمنع كل مشترٍ
--    من إتمام الطلب، والمشترٍ مش المفروض يملك المنتج.
-- ================================================================

-- (اختياري لكن مفيد) شوف القيود الموجودة قبل الإصلاح — في Output/Notices
do $$
declare r record;
begin
  raise notice '── policies على order_items ──';
  for r in select policyname, permissive, cmd, with_check
           from pg_policies
           where schemaname = 'public' and tablename = 'order_items'
  loop
    raise notice '% | permissive=% | cmd=% | check=%', r.policyname, r.permissive, r.cmd, r.with_check;
  end loop;

  raise notice '── triggers على order_items ──';
  for r in select tg.tgname, p.proname
           from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
           where tg.tgrelid = 'public.order_items'::regclass and not tg.tgisinternal
  loop
    raise notice 'trigger: % (function: %)', r.tgname, r.proname;
  end loop;
end $$;

-- أ) السماح لأي زائر أو مشترك بإضافة تفاصيل طلب
drop policy if exists "order_items_insert_any" on public.order_items;
create policy "order_items_insert_any"
  on public.order_items
  for insert to anon, authenticated
  with check (true);

-- ب) حذف أي سياسة RESTRICTIVE تمنع إضافة التفاصيل للمشتركين
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'order_items'
      and permissive = 'RESTRICTIVE'
      and cmd in ('INSERT', 'ALL')
  loop
    execute format('drop policy %I on public.order_items', r.policyname);
    raise notice 'تم حذف سياسة قيدية من order_items: %', r.policyname;
  end loop;
end $$;

-- ج) لو القيد ده trigger على order_items — نشيل التريجر ده بالذات
do $$
declare r record;
begin
  raise notice '── دوال تحتوي رسالة الملكية ──';
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%ملكك%'
  loop
    raise notice 'function: %', r.proname;
  end loop;

  for r in
    select tg.tgname
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_proc  p on p.oid = tg.tgfoid
    where c.relname = 'order_items'
      and c.relnamespace = 'public'::regnamespace
      and not tg.tgisinternal
      and (p.prosrc like '%ملكك%' or p.prosrc like '%not own%')
  loop
    execute format('drop trigger %I on public.order_items', r.tgname);
    raise notice 'تم حذف تريجر من order_items: %', r.tgname;
  end loop;
end $$;

-- د) التأكد إن الطلب نفسه ينفع ينحفظ من أي زائر أو مشترك
drop policy if exists "orders_insert_any" on public.orders;
create policy "orders_insert_any"
  on public.orders
  for insert to anon, authenticated
  with check (true);

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and permissive = 'RESTRICTIVE'
      and cmd in ('INSERT', 'ALL')
  loop
    execute format('drop policy %I on public.orders', r.policyname);
    raise notice 'تم حذف سياسة قيدية من orders: %', r.policyname;
  end loop;
end $$;

-- لو لسه طلب المشترك بيرفض بنفس الرسالة (يعني القيد جوه دالة داخل تريجر):
-- الـNOTices فوق هتقول اسم الدالة/التريجر. الحل المؤقت (يقفّل خصم المخزون تلقائيًا):
-- alter table public.order_items disable trigger user;
-- رجّعه بـ: alter table public.order_items enable trigger all;


-- ================================================================
-- 1) حجوزات الحلاقين (توصل للأدمن من أي جهاز)
-- ================================================================

create table if not exists public.barber_bookings (
  id             text primary key,
  barber_id      text not null,
  barber_name    text,
  service_id     text,
  service_name   text,
  duration_min   integer,
  price          numeric,
  travel_fee     numeric default 0,
  extra_fee      numeric default 0,
  total_price    numeric,
  location_type  text default 'salon',
  address        text,
  customer_area  text,
  customer_name  text not null,
  customer_phone text not null,
  date           date not null,
  time           text not null,
  notes          text,
  status         text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

alter table public.barber_bookings enable row level security;

-- أي زائر يقدر ينشئ حجز (العميل مش محتاج حساب)
drop policy if exists "bookings_insert_public" on public.barber_bookings;
create policy "bookings_insert_public"
  on public.barber_bookings
  for insert to anon, authenticated
  with check (true);

-- الزائر يقرأ «المواعيد المحجوزة» فقط — أعمدة محدودة بدون بيانات عملاء
revoke select on public.barber_bookings from anon;
grant select (barber_id, date, time, status) on public.barber_bookings to anon;

drop policy if exists "bookings_select_slots_anon" on public.barber_bookings;
create policy "bookings_select_slots_anon"
  on public.barber_bookings
  for select to anon
  using (true);

-- المسجّل دخوله (الأدمن/الحلاق) يقرأ ويحدّث كل البيانات
drop policy if exists "bookings_select_auth" on public.barber_bookings;
create policy "bookings_select_auth"
  on public.barber_bookings
  for select to authenticated
  using (true);

drop policy if exists "bookings_update_auth" on public.barber_bookings;
create policy "bookings_update_auth"
  on public.barber_bookings
  for update to authenticated
  using (true)
  with check (true);

-- منع حجز نفس الموعد مرتين (الملغي بيحرّر الموعد تلقائيًا)
create unique index if not exists barber_bookings_unique_slot
  on public.barber_bookings (barber_id, date, time)
  where status <> 'cancelled';


-- ================================================================
-- 2) حسابات المستخدمين (profiles)
--    أي مستخدم يسجّل يتحط تلقائيًا في Supabase
-- ================================================================

-- السماح بالأدوار كلها (السبب إن تسجيل الزائر كان بيفشل silently)
-- نشيل أي قيد CHECK قديم على عمود role (بأي اسم كان)
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
    raise notice 'تم حذف قيد قديم على profiles.role: %', r.conname;
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('visitor', 'seller', 'admin', 'merchant', 'service_provider'));

-- أعمدة العنوان وبيانات الزائر
alter table public.profiles
  add column if not exists phone        text,
  add column if not exists governorate  text,
  add column if not exists area         text,
  add column if not exists street       text,
  add column if not exists building     text,
  add column if not exists floor        text;

alter table public.profiles enable row level security;

-- المسجّل دخوله يقرأ ويكتب (نفس نموذج باقي الجداول في المشروع)
drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth"
  on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "profiles_insert_auth" on public.profiles;
create policy "profiles_insert_auth"
  on public.profiles
  for insert to authenticated
  with check (true);

drop policy if exists "profiles_update_auth" on public.profiles;
create policy "profiles_update_auth"
  on public.profiles
  for update to authenticated
  using (true)
  with check (true);

-- إنشاء صف profile تلقائيًا مع كل تسجيل جديد (حتى لو تأكيد الإيميل مفعّل)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, phone)
  values (
    new.id,
    'visitor',
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- تنظيف اللي اتسجل قبل كده (الحسابات الموجودة حاليًا مالهاش صفوف في profiles)
insert into public.profiles (id, role, display_name, phone)
select
  u.id,
  'visitor',
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  nullif(u.raw_user_meta_data->>'phone', '')
from auth.users u
on conflict (id) do nothing;


-- ================================================================
-- 3) ربط الطلبات بحساب الزائر
-- ================================================================

alter table public.orders
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_user_id_idx
  on public.orders (customer_user_id);

-- الزائر المسجّل يشوف طلباته هو فقط (سياسة إضافية — مش بتأثر على الأدمن)
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders
  for select to authenticated
  using (customer_user_id = auth.uid());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
  on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.customer_user_id = auth.uid()
  ));


-- ================================================================
-- 4) تتبع الطلب برقم الأوردر + رقم الموبايل (لأي زائر)
-- ================================================================

create or replace function public.track_order(p_order_id text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  items json;
begin
  select * into o
  from public.orders
  where trim(customer_phone) = trim(p_phone)
    and (
      id = trim(p_order_id)
      or upper(right(id, 8)) = upper(trim(p_order_id))
    )
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(json_agg(json_build_object(
    'product_name',  oi.product_name,
    'quantity',      oi.quantity,
    'unit_price',    oi.unit_price,
    'line_total',    oi.line_total,
    'product_image', oi.product_image
  )), '[]'::json)
  into items
  from public.order_items oi
  where oi.order_id = o.id;

  return json_build_object(
    'id',               o.id,
    'ref',              upper(right(o.id, 8)),
    'status',           o.status,
    'total',            o.total,
    'delivery_fee',     o.delivery_fee,
    'items_subtotal',   o.items_subtotal,
    'payment_method',   o.payment_method,
    'customer_name',    o.customer_name,
    'customer_area',    o.customer_area,
    'customer_address', o.customer_address,
    'created_at',       o.created_at,
    'items',            items
  );
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;


-- ================================================================
-- 5) (مهم للأدمن) تعيين حسابك كـ admin
--    TRIGGER فوق هيعمل كل حساب جديد بدور visitor — لو حسابك الحالي
--    مفروض يفتح Product Manager، نفّذ السطر ده بعد ما تغيّر الإيميل:
--
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@example.com');
-- ================================================================
