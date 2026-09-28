-- ================================================================
-- Doddz Go — 05: طبقة الأقسام (جدول مستقل لكل قسم)
--
-- الأقسام الأربعة بقت كيانات حقيقية في Supabase بدل ما تكون نص جوه
-- عمود description:
--   قصها   → public.barber_profiles     (صاحب صالون حلاقة)
--   لمعها  → public.carwash_profiles    (صاحب مغسلة سيارات)
--   انامل  → public.handmade_profiles   (فنّان هند ميد)
--   كسبني  → public.merchant_profiles   (تاجر منتجات)
--
-- وإضافات على الجداول الموجودة:
--   public.service_categories : جدول مراجع (الكود ← الاسم ← اسم الجدول).
--   profiles.category / provider_id : القسم بتاع الحساب وصف النشاط تبعه.
--   signup_requests.category / user_id / provider_id : طلب منضبط ومربوط
--         بالحساب وبالقسم، بدل ما التخصص يكون مخبّص في نص الـdescription.
--   products.provider_id : المنتج يتابع لنشاط معيّن.
--
-- سياسة العمل (بعد اختيارك):
--   1) الحساب يشتغل فورًا: التسجيل يعمل صف النشاط بحالة 'pending'، وصاحب
--      النشاط يفتح لوحة البائع ويضيف منتجات/خدمات من حاله — وكل ده بيظهر
--      في Supabase وفي لوحة الأدمن على طول.
--   2) موافقة الأدمن = الظهور للعملاء فقط (status='approved').
--   3) الأدوار (role) ما بتتعيّنتش من المتصفح (تريجر trg_guard_profile_role
--      بيمنع ده)؛ اللي بيفتح لوحة البائع هو profiles.category.
--
-- الجداول الأربعة بنفس الشكل بالظبط (superset) عشان طبقة JS واحدة تخدمهم.
-- السكربت idempotent: يتشغّل أكتر من مرة بأمان.
-- ================================================================

-- ── 0) التأكد إن دالة is_admin() موجودة في الملفات (مش الداشبورد بس)
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    execute $ddl$
      create or replace function public.is_admin()
      returns boolean
      language sql stable security definer
      set search_path = public
      as $fn$
        select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
      $fn$;
    $ddl$;
    raise notice 'اتعملت دالة public.is_admin() — كانت معرّفة في الداشبورد بس';
  end if;
end $$;


-- ================================================================
-- 1) جدول مراجع الأقسام
-- ================================================================
create table if not exists public.service_categories (
  code          text primary key check (code in ('barbers','carwash','handmade','merchants')),
  label_ar      text not null,
  entity_label  text not null,
  section_table text not null,
  sort_order    int  not null default 0
);

insert into public.service_categories (code, label_ar, entity_label, section_table, sort_order) values
  ('barbers',   'قصها',  'صالون حلاقة',  'barber_profiles',   1),
  ('carwash',   'لمعها', 'مغسلة سيارات', 'carwash_profiles',  2),
  ('handmade',  'انامل', 'ورشة هند ميد', 'handmade_profiles', 3),
  ('merchants', 'كسبني', 'متجر / تاجر',  'merchant_profiles', 4)
on conflict (code) do update
  set label_ar      = excluded.label_ar,
      entity_label  = excluded.entity_label,
      section_table = excluded.section_table,
      sort_order    = excluded.sort_order;

alter table public.service_categories enable row level security;

drop policy if exists "service_categories_read" on public.service_categories;
create policy "service_categories_read"
  on public.service_categories
  for select to anon, authenticated
  using (true);


-- ================================================================
-- 2) الجداول الأربعة
--    * المعرّف text عشان يتوافق مع products.id و barber_bookings.barber_id
--    * حساب واحد = نشاط واحد في القسم (user_id unique)
-- ================================================================
do $$
declare t text;
begin
  foreach t in array array['barber_profiles','carwash_profiles','handmade_profiles','merchant_profiles'] loop
    execute format($f$
      create table if not exists public.%I (
        id            text primary key default ('srv_' || replace(gen_random_uuid()::text, '-', '')),
        user_id       uuid unique references public.profiles(id) on delete set null,
        name          text not null,
        owner_name    text,
        phone         text,
        governorate   text,
        area          text,
        address       text,
        description   text,
        logo_url      text,
        cover_url     text,
        services      jsonb not null default '[]'::jsonb,
        home_service  jsonb not null default '{"enabled": false}'::jsonb,
        work_days     int[] not null default array[0,1,2,3,4,5,6],
        work_start    int   not null default 10,
        work_end      int   not null default 22,
        slot_minutes  int   not null default 30,
        cancel_policy text,
        rating        numeric(3,2) not null default 0,
        reviews_count int          not null default 0,
        is_featured   boolean      not null default false,
        status        text         not null default 'pending'
                      check (status in ('pending','approved','rejected')),
        approved_at   timestamptz,
        approved_by   uuid,
        created_at    timestamptz  not null default now(),
        updated_at    timestamptz  not null default now()
      );
      create index if not exists %I on public.%I (status);
      create index if not exists %I on public.%I (area);
    $f$, t,
         t || '_status_idx', t,
         t || '_area_idx',   t);
  end loop;
end $$;

-- خصوصية «قصها»: سيرة الحلاق وصورته (نفس أسماء js/barbers-data.js)
alter table public.barber_profiles
  add column if not exists bio        text,
  add column if not exists avatar_url text;


-- ================================================================
-- 3) أعمدة الأقسام في profiles و signup_requests و products
-- ================================================================
alter table public.profiles
  add column if not exists category    text,
  add column if not exists provider_id text;

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
       and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
    raise notice 'اشيلنا قيد قديم على profiles.category: %', r.conname;
  end loop;
end $$;

alter table public.profiles add constraint profiles_category_check
  check (category is null or category in ('barbers','carwash','handmade','merchants'));

create index if not exists profiles_category_idx on public.profiles (category);

alter table public.signup_requests
  add column if not exists category    text,
  add column if not exists user_id     uuid,
  add column if not exists provider_id text;

-- التخصص القديم (كان مخبّص في description) يتحوّل لكود قسم حقيقي
update public.signup_requests
   set category = case
         when request_type in ('barber','barbers')     then 'barbers'
         when request_type = 'carwash'                 then 'carwash'
         when request_type = 'handmade'                then 'handmade'
         when request_type in ('merchant','merchants') then 'merchants'
         when lower(coalesce(description,'')) like '%code:barber%'   then 'barbers'
         when lower(coalesce(description,'')) like '%code:carwash%'  then 'carwash'
         when lower(coalesce(description,'')) like '%code:handmade%' then 'handmade'
         else null
       end
 where category is null;

-- ربط الطلب بالحساب لو نفس الإيميل اتسجل قبل كده
update public.signup_requests s
   set user_id = u.id
  from auth.users u
 where s.user_id is null
   and lower(u.email) = lower(s.email);

-- profiles.category من آخر طلب مسجّل لنفس الحساب
update public.profiles p
   set category = x.category
  from (
    select distinct on (r.user_id) r.user_id, r.category
      from public.signup_requests r
     where r.user_id is not null and r.category is not null
     order by r.user_id, r.created_at desc
  ) x
 where p.id = x.user_id
   and p.category is null;

-- المنتجات تتبع نشاط
alter table public.products
  add column if not exists provider_id text;

create index if not exists products_provider_id_idx on public.products (provider_id);
create index if not exists products_section_idx     on public.products (section);


-- ================================================================
-- 4) حارس صفوف الأنشطة: المالك + حالة الاعتماد
--    * حساب يسجّل من الموقع: user_id = auth.uid() و status = 'pending'.
--    * غير الأدمن ما يقدرش يعتمد نفسه، ولا ينقل النشاط لحساب تاني،
--      ولا يغيّر التقييم ومراجعاته.
--    * SQL Editor (auth.uid() فاضي) أو حساب أدمن: بيعدّوا عاديين.
-- ================================================================
create or replace function public.guard_provider_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is null then new.user_id := auth.uid(); end if;
    new.status      := 'pending';
    new.approved_at := null;
    new.approved_by := null;
  else
    new.user_id       := old.user_id;
    new.status        := old.status;
    new.approved_at   := old.approved_at;
    new.approved_by   := old.approved_by;
    new.rating        := old.rating;
    new.reviews_count := old.reviews_count;
    new.is_featured   := old.is_featured;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['barber_profiles','carwash_profiles','handmade_profiles','merchant_profiles'] loop
    execute format('drop trigger if exists trg_guard_%1$s on public.%1$I', t);
    execute format($f$
      create trigger trg_guard_%1$s
        before insert or update on public.%1$I
        for each row execute function public.guard_provider_row();
    $f$, t);
  end loop;
end $$;


-- ================================================================
-- 5) سياسات RLS على الجداول الأربعة
--    صاحبه يقرأه ويعدّله، والكل يشوف المعتمد، والحذف للأدمن.
--    ملاحظة: js بيبعت user_id صراحةً في الـINSERT عشان سياسة WITH CHECK
--    ما تعتمدش على ترتيب تنفيذ التريجر قبل/بعد السياسة.
-- ================================================================
do $$
declare t text;
begin
  foreach t in array array['barber_profiles','carwash_profiles','handmade_profiles','merchant_profiles'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%1$s_read" on public.%1$I', t);
    execute format($f$
      create policy "%1$s_read" on public.%1$I
        for select to anon, authenticated
        using (
          status = 'approved'
          or (auth.uid() is not null and user_id = auth.uid())
          or public.is_admin()
        );
    $f$, t);

    execute format('drop policy if exists "%1$s_insert_owner" on public.%1$I', t);
    execute format($f$
      create policy "%1$s_insert_owner" on public.%1$I
        for insert to authenticated
        with check (user_id = auth.uid() or public.is_admin());
    $f$, t);

    execute format('drop policy if exists "%1$s_update_owner" on public.%1$I', t);
    execute format($f$
      create policy "%1$s_update_owner" on public.%1$I
        for update to authenticated
        using      (user_id = auth.uid() or public.is_admin())
        with check (user_id = auth.uid() or public.is_admin());
    $f$, t);

    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$I', t);
    execute format($f$
      create policy "%1$s_delete_admin" on public.%1$I
        for delete to authenticated
        using (public.is_admin());
    $f$, t);
  end loop;
end $$;


-- ================================================================
-- 6) تسجيل نشاط من الموقع: صف القسم + profiles.category + طلب للأدمن
--    الاستدعاء:
--      client.rpc('register_provider_section', {
--        p_section: 'barbers', p_name: 'صالون كريم', p_owner_name: 'كريم',
--        p_phone: '01xxxxxxxxx', p_governorate: 'القاهرة', p_area: 'المعادي',
--        p_description: 'نبذة', p_services: [{...}]
--      })
--    SECURITY DEFINER لأن التلات عمليات لازم ينجحوا مع بعض، والدالة
--    بيلمس category/provider_id بس — الدور (role) ما بيتغيّرش إطلاقًا.
-- ================================================================
create or replace function public.register_provider_section(
  p_section     text,
  p_name        text,
  p_owner_name  text default null,
  p_phone       text default null,
  p_governorate text default null,
  p_area        text default null,
  p_address     text default null,
  p_description text default null,
  p_logo_url    text default null,
  p_services    jsonb  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_table    text;
  v_provider text;
  v_status   text;
  v_request  text;
begin
  if v_uid is null then
    raise exception 'لازم تكون مسجّل دخول الأول';
  end if;

  select section_table into v_table
    from public.service_categories
   where code = p_section;

  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'اسم النشاط مطلوب';
  end if;

  execute format($q$
    insert into public.%1$I
      (user_id, name, owner_name, phone, governorate, area, address, description, logo_url, services)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, '[]'::jsonb))
    on conflict (user_id) do update
      set name        = excluded.name,
          owner_name  = coalesce(excluded.owner_name,  public.%1$I.owner_name),
          phone       = coalesce(excluded.phone,       public.%1$I.phone),
          governorate = coalesce(excluded.governorate, public.%1$I.governorate),
          area        = coalesce(excluded.area,        public.%1$I.area),
          address     = coalesce(excluded.address,     public.%1$I.address),
          description = coalesce(excluded.description, public.%1$I.description),
          logo_url    = coalesce(excluded.logo_url,    public.%1$I.logo_url),
          services    = case when excluded.services <> '[]'::jsonb
                             then excluded.services else public.%1$I.services end,
          updated_at  = now()
    returning id, status
  $q$, v_table)
  using v_uid, btrim(p_name),
        nullif(btrim(coalesce(p_owner_name,  '')), ''),
        nullif(btrim(coalesce(p_phone,       '')), ''),
        nullif(btrim(coalesce(p_governorate, '')), ''),
        nullif(btrim(coalesce(p_area,        '')), ''),
        nullif(btrim(coalesce(p_address,     '')), ''),
        nullif(btrim(coalesce(p_description, '')), ''),
        nullif(btrim(coalesce(p_logo_url,    '')), ''),
        p_services
  into v_provider, v_status;

  -- الحساب يعرف قسمه — الدور بيفضل زي ما هو
  update public.profiles
     set category     = p_section,
         provider_id  = v_provider,
         phone        = coalesce(nullif(btrim(coalesce(p_phone, '')), ''), phone),
         display_name = coalesce(nullif(btrim(coalesce(p_owner_name, '')), ''), display_name)
   where id = v_uid;

  -- الطلب يظهر في لوحة الأدمن (قسم منضبط + مربوط بالحساب والنشاط)
  insert into public.signup_requests
    (request_type, category, user_id, provider_id, full_name, email, phone,
     business_name, description, status)
  values
    (case when p_section = 'merchants' then 'merchant' else 'service_provider' end,
     p_section, v_uid, v_provider,
     coalesce(nullif(btrim(coalesce(p_owner_name, '')), ''),
              (select email from auth.users where id = v_uid)),
     (select email from auth.users where id = v_uid),
     nullif(btrim(coalesce(p_phone, '')), ''),
     btrim(p_name),
     nullif(btrim(coalesce(p_description, '')), ''),
     'pending')
  returning id::text into v_request;

  return jsonb_build_object(
    'section',     p_section,
    'provider_id', v_provider,
    'status',      v_status,
    'request_id',  v_request
  );
end;
$$;

revoke all on function public.register_provider_section(text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.register_provider_section(text, text, text, text, text, text, text, text, text, jsonb) to authenticated;


-- ================================================================
-- 7) اعتماد / رفض نشاط — للأدمن بس (الفحص جوه الدالة بـ is_admin())
--    الاستدعاء: client.rpc('set_provider_status', { p_section, p_id, p_status })
-- ================================================================
create or replace function public.set_provider_status(
  p_section text,
  p_id      text,
  p_status  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_row   jsonb;
begin
  if not public.is_admin() then
    raise exception 'غير مسموح: الدالة دي لحساب الأدمن فقط';
  end if;

  if p_status not in ('pending','approved','rejected') then
    raise exception 'حالة غير مقبولة: %', p_status;
  end if;

  select section_table into v_table
    from public.service_categories
   where code = p_section;

  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  execute format($q$
    update public.%I
       set status      = $2,
           approved_at = case when $2 = 'approved' then now() else null end,
           approved_by = auth.uid(),
           updated_at  = now()
     where id = $1
    returning jsonb_build_object('id', id, 'name', name, 'status', status)
  $q$, v_table)
  using p_id, p_status
  into v_row;

  if v_row is null then
    raise exception 'مفيش نشاط بالمعرّف % في قسم %', p_id, p_section;
  end if;

  -- نشاط الحساب في profiles + طلب الانضمام بتاعه يتقفلوا
  update public.profiles p
     set provider_id = coalesce(p.provider_id, p_id)
    from public.signup_requests r
   where r.user_id = p.id and r.provider_id = p_id;

  update public.signup_requests
     set status = case when p_status = 'approved' then 'approved' else 'rejected' end,
         reviewed_at = now()
   where provider_id = p_id;

  return v_row;
end;
$$;

revoke all on function public.set_provider_status(text, text, text) from public;
grant execute on function public.set_provider_status(text, text, text) to authenticated;


-- ================================================================
-- 8) تغذية قسم «قصها» بالقايم اللي لسه مخزّنة في localStorage بس
--    (نفس معرّفات js/barbers-data.js عشان الحجوزات القديمة تفضل مربوطة)
-- ================================================================
insert into public.barber_profiles
  (id, name, owner_name, area, bio, phone, rating, reviews_count, is_featured, status,
   work_days, work_start, work_end, slot_minutes, cancel_policy, home_service, services)
values
  ('barber_01', 'كريم فيصل', 'كريم فيصل', 'المعادي',
   'حلاق رجالي بخبرة +10 سنين. قصات حديثة وعناية بالذقن.', '01011112222', 4.9, 128, true, 'approved',
   array[0,1,2,3,4,5], 10, 21, 30, 'يمكن الإلغاء قبل الموعد بـ 3 ساعات.',
   '{"enabled": true, "areas": ["المعادي","المقطم","دار السلام"], "travelFee": 40, "extraFee": 0, "note": "الحلاق بيجي لحد البيت في المناطق المحددة."}'::jsonb,
   '[{"id":"s1","name":"حلاقة شعر","durationMin":30,"price":120,"description":"قص وتصفيف"},{"id":"s2","name":"ذقن","durationMin":20,"price":80,"description":"تهذيب وشكل"},{"id":"s3","name":"شعر + ذقن","durationMin":45,"price":180,"description":"باقة كاملة"},{"id":"s4","name":"حلاقة أطفال","durationMin":25,"price":90,"description":"حتى 12 سنة"}]'::jsonb),

  ('barber_02', 'أحمد نادي', 'أحمد نادي', 'مدينة نصر',
   'متخصص في الـ Fade والقصات العصرية.', '01022223333', 4.7, 86, true, 'approved',
   array[0,1,2,3,4,6], 12, 22, 30, 'الإلغاء مجاني قبل 6 ساعات.',
   '{"enabled": true, "areas": ["مدينة نصر","مصر الجديدة","التجمع"], "travelFee": 50, "extraFee": 20, "note": "متاح خدمة منزلية بمناطق شرق القاهرة."}'::jsonb,
   '[{"id":"s1","name":"Skin Fade","durationMin":40,"price":150,"description":""},{"id":"s2","name":"حلاقة كلاسيك","durationMin":30,"price":110,"description":""},{"id":"s3","name":"ستايلينج","durationMin":20,"price":70,"description":"تصفيف بالمنتجات"}]'::jsonb),

  ('barber_03', 'محمود سعيد', 'محمود سعيد', 'الزمالك',
   'صالون هادئ وخدمة سريعة بدون انتظار طويل.', '01033334444', 4.6, 54, false, 'approved',
   array[1,2,3,4,5,6], 11, 20, 30, 'يمكن تعديل الموعد مرة واحدة مجاناً.',
   '{"enabled": false, "areas": [], "travelFee": 0, "extraFee": 0, "note": ""}'::jsonb,
   '[{"id":"s1","name":"حلاقة شعر","durationMin":30,"price":130,"description":""},{"id":"s2","name":"ذقن ملكي","durationMin":25,"price":95,"description":""},{"id":"s3","name":"شعر + ذقن","durationMin":50,"price":200,"description":""}]'::jsonb),

  ('barber_04', 'يوسف حسام', 'يوسف حسام', 'التجمع',
   'حلاق جديد — في انتظار موافقة الإدارة.', '01044445555', 0, 0, false, 'pending',
   array[0,1,2,3,4], 10, 18, 30, 'حسب الاتفاق.',
   '{"enabled": false, "areas": [], "travelFee": 0, "extraFee": 0, "note": ""}'::jsonb,
   '[{"id":"s1","name":"حلاقة شعر","durationMin":30,"price":100,"description":""}]'::jsonb)
on conflict (id) do nothing;

-- barber_status (جدول حالة الحلاقين القديم) بيتقدّم على التغذية
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'barber_status') then
    update public.barber_profiles p
       set status = s.status
      from public.barber_status s
     where s.barber_id = p.id
       and s.status in ('approved','rejected','pending')
       and p.status is distinct from s.status;
    raise notice 'اتظبطت حالة الحلاقين من جدول barber_status';
  end if;
end $$;


-- ================================================================
-- 9) مراجعة بعد التشغيل
-- ================================================================
select code, label_ar, entity_label, section_table
  from public.service_categories
 order by sort_order;

select
  c.relname as table_name,
  c.relrowsecurity as rls_on,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
  (select count(*) from pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal) as triggers
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('barber_profiles','carwash_profiles','handmade_profiles','merchant_profiles',
                    'service_categories','profiles','signup_requests','products')
order by c.relname;

select 'barbers'   as section, status, count(*) from public.barber_profiles   group by 2
union all select 'carwash',    status, count(*) from public.carwash_profiles  group by 2
union all select 'handmade',   status, count(*) from public.handmade_profiles group by 2
union all select 'merchants',  status, count(*) from public.merchant_profiles group by 2
order by 1, 2;

select id, status, name, area, user_id
  from public.barber_profiles
 order by status, name;

select id, email, full_name, request_type, category, user_id, provider_id, status, created_at
  from public.signup_requests
 order by created_at desc
 limit 20;
