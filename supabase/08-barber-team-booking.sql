-- ================================================================
-- Doddz Go — 08: فريق المحل + ألبوم الصور + المواعيد + اللوكيشن + حجز بأكثر من خدمة
-- (المرحلة الأولى من تطوير قسم «قصها»)
--
-- اللي الملف ده بيعمله:
--   1) Bucket اسمه provider-media في Supabase Storage — الصور تتخزن عليه
--      بروابط قصيرة (بدل الـbase64 اللي كان بيلفّ الصورة جوه العمود نفسه).
--      صاحب النشاط بيرفع في مجلد باسم نشاطه، ومحدش يقدر يلمس ملفات غيره.
--   2) جدول barber_team  : فريق الصالون (اسم + صورة + مسمى + إنه صاحب المكان).
--   3) جدول barber_media : ألبوم الصور (gallery) وصور العينات (sample) — ٢٠ حدّ لكل نوع.
--   4) أعمدة في barber_profiles : hours (مواعيد كل يوم) و location (عنوان + إحداثيات + رابط خريطة).
--   5) أعمدة في barber_bookings : services (قائمة الخدمات المختارة) + member_id/member_name (الفني المختار).
--      وفتح الحجز في نفس الميعاد لفنيين مختلفين (المكان بقى يتشغل أكتر من زبون في نفس الساعة).
--
-- قواعد الأمان اللي ماشية هنا (نفس سياسة باقي الملفات):
--   * مفيش service key — كل التفويض في RLS + تريجرات + دوال SECURITY DEFINER.
--   * التريجر بيمنع أي حساب يعدّل صفوف نشاط مش تبعه، حتى لو كتب استعلام غلط.
--   * التقييم ومراجعاته لسه متجمّدين للمالك (guard_provider_row في 05) — المرحلة التانية هي اللي هتفتح التقييمات.
--
-- الملف idempotent: يتشغّل أكتر من مرة بأمان. ⚠️ الـSQL Editor بينفّذ الملف كله
-- كـ transaction واحدة: لو سطر فشل، كل حاجة ترجع زي ما كانت — ارجع من أول الملف.
--
-- الترتيب: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 91 → **08 (الملف ده)**
-- ================================================================


-- ================================================================
-- 1) دالة «الده بيملك النشاط ده ولا لأ؟»
--    بتستخدم في سياسات الـStorage وفي حراس الصفوف. SECURITY DEFINER
--    عشان تقدر تقرا جداول الأنشطة من غير ما تدور في RLS.
-- ================================================================
create or replace function public.owns_provider(p_provider_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from (
      select user_id, id from public.barber_profiles
      union all select user_id, id from public.carwash_profiles
      union all select user_id, id from public.handmade_profiles
      union all select user_id, id from public.merchant_profiles
    ) p
    where p.id = p_provider_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.owns_provider(text) from public;
grant execute on function public.owns_provider(text) to anon, authenticated;


-- ================================================================
-- 2) الـBucket: provider-media
--    عام للقراءة (الروابط دي بتتحط في <img src>)، والكتابة لمالك النشاط بس.
--    المسار المتفق عليه:  <معرّف_النشاط>/<اسم_ملف_عشوائي>.jpg
--    ملاحظة: لو الـinsert فشل لأن الدور مفيهوش صلاحية على storage.buckets،
--    اعمليها من الداشبورد: Storage → New bucket → provider-media → Public read.
-- ================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-media', 'provider-media', true, 6291456,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 6291456,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "provider_media_read" on storage.objects;
create policy "provider_media_read"
  on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'provider-media');

drop policy if exists "provider_media_insert_owner" on storage.objects;
create policy "provider_media_insert_owner"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-media'
    and (public.is_admin() or public.owns_provider((storage.foldername(name))[1]))
  );

drop policy if exists "provider_media_update_owner" on storage.objects;
create policy "provider_media_update_owner"
  on storage.objects
  for update to authenticated
  using      (bucket_id = 'provider-media' and (public.is_admin() or public.owns_provider((storage.foldername(name))[1])))
  with check (bucket_id = 'provider-media' and (public.is_admin() or public.owns_provider((storage.foldername(name))[1])));

drop policy if exists "provider_media_delete_owner" on storage.objects;
create policy "provider_media_delete_owner"
  on storage.objects
  for delete to authenticated
  using (bucket_id = 'provider-media' and (public.is_admin() or public.owns_provider((storage.foldername(name))[1])));


-- ================================================================
-- 3) فريق الصالون — barber_team
--    * عضو واحد بس هو «صاحب المكان» (is_owner) لكل صالون.
--    * الصور بتيجي من provider-media؛ لو فاضية الواجهة بتعرض الحرف الأول.
--    * الحد الأقصى ١٢ عضو (بيمنعه التريجر جوه).
-- ================================================================
create table if not exists public.barber_team (
  id          text primary key default ('tmr_' || replace(gen_random_uuid()::text, '-', '')),
  profile_id  text    not null references public.barber_profiles(id) on delete cascade,
  name        text    not null check (char_length(btrim(name)) between 2 and 40),
  title       text,
  photo_url   text,
  is_owner    boolean not null default false,
  active      boolean not null default true,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists barber_team_profile_idx on public.barber_team (profile_id, active, sort_order);
create unique index if not exists barber_team_one_owner_idx on public.barber_team (profile_id) where is_owner;

create or replace function public.guard_barber_team()
returns trigger
language plpgsql
as $$
declare v_count int;
begin
  -- المالك العادي: لازم يكون النشاط ده تبعه
  if auth.uid() is not null and not public.is_admin() then
    if not public.owns_provider(new.profile_id) then
      raise exception 'مفيش صلاحية: الصالون ده مش مسجّل لحسابك';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.barber_team where profile_id = new.profile_id;
    if v_count >= 12 then
      raise exception 'الحد الأقصى ١٢ عضو في الفريق';
    end if;
  else
    -- معرّف الصالون مش بيتنقل لنشاط تاني
    new.profile_id := old.profile_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_barber_team on public.barber_team;
create trigger trg_guard_barber_team
  before insert or update on public.barber_team
  for each row execute function public.guard_barber_team();

alter table public.barber_team enable row level security;

drop policy if exists "barber_team_read" on public.barber_team;
create policy "barber_team_read"
  on public.barber_team
  for select to anon, authenticated
  using (
    -- للزائر: أعضاء نشطون في صالون معتمد بس
    (
      active
      and exists (
        select 1 from public.barber_profiles p
         where p.id = barber_team.profile_id
           and p.status = 'approved'
      )
    )
    -- للمالك والأدمن: صفوف نشاطهم كاملة، حتى المتوقف منه (عشان يقدروا يرجّعوه)
    or (auth.uid() is not null and public.owns_provider(profile_id))
    or public.is_admin()
  );

drop policy if exists "barber_team_write_owner" on public.barber_team;
create policy "barber_team_write_owner"
  on public.barber_team
  for insert to authenticated
  with check (public.owns_provider(profile_id) or public.is_admin());

drop policy if exists "barber_team_update_owner" on public.barber_team;
create policy "barber_team_update_owner"
  on public.barber_team
  for update to authenticated
  using      (public.owns_provider(profile_id) or public.is_admin())
  with check (public.owns_provider(profile_id) or public.is_admin());

-- الحذف فعل يومي عادي عند صاحب النشاط (مش للأدمن بس زي جداول الأنشطة)
drop policy if exists "barber_team_delete_owner" on public.barber_team;
create policy "barber_team_delete_owner"
  on public.barber_team
  for delete to authenticated
  using (public.owns_provider(profile_id) or public.is_admin());

grant select on public.barber_team to anon, authenticated;
grant insert, update, delete on public.barber_team to authenticated;


-- ================================================================
-- 4) ألبوم الصور وصور العينات — barber_media
--    kind = 'gallery'  → صور المكان (حد ٢٠)
--    kind = 'sample'   → شغل/عينات   (حد ٢٠)
-- ================================================================
create table if not exists public.barber_media (
  id          text primary key default ('med_' || replace(gen_random_uuid()::text, '-', '')),
  profile_id  text    not null references public.barber_profiles(id) on delete cascade,
  kind        text    not null default 'gallery' check (kind in ('gallery','sample')),
  url         text    not null check (char_length(btrim(url)) > 4),
  caption     text,
  active      boolean not null default true,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists barber_media_profile_idx on public.barber_media (profile_id, kind, active, sort_order);

create or replace function public.guard_barber_media()
returns trigger
language plpgsql
as $$
declare v_count int;
declare v_profile text;
declare v_kind    text;
begin
  if tg_op = 'DELETE' then
    v_profile := old.profile_id;
    v_kind    := old.kind;
  else
    v_profile := new.profile_id;
    v_kind    := new.kind;
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if not public.owns_provider(v_profile) then
      raise exception 'مفيش صلاحية: الألبوم ده مش مسجّل لحسابك';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
      from public.barber_media
     where profile_id = v_profile and kind = v_kind;
    if v_count >= 20 then
      raise exception 'الحد الأقصى ٢٠ صورة لكل نوع';
    end if;
  elsif tg_op = 'UPDATE' then
    new.profile_id := old.profile_id;   -- الصورة ما تتنقلش لنشاط تاني
  end if;

  if tg_op <> 'DELETE' then
    new.updated_at := now();
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_barber_media on public.barber_media;
create trigger trg_guard_barber_media
  before insert or update or delete on public.barber_media
  for each row execute function public.guard_barber_media();

alter table public.barber_media enable row level security;

drop policy if exists "barber_media_read" on public.barber_media;
create policy "barber_media_read"
  on public.barber_media
  for select to anon, authenticated
  using (
    (
      active
      and exists (
        select 1 from public.barber_profiles p
         where p.id = barber_media.profile_id
           and p.status = 'approved'
      )
    )
    or (auth.uid() is not null and public.owns_provider(profile_id))
    or public.is_admin()
  );

drop policy if exists "barber_media_insert_owner" on public.barber_media;
create policy "barber_media_insert_owner"
  on public.barber_media
  for insert to authenticated
  with check (public.owns_provider(profile_id) or public.is_admin());

drop policy if exists "barber_media_update_owner" on public.barber_media;
create policy "barber_media_update_owner"
  on public.barber_media
  for update to authenticated
  using      (public.owns_provider(profile_id) or public.is_admin())
  with check (public.owns_provider(profile_id) or public.is_admin());

drop policy if exists "barber_media_delete_owner" on public.barber_media;
create policy "barber_media_delete_owner"
  on public.barber_media
  for delete to authenticated
  using (public.owns_provider(profile_id) or public.is_admin());

grant select on public.barber_media to anon, authenticated;
grant insert, update, delete on public.barber_media to authenticated;


-- ================================================================
-- 5) مواعيد ولوكيشن الصالون (على barber_profiles)
--    hours   : {"0":{"open":true,"from":10,"to":22}, "1":{...}, ...}  (0 = الأحد)
--              فاضي {} = استخدم الأعمدة القديمة work_days/work_start/work_end
--    location: {"address":"…","lat":30.05,"lng":31.23,"map_url":"https://maps…","note":"…"}
--    الاتنين jsonb عشان الواجهة تعدّلهم في ضغطة واحدة من غير ما تعمل migration كل مرة.
-- ================================================================
alter table public.barber_profiles
  add column if not exists hours    jsonb not null default '{}'::jsonb,
  add column if not exists location jsonb not null default '{}'::jsonb;

-- نفس العمودين بقوا لباقي الأقسام (لمعها/انامل/كسبني هتحتاجهم بنفس الشكل)
do $$
declare t text;
begin
  foreach t in array array['carwash_profiles','handmade_profiles','merchant_profiles'] loop
    execute format('alter table public.%I add column if not exists hours jsonb not null default ''{}''::jsonb', t);
    execute format('alter table public.%I add column if not exists location jsonb not null default ''{}''::jsonb', t);
  end loop;
end $$;


-- ================================================================
-- 6) حجز بأكثر من خدمة + فني مختار (على barber_bookings)
--    services    : [{"id":"s1","name":"قص شعر","durationMin":30,"price":120}, …]
--    member_id   : معرّف عضو الفريق؛ null = «أقرب فني متاح»
--    service_id / service_name / duration_min / price : الأعمدة القديمة
--                  بتفضل تتعبّى (مجموع المدة والسعر) عشان أي شاشة قديمة تفضل شغالة.
-- ================================================================
alter table public.barber_bookings
  add column if not exists services         jsonb not null default '[]'::jsonb,
  add column if not exists member_id        text,
  add column if not exists member_name      text,
  add column if not exists customer_user_id uuid;

create index if not exists barber_bookings_member_idx on public.barber_bookings (barber_id, date, member_id);

-- ملاحظة الحجز: مكان واحد = فني واحد في نفس الميعاد.
-- الفهرس بقى يشمل member_id عشان صالون فيه ٣ فنيين يقدر ياخد ٣ حجوزات في نفس الساعة.
drop index if exists public.barber_bookings_unique_slot;
create unique index if not exists barber_bookings_unique_slot
  on public.barber_bookings (barber_id, date, time, coalesce(member_id, ''))
  where status <> 'cancelled';


-- ================================================================
-- 7) بيانات تجريبية لفريق المحلات الموجودة (باشوف الواجهة على طول)
--    member صاحب المكان = is_owner، والصور فاضية (الواجهة تعرض الحرف الأول).
-- ================================================================
insert into public.barber_team (id, profile_id, name, title, is_owner, sort_order) values
  ('tmr_barber_01_owner',  'barber_01', 'كريم فيصل',  'صاحب الصالون', true, 0),
  ('tmr_barber_02_owner',  'barber_02', 'أحمد نادي',  'صاحب الصالون', true, 0),
  ('tmr_barber_03_owner',  'barber_03', 'محمود سعيد', 'صاحب الصالون', true, 0),
  ('tmr_barber_04_owner',  'barber_04', 'يوسف حسام',  'صاحب الصالون', true, 0),
  ('tmr_barber_01_tech01', 'barber_01', 'مروان علي',  'فني حلاقة',    false, 1),
  ('tmr_barber_01_tech02', 'barber_01', 'حسام طه',    'فني عناية بالبشرة', false, 2)
on conflict (id) do nothing;


-- ================================================================
-- 7-ب) تحديث بيانات المحلات التجريبية: الخدمات بالتصنيف + المواعيد + اللوكيشن
--      الصفوف دي اتسجلت قبل ما نضيف category / hours / location،
--      فالسحابة كانت بتغلب النسخة المحلية وتوري الخدمات من غير تقسيم.
--      الخدمات المعتمدة عند صاحب الصالون (من لوحة «الخدمات») بتفضل زي ما هي.
--      hours: 0 = الأحد. location: mapUrl هو الرابط اللي يفتح خرائط جوجل.
-- ================================================================
update public.barber_profiles set
  services = '[
    {"id":"s1","name":"حلاقة شعر","durationMin":30,"price":120,"description":"قص وتصفيف","category":"hair"},
    {"id":"s2","name":"ذقن","durationMin":20,"price":80,"description":"تهذيب وشكل","category":"beard"},
    {"id":"s3","name":"شعر + ذقن","durationMin":45,"price":180,"description":"باقة كاملة","category":"hair"},
    {"id":"s4","name":"حلاقة أطفال","durationMin":25,"price":90,"description":"حتى 12 سنة","category":"hair"},
    {"id":"s5","name":"استشوار","durationMin":25,"price":90,"description":"تصفيف بالحرارة","category":"hair"},
    {"id":"s6","name":"تنظيف بشرة","durationMin":40,"price":160,"description":"بخار وماسك وتقشير","category":"skin"}
  ]'::jsonb,
  hours = '{
    "0":{"open":true,"from":10,"to":21}, "1":{"open":true,"from":10,"to":21},
    "2":{"open":true,"from":10,"to":21}, "3":{"open":true,"from":10,"to":21},
    "4":{"open":true,"from":10,"to":21}, "5":{"open":true,"from":10,"to":21},
    "6":{"open":false,"from":10,"to":21}
  }'::jsonb,
  location = '{
    "address":"١٢ شارع ٩، المعادي الجديدة، القاهرة",
    "lat":"30.0024","lng":"31.2912",
    "mapUrl":"https://maps.google.com/?q=30.0024,31.2912",
    "note":"قدام صيدلية العزبي — الدور الأرضي"
  }'::jsonb,
  updated_at = now()
where id = 'barber_01';

update public.barber_profiles set
  services = '[
    {"id":"s1","name":"Skin Fade","durationMin":40,"price":150,"description":"","category":"hair"},
    {"id":"s2","name":"حلاقة كلاسيك","durationMin":30,"price":110,"description":"","category":"hair"},
    {"id":"s3","name":"ستايلينج","durationMin":20,"price":70,"description":"تصفيف بالمنتجات","category":"hair"},
    {"id":"s4","name":"تهذيب ذقن","durationMin":20,"price":85,"description":"","category":"beard"}
  ]'::jsonb,
  hours = '{
    "0":{"open":true,"from":12,"to":22}, "1":{"open":true,"from":12,"to":22},
    "2":{"open":true,"from":12,"to":22}, "3":{"open":true,"from":12,"to":22},
    "4":{"open":true,"from":12,"to":22}, "5":{"open":false,"from":12,"to":22},
    "6":{"open":true,"from":12,"to":22}
  }'::jsonb,
  location = '{
    "address":"شارع عباس العقاد، مدينة نصر، القاهرة",
    "lat":"30.0566","lng":"31.3317",
    "mapUrl":"https://maps.google.com/?q=30.0566,31.3317",
    "note":""
  }'::jsonb,
  updated_at = now()
where id = 'barber_02';

update public.barber_profiles set
  services = '[
    {"id":"s1","name":"حلاقة شعر","durationMin":30,"price":130,"description":"","category":"hair"},
    {"id":"s2","name":"ذقن ملكي","durationMin":25,"price":95,"description":"","category":"beard"},
    {"id":"s3","name":"شعر + ذقن","durationMin":50,"price":200,"description":"","category":"hair"}
  ]'::jsonb,
  updated_at = now()
where id = 'barber_03';

-- محلات ناس حقيقية (اتسجلت من الموقع) مبنلمسش خدماتها — دي بتتعدل من لوحة الحلاق.


-- ================================================================
-- 8) مراجعة بعد التشغيل
-- ================================================================
select id, name, "public" as is_public
  from storage.buckets
 where id = 'provider-media';

select c.relname as table_name,
       c.relrowsecurity as rls_on,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
       (select count(*) from pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal) as triggers
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('barber_team','barber_media')
 order by c.relname;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'barber_profiles'  and column_name in ('hours','location'))
     or (table_name = 'barber_bookings' and column_name in ('services','member_id','member_name','customer_user_id')))
 order by table_name, column_name;

select p.id, p.name,
       (select count(*) from public.barber_team  t where t.profile_id = p.id) as team_members,
       (select count(*) from public.barber_media m where m.profile_id = p.id and m.kind = 'gallery') as gallery_photos
  from public.barber_profiles p
 order by p.status, p.name;

-- الخدمات بقى ليها تصنيف؟ + المواعيد + اللوكيشن (استعلام دفاعي: أي عمود طلع مش jsonb
-- مطلوب بيترحل لفااضي بدل ما يفشّل الملف كله)
with cols as (
  select id, name,
         case when jsonb_typeof(services) = 'array'  then services else '[]'::jsonb end as svc,
         case when jsonb_typeof(hours)    = 'object' then hours    else '{}'::jsonb end as hrs,
         case when jsonb_typeof(location) = 'object' then location else '{}'::jsonb end as loc
  from public.barber_profiles
)
select id, name,
       jsonb_array_length(svc) as services_count,
       (select count(*) from jsonb_array_elements(svc) s where s ? 'category')       as with_category,
       (select count(*) from jsonb_array_elements(svc) s where s->>'category' = 'skin') as skin_services,
       (select count(*) from jsonb_object_keys(hrs) k) as hours_days,
       coalesce(nullif(loc->>'address',''), '-') as location_address
  from cols
 order by id;

-- ✅ لو كل ده طلع مظبوط: شغّل js/… (الخطوات في supabase/README.md) وجرّب من لوحة الحلاق.
