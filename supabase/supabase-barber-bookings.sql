-- ================================================================
-- Doddz Go — جدول حجوزات الحلاقين
-- التشغيل: Supabase Dashboard → SQL Editor → الصق المحتوى → Run
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
create policy "bookings_insert_public"
  on public.barber_bookings
  for insert to anon, authenticated
  with check (true);

-- الزائر يقرأ «المواعيد المحجوزة» فقط عشان يعرف الأوقات المتاحة —
-- أعمدة محدودة بدون أي بيانات عملاء (أسماء/تليفونات)
revoke select on public.barber_bookings from anon;
grant select (barber_id, date, time, status) on public.barber_bookings to anon;

create policy "bookings_select_slots_anon"
  on public.barber_bookings
  for select to anon
  using (true);

-- المسجّل دخوله (الأدمن/الحلاق) يقرأ ويحدّث كل البيانات
create policy "bookings_select_auth"
  on public.barber_bookings
  for select to authenticated
  using (true);

create policy "bookings_update_auth"
  on public.barber_bookings
  for update to authenticated
  using (true)
  with check (true);

-- منع حجز نفس الموعد مرتين (الملغي بيحرّر الموعد تلقائيًا)
create unique index if not exists barber_bookings_unique_slot
  on public.barber_bookings (barber_id, date, time)
  where status <> 'cancelled';
