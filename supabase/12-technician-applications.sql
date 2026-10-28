-- ================================================================
-- 12 — استمارات فنيين الحلاقة (التوظيف)
-- ================================================================
-- الصفحة: technician-apply.html  ← الفني يفتح الرابط ويملأ الاستمارة
--          بدون حساب وبدون تسجيل دخول.
--
-- الجدول الجديد: technician_applications
--   بيانات الفني: الاسم / السن / السكن / الخبرة / المرتب المتوقع /
--   التليفون / التخصصات / صورة شخصية (اختيارية) / لينك أعمال.
--
-- مين يقدر يشوف البيانات؟
--   * القراءة للوحة الأدمن بس (public.is_admin()).
--   * الفني نفسه بيشوف «حالة طلبه» فقط عن طريق كود المتابعة —
--     دالة technician_application_status() بترجّع الحالة وملاحظات
--     الإدارة بس، مش بيانات حد تاني.
--   * مفيش policy إدراج على الجدول: أي سطر جديد بييجي من دالة
--     submit_technician_application() فقط (هي اللي بتتحقق وبتنظّف).
--
-- الأمان: كل الصلاحيات في الطبقة دي (RLS + تريجر + دوال SECURITY
-- DEFINER) — مش في js. مفتاح publishable بس بيستخدم في المتصفح.
--
-- ⚠️ مهم قبل التشغيل:
--   1) SQL Editor بينفّذ الملف كله transaction واحدة — لو سطر فشل
--      كل حاجة ترجع زي ما كانت، وشغّل الملف من أوله تاني.
--   2) لو مربّع «Enable RLS?» ظهر، اختار **Run without RLS**
--      (الملف نفسه فيه أوامر enable row level security).
--   3) ممنوع ALTER TABLE ... DISABLE TRIGGER ALL (يرفض 42501).
--   4) قسم Storage (8) لو فشل، سببه إن معندكش صلاحية على schema
--      storage — اتبع البديل المكتوب جواه (إنشاء الـ Bucket من الداشبورد).
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- 1) الجدول
-- ════════════════════════════════════════════════════════════════

create table if not exists public.technician_applications (
  id                uuid primary key default gen_random_uuid(),
  track_code        text not null unique,          -- كود المتابعة اللي بيتعرض للفني
  full_name         text not null,
  phone             text not null,                 -- أرقام فقط: 01xxxxxxxxx
  alt_phone         text,
  email             text,
  certification     text,                          -- شهادة أو دورة تدريبية
  age               int  not null check (age between 16 and 70),
  governorate       text not null,                 -- المحافظة
  area              text,                          -- المنطقة / الحي
  address           text,                          -- السكن بالتفصيل
  experience_years  int  not null default 0 check (experience_years between 0 and 60),
  previous_salons   text,                          -- أماكن شغل قبل كده
  specialties       text[] not null default '{}',  -- قص / ذقن / أطفال / صبغة ...
  expected_salary   int  check (expected_salary is null or (expected_salary between 0 and 500000)),
  work_system       text check (work_system is null or
                             work_system in ('fixed','daily','percentage','flexible')),
  preferred_shift   text check (preferred_shift is null or
                             preferred_shift in ('morning','evening','flexible')),
  available_from    date,                          -- متاح يبدأ من ميعاد
  photo_url         text,                          -- اختيارية
  photo_path        text,                          -- مسار الصورة في Storage (للهذف)
  portfolio_url     text,                          -- لينك صور شغل / فيديو
  notes             text,                          -- أي كلام إضافي من الفني
  consent           boolean not null default false,
  status            text not null default 'pending'
                    check (status in ('pending','reviewing','approved','rejected','hired')),
  admin_notes       text,
  reviewed_by       uuid,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tech_apps_status_idx on public.technician_applications (status, created_at desc);
create index if not exists tech_apps_phone_idx  on public.technician_applications (phone);

alter table public.technician_applications enable row level security;

-- ════════════════════════════════════════════════════════════════
-- 2) الحارس: الحالة وكود المتابعة وملاحظات الإدارة متتكتبش من برّه
--    (حتى لو مستقبلًا اتعملت policy إدراج، السطر الجديد يفضل pending)
-- ════════════════════════════════════════════════════════════════
create or replace function public.guard_technician_application_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status      := 'pending';
    new.admin_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    if new.track_code is null or btrim(new.track_code) = '' then
      new.track_code := public.make_application_track_code();
    end if;
  else
    new.status      := old.status;
    new.admin_notes := old.admin_notes;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.track_code  := old.track_code;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_technician_applications on public.technician_applications;
create trigger trg_guard_technician_applications
  before insert or update on public.technician_applications
  for each row execute function public.guard_technician_application_row();


-- ════════════════════════════════════════════════════════════════
-- 3) كود المتابعة: TA-XXXXXXXX (عشوائي — مش تسلسل يتخمن)
--    md5 + random من غير أي extension عشان يشتغل في أي نسخة.
-- ════════════════════════════════════════════════════════════════
create or replace function public.make_application_track_code()
returns text
language sql
volatile
as $$
  select 'TA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;


-- ════════════════════════════════════════════════════════════════
-- 4) السياسات — مفيش policy INSERT: الجدول مقفول قدام المتصفح
--    والإدراج بيعدّي من الدالة security definer تحت.
--    مفيش policy SELECT لغير الأدمن: بيانات الفنيين تشوفها الإدارة بس.
-- ════════════════════════════════════════════════════════════════
drop policy if exists "tech_apps_admin_read" on public.technician_applications;
create policy "tech_apps_admin_read"
  on public.technician_applications
  for select to authenticated
  using (public.is_admin());

drop policy if exists "tech_apps_admin_write" on public.technician_applications;
create policy "tech_apps_admin_write"
  on public.technician_applications
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tech_apps_admin_delete" on public.technician_applications;
create policy "tech_apps_admin_delete"
  on public.technician_applications
  for delete to authenticated
  using (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 5) إرسال استمارة (بتتنادى من صفحة الاستمارة — بدون تسجيل دخول)
--    client.rpc('submit_technician_application', { p_full_name: ..., ... })
-- ════════════════════════════════════════════════════════════════
create or replace function public.submit_technician_application(
  p_full_name         text,
  p_phone             text,
  p_age               int,
  p_governorate       text,
  p_area              text    default null,
  p_address           text    default null,
  p_experience_years  int     default 0,
  p_previous_salons   text    default null,
  p_specialties       text[]  default '{}',
  p_expected_salary   int     default null,
  p_work_system       text    default null,
  p_preferred_shift   text    default null,
  p_available_from    date    default null,
  p_photo_url         text    default null,
  p_portfolio_url     text    default null,
  p_notes             text    default null,
  p_alt_phone       text    default null,
  p_email           text    default null,
  p_certification   text    default null,
  p_consent           boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_digits   text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_alt      text := regexp_replace(coalesce(p_alt_phone, ''), '[^0-9]', '', 'g');
  v_gov      text := nullif(btrim(coalesce(p_governorate, '')), '');
  v_area     text := nullif(btrim(coalesce(p_area, '')), '');
  v_addr     text := nullif(btrim(coalesce(p_address, '')), '');
  v_prev     text := nullif(btrim(coalesce(p_previous_salons, '')), '');
  v_port     text := nullif(btrim(coalesce(p_portfolio_url, '')), '');
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_cert     text := nullif(btrim(coalesce(p_certification, '')), '');
  v_specs    text[];
  v_age      int  := coalesce(p_age, 0);
  v_exp      int  := coalesce(p_experience_years, 0);
  v_salary   int  := p_expected_salary;
  v_sys      text := nullif(btrim(coalesce(p_work_system, '')), '');
  v_shift    text := nullif(btrim(coalesce(p_preferred_shift, '')), '');
  v_photo    text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_id       uuid;
  v_code     text;
  v_status   text;
  v_try      int;
  v_photo_path text;
  v_exists   technician_applications%rowtype;
begin
  -- ── فحص البيانات (الخطأ يطلع رسالة مفهومة للواجهة) ──────────
  if coalesce(p_consent, false) is not true then
    raise exception 'لازم توافق على حفظ بياناتك قبل الإرسال';
  end if;

  if v_name is null or char_length(v_name) < 3 then
    raise exception 'اكتب الاسم بالكامل (٣ حروف على الأقل)';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'الاسم طويل أوي';
  end if;

  -- 002 010… / 2010… / 010 123 4567 → كلها بترجع 01xxxxxxxxx
  if left(v_digits, 3) = '002' then v_digits := substr(v_digits, 4); end if;
  if length(v_digits) = 12 and left(v_digits, 2) = '20' then
    v_digits := substr(v_digits, 3);
  end if;
  if v_digits !~ '^01[0-9]{9}$' then
    raise exception 'رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01';
  end if;
  if v_alt <> '' and v_alt !~ '^01[0-9]{9}$' then
    v_alt := null;
  end if;

  if v_age < 16 or v_age > 70 then
    raise exception 'السن لازم يكون بين ١٦ و ٧٠';
  end if;
  if v_gov is null then
    raise exception 'اكتب المحافظة اللي ساكن فيها';
  end if;
  if v_exp < 0 or v_exp > 60 then
    raise exception 'سنوات الخبرة غير منطقية';
  end if;
  if v_salary is not null and (v_salary < 0 or v_salary > 500000) then
    raise exception 'المرتب المتوقع لازم يكون رقمًا صحيحًا';
  end if;
  if v_sys is not null and v_sys not in ('fixed','daily','percentage','flexible') then
    v_sys := null;
  end if;
  if v_shift is not null and v_shift not in ('morning','evening','flexible') then
    v_shift := null;
  end if;
  if v_photo is not null and left(v_photo, 5) <> 'https' then
    v_photo := null;                        -- بنقبل روابط https بس
  end if;
  if v_port is not null and (left(v_port, 5) <> 'https' or char_length(v_port) > 300) then
    v_port := null;
  end if;
  -- البريد والشهادة اختياريان: لو مش مكتوب صح بنسيبهم فاضين من غير ما نرفض الطلب
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or char_length(v_email) > 160) then
    v_email := null;
  end if;
  if v_cert is not null and char_length(v_cert) > 200 then
    v_cert := null;
  end if;

  -- التخصصات: 12 قيمة كحد أقصى، من غير فراغات ولا قيم طويلة
  select coalesce(array_agg(t), '{}'::text[]) into v_specs
    from (
      select btrim(x) as t
        from unnest(coalesce(p_specialties, '{}'::text[])) as x
       where btrim(coalesce(x, '')) <> ''
       limit 12
    ) s
   where char_length(s.t) <= 40;
  v_specs := coalesce(v_specs, '{}'::text[]);

  -- ── منع الاستمارة المكرر بنفس الرقم ──────────────────────────
  select * into v_exists
    from technician_applications
   where phone = v_digits
     and status in ('pending','reviewing','approved','hired')
   order by created_at desc
   limit 1;

  if v_exists.id is not null then
    return jsonb_build_object(
      'success',    true,
      'duplicate',  true,
      'id',         v_exists.id,
      'track_code', v_exists.track_code,
      'status',     v_exists.status
    );
  end if;

  -- ── الإدراج (الحالة بتتثبت في التريجر الحارس) ────────────────
  -- مسار الصورة في Storage بنطلعه من الرابط عشان الأدمن يقدر يمسحها
  if v_photo is not null then
    v_photo_path := nullif(split_part(v_photo, '/object/public/technician-applications/', 2), '');
    if v_photo_path = '' then v_photo_path := null; end if;
  end if;

  -- كود المتابعة بيتولّد من جديد لو اتفق إنه مستخدم قبل كده (٥ محاولات)
  for v_try in 1..5 loop
    v_code := public.make_application_track_code();
    exit when not exists (select 1 from technician_applications where track_code = v_code);
  end loop;

  insert into technician_applications (
    track_code, full_name, phone, alt_phone, email, certification, age,
    governorate, area, address,
    experience_years, previous_salons, specialties,
    expected_salary, work_system, preferred_shift, available_from,
    photo_url, photo_path, portfolio_url, notes, consent, status
  ) values (
    v_code, v_name, v_digits, nullif(v_alt, ''), v_email, v_cert, v_age,
    v_gov, v_area, v_addr,
    v_exp, v_prev, v_specs,
    v_salary, v_sys, v_shift, p_available_from,
    v_photo, v_photo_path,
    v_port, v_notes, true, 'pending'
  ) returning id, status into v_id, v_status;

  return jsonb_build_object(
    'success',    true,
    'duplicate',  false,
    'id',         v_id,
    'track_code', v_code,
    'status',     v_status
  );
end;
$$;

-- الزائر المجهول أو المستخدم المسجّل — الاتنين يقدروا يبعثوا استمارة.
grant execute on function public.submit_technician_application(
  text, text, int, text, text, text, int, text, text[], int, text, text,
  date, text, text, text, text, text, text, boolean
) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 6) الفني يتابع حالة طلبه بكود المتابعة — الحالة وملاحظات الإدارة بس
-- ════════════════════════════════════════════════════════════════
create or replace function public.technician_application_status(p_track_code text)
returns table (status text, admin_notes text, submitted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.status, a.admin_notes, a.created_at
    from technician_applications a
   where a.track_code = upper(btrim(coalesce(p_track_code, '')))
   limit 1;
$$;

grant execute on function public.technician_application_status(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 7) تحويل حالة الاستمارة من لوحة الأدمن
-- ════════════════════════════════════════════════════════════════
create or replace function public.set_technician_application_status(
  p_id          uuid,
  p_status      text,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row technician_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'الإدارة بس اللي تحوّل حالة استمارات التوظيف';
  end if;

  if p_status not in ('pending','reviewing','approved','rejected','hired') then
    raise exception 'حالة غير معروفة: %', p_status;
  end if;

  update technician_applications
     set status      = p_status,
         admin_notes = coalesce(nullif(btrim(coalesce(p_admin_notes, '')), ''), admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at  = now()
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'الاستمارة مش موجودة';
  end if;

  return jsonb_build_object('success', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

grant execute on function public.set_technician_application_status(uuid, text, text) to authenticated;

-- الأدمن يمسح استمارة (وبيلها الصورة من Storage لو موجودة)
create or replace function public.delete_technician_application(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.is_admin() then
    raise exception 'الإدارة بس اللي تمسح الاستمارات';
  end if;

  select photo_path into v_path from technician_applications where id = p_id;
  delete from technician_applications where id = p_id;

  return jsonb_build_object('success', true, 'photo_path', v_path);
end;
$$;

grant execute on function public.delete_technician_application(uuid) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 8) Storage — الصورة الشخصية (اختيارية)
--    Bucket عام اسمه technician-applications: أي زائر يرفع صورة
--    جوه مجلد apps/ بس، ومفيش policy حذف من المتصفح.
--    لو السطر ده فشل (صلاحية schema storage)، اعمل الـ Bucket
--    من الداشبورد بنفس القيم دي وشغّل الـ policies لوحدك:
--      الاسم: technician-applications · Public = ✔ · حد الحجم 3MB
--      الأنواع: image/jpeg, image/png, image/webp
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('technician-applications', 'technician-applications', true, 3145728,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tech_apps_anon_upload" on storage.objects;
create policy "tech_apps_anon_upload"
  on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'technician-applications'
    and (storage.foldername(name))[1] = 'apps'
  );

drop policy if exists "tech_apps_public_read" on storage.objects;
create policy "tech_apps_public_read"
  on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'technician-applications');


-- ================================================================
-- ✅ التحقق السريع (اختياري — استعلام قراءة بس):
--
--   select count(*) from technician_applications;
--   select proname from pg_proc
--    where proname in ('submit_technician_application',
--                      'set_technician_application_status',
--                      'technician_application_status',
--                      'delete_technician_application',
--                      'make_application_track_code');
--   select id, public from storage.buckets where id = 'technician-applications';
--
-- وفي لوحة الأدمن هتظهر تبويبة جديدة: «استمارات فنيين».
-- ================================================================
