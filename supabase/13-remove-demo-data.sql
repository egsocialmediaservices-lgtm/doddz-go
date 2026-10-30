-- ================================================================
-- 13 — مسح الأنشطة التجريبية وحساباتها (وإبقاء «صالون بشري» بس)
-- ================================================================
-- المطلوب: نشيل الحسابات التجريبية اللي كانت معمولة للتست، وسيب
-- «صالون بشري» كما هو — هو النشاط الحقيقي الوحيد دلوقتي.
--
-- اللي بيمسحه الملف ده (٩ أنشطة + متعلقاتها + حسابات الدخول بتاعتها):
--   قصها    : barber_01 (كريم فيصل) / barber_02 (أحمد نادي) /
--             barber_03 (محمود سعيد) / barber_04 (يوسف حسام) /
--             srv_f7d9de9b… (صالون قصها التجريبي)
--   لمعها   : srv_a5bfa1cb… (مغسلة لمعها التجريبية)
--   انامل   : srv_923a9a94… (ورشة انامل التجريبية) / srv_a4724649… (بولا)
--   كسبني   : srv_18ab9ab2… (متجر كسبني التجريبي)
--
-- ومتعلقات كل نشاط: الحجوزات، حالة الحلاق (barber_status)، فريق المحل،
-- ألبوم الصور، طلبات العمالة، التقييمات، طلبات الانضمام، وصور Storage.
--
-- المنتجات: **ما بتمسحش** — اللي مربوط بنشاط تجريبي بيتفصل منه
-- (provider_id = null) بس، ويفضل معروض على إنه منتج من Doddz Go.
-- (حالياً مفيش أي منتج مربوط بأنشطة تجريبية — الـupdate ده احتياطي.)
--
-- حسابات الدخول: بتتمسح من Authentication (auth.users) — وده بيمسح
-- صف الـprofiles بتاعها أوتوماتيك (foreign key عليه on delete cascade).
-- الحسابات اللي role='admin' أو اللي لسه صاحبة نشاط تاني **ما بتمسحش**.
--
-- ⚠️ قبل التشغيل:
--   1) شغّل **الجزء 0) تحت بس** الأول (مجرد قراءة)، اتأكد إن القائمة
--      هي المقصودة بالظبط وإن «صالون بشري» مش فيها.
--   2) SQL Editor بينفّذ الملف كله transaction واحدة — لو سطر فشل كل
--      حاجة ترجع زي ما كانت، وشغّل الملف من أوله تاني.
--   3) لو مربّع «Enable RLS?» ظهر اختار **Run without RLS**.
--   4) ممنوع ALTER TABLE … DISABLE TRIGGER ALL (بيرفض 42501) —
--      التعطيل في الملف ده بالاسم، والتريجر بيرجّع شغال في نفس الملف.
--   5) القائمة دي بتشتغل بالمعرّفات (id). لو اسم نشاط اتغيّر في
--      الداشبورد المعرّف يفضل هو اللي بيتشال. لو عايز تشيل نشاط
--      تاني ضيف الـid بتاعه في الجزء 0) والجزء 1).
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- 0) معاينة قبل المسح — قراءة بس، من غير أي تعديل
--    (لو عايز تتأكد الأول: ظلّل الجزء ده وسجّله لوحده)
-- ════════════════════════════════════════════════════════════════
with demo (section, id, listed_name) as (
  values
    ('barbers',   'barber_01',                             'كريم فيصل'),
    ('barbers',   'barber_02',                             'أحمد نادي'),
    ('barbers',   'barber_03',                             'محمود سعيد'),
    ('barbers',   'barber_04',                             'يوسف حسام'),
    ('barbers',   'srv_f7d9de9b32b946a0a72600d3f7d75c07',  'صالون قصها التجريبي'),
    ('carwash',   'srv_a5bfa1cb4a974010a37027e25a01720d',  'مغسلة لمعها التجريبية'),
    ('handmade',  'srv_923a9a9494d54c3ab98cc1b4bb6dc603',  'ورشة انامل التجريبية'),
    ('handmade',  'srv_a4724649fdc047e7a2b4d584a6fc12b1',  'بولا'),
    ('merchants', 'srv_18ab9ab2c999499aae8f8ac599695e8e',  'متجر كسبني التجريبي')
)
select d.section,
       d.id,
       d.listed_name,
       coalesce(b.name, c.name, h.name, m.name)                as in_db_name,
       coalesce(b.status, c.status, h.status, m.status,
                '— مش موجود في القاعدة')                        as status,
       coalesce(b.user_id, c.user_id, h.user_id, m.user_id)     as login_user_id
  from demo d
  left  join public.barber_profiles    b on b.id = d.id
  left  join public.carwash_profiles   c on c.id = d.id
  left  join public.handmade_profiles  h on h.id = d.id
  left  join public.merchant_profiles  m on m.id = d.id
 order by d.section, d.listed_name;

-- اللي هيفضل بعد المسح (مفروض يطلع سطر واحد: صالون بشري)
select 'barbers'   as section, id, name, status from public.barber_profiles
union all select 'carwash',   id, name, status  from public.carwash_profiles
union all select 'handmade',  id, name, status  from public.handmade_profiles
union all select 'merchants', id, name, status  from public.merchant_profiles
 order by 1, 3;


-- ════════════════════════════════════════════════════════════════
-- 1) قائمة الأهداف في جدول مؤقت (بينمسح لوحده في آخر الملف)
--    لو معرّف مش موجود في أي جدول قسم بيتم تجاهله بأمان.
-- ════════════════════════════════════════════════════════════════
drop table if exists public.demo_targets;
create table public.demo_targets (
  section text not null,
  id      text not null primary key,
  name    text,
  user_id uuid
);

insert into public.demo_targets (section, id)
values
  ('barbers',   'barber_01'),
  ('barbers',   'barber_02'),
  ('barbers',   'barber_03'),
  ('barbers',   'barber_04'),
  ('barbers',   'srv_f7d9de9b32b946a0a72600d3f7d75c07'),
  ('carwash',   'srv_a5bfa1cb4a974010a37027e25a01720d'),
  ('handmade',  'srv_923a9a9494d54c3ab98cc1b4bb6dc603'),
  ('handmade',  'srv_a4724649fdc047e7a2b4d584a6fc12b1'),
  ('merchants', 'srv_18ab9ab2c999499aae8f8ac599695e8e');

update public.demo_targets t
   set name = b.name, user_id = b.user_id
  from public.barber_profiles b
 where t.section = 'barbers'  and b.id = t.id;

update public.demo_targets t
   set name = c.name, user_id = c.user_id
  from public.carwash_profiles c
 where t.section = 'carwash' and c.id = t.id;

update public.demo_targets t
   set name = h.name, user_id = h.user_id
  from public.handmade_profiles h
 where t.section = 'handmade' and h.id = t.id;

update public.demo_targets t
   set name = m.name, user_id = m.user_id
  from public.merchant_profiles m
 where t.section = 'merchants' and m.id = t.id;

-- حماية إضافية: أي اسم فيه «بشري» أو «بشرى» بيطلع من القائمة فورًا
delete from public.demo_targets
 where coalesce(name, '') ilike '%بشري%'
    or coalesce(name, '') ilike '%بشرى%';

select section, id, name, user_id from public.demo_targets order by section, name;


-- ════════════════════════════════════════════════════════════════
-- 2) المتعلقات — كل جدول بيشاور على النشاط
--    الجدول اللي لسه مترفعش بيتخطى بهدوء (to_regclass).
-- ════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  n int;
begin
  for r in
    select * from (values
      ('barber_bookings',   'barber_id'),
      ('barber_status',     'barber_id'),
      ('barber_team',       'profile_id'),
      ('barber_media',      'profile_id'),
      ('staff_requests',    'provider_id'),
      ('provider_reviews',  'provider_id'),
      ('signup_requests',   'provider_id')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'الجدول % لسه مترفعش — اتخطّى', r.tbl;
      continue;
    end if;

    execute format('delete from public.%I where %I in (select id from public.demo_targets)',
                   r.tbl, r.col);
    get diagnostics n = row_count;
    raise notice '%: اتمسح % سطر', r.tbl || '.' || r.col, n;
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 3) المنتجات: تفصل عن النشاط التجريبي (ما بتمسحش)
--    التريجر الحارس بيمنع أي UPDATE على products من SQL Editor
--    («غير مسموح بتعديل منتج مش ملكك» لأن auth.uid() فاضي)،
--    فبنعطّله بالاسم جوه نفس الـtransaction ونرجّعه في الآخر.
-- ════════════════════════════════════════════════════════════════
alter table public.products disable trigger trg_enforce_seller_product_update;

update public.products
   set provider_id = null,
       updated_at  = now()
 where provider_id in (select id from public.demo_targets);

-- لو فيه منتج مسجّل باسم حساب من الحسابات التجريبية (owner_id)
update public.products p
   set owner_id   = null,
       updated_at = now()
  from public.demo_targets t
 where p.owner_id = t.user_id;

alter table public.products enable trigger trg_enforce_seller_product_update;


-- ════════════════════════════════════════════════════════════════
-- 4) صور الأنشطة في Storage (bucket: provider-media)
--    المسار: <معرف النشاط>/<نوع>/<اسم>.jpg
--    السطر ده بيشال سجلات الصور من الجدول. أحسن حاجة تمسح المجلدات
--    نفسها من واجهة Storage (Files → provider-media) عشان الملفات
--    فعلاً تتمسح من المساحة. السطر ده أمان زيادة وممكن يتخطى.
-- ════════════════════════════════════════════════════════════════
delete from storage.objects o
 where o.bucket_id = 'provider-media'
   and exists (select 1 from public.demo_targets t
                where o.name like t.id || '/%');


-- ════════════════════════════════════════════════════════════════
-- 5) حسابات الدخول (Authentication) — بحماية الأدمن وصالون بشري
--    حذف auth.users بيمسح صف profiles معه بـ on delete cascade.
-- ════════════════════════════════════════════════════════════════
drop table if exists public.demo_users;
create table public.demo_users (user_id uuid primary key);

insert into public.demo_users (user_id)
select distinct t.user_id
  from public.demo_targets t
 where t.user_id is not null;

do $$
declare
  r          record;
  owner_left int;
begin
  for r in select user_id from public.demo_users loop

    select count(*) into owner_left
      from (
        select 1 from public.barber_profiles    where user_id = r.user_id
        union all
        select 1 from public.carwash_profiles   where user_id = r.user_id
        union all
        select 1 from public.handmade_profiles  where user_id = r.user_id
        union all
        select 1 from public.merchant_profiles  where user_id = r.user_id
      ) x;

    if exists (select 1 from public.profiles
                where id = r.user_id
                  and (role = 'admin' or is_admin = true)) then
      raise notice 'حساب % أدمن — سيبناه', r.user_id;
      continue;
    end if;

    if owner_left > 0 then
      raise notice 'حساب % لسه صاحب % نشاط حي — سيبناه', r.user_id, owner_left;
      continue;
    end if;

    -- طلبات المشتري بتاعته تفضل في القاعدة بس تتفصل عن الحساب
    if to_regclass('public.orders') is not null then
      execute 'update public.orders set customer_user_id = null where customer_user_id = $1'
        using r.user_id;
    end if;

    delete from auth.users where id = r.user_id;
    raise notice '✔ اتمسح حساب الدخول %', r.user_id;
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 6) التحقق النهائي — اللي يفضل
-- ════════════════════════════════════════════════════════════════
select 'barbers'   as section, id, name, status, user_id from public.barber_profiles
union all select 'carwash',   id, name, status, user_id from public.carwash_profiles
union all select 'handmade',  id, name, status, user_id from public.handmade_profiles
union all select 'merchants', id, name, status, user_id from public.merchant_profiles
 order by 1, 3;

select id, email, role from public.profiles order by created_at;

select (select count(*) from public.barber_team)      as "فريق_فضل",
       (select count(*) from public.barber_media)     as "صور_فضل",
       (select count(*) from public.barber_bookings)  as "حجوزات_فضل",
       (select count(*) from public.barber_status)    as "حالات_فضل",
       (select count(*) from public.products)         as "كل_المنتجات",
       (select count(*) from public.products where provider_id is null) as "منتجات_غير_مرتبطة";

-- جدول الهدف المؤقت ما بقاش له لازمة
drop table if exists public.demo_users;
drop table if exists public.demo_targets;

-- ================================================================
-- ✅ بعد التشغيل:
--   * صالون بشري وحده في «قصها»، و«لمعها / انامل / كسبني» فاضية.
--   * الحسابات التجريبية مش لاينة في Authentication → Users.
--   * افتح الموقع بـ ctrl+f5: الأقسام الفاضية بتعرض رسالة
--     «لا توجد أنشطة» بدل الكروت التجريبية.
--   * المتصفحات اللي فتحت الموقع قبل كده لسه شايلة نسخة قديمة في
--     localStorage — js/barbers-data.js بتفلتر المعرّفات القديمة
--     (RETIRED_IDS) فالكروت التجريبية بتختفي من غير ما يعمل مسح بيانات.
-- ================================================================
