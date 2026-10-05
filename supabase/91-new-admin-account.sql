-- ================================================================
-- Doddz Go — عمل حساب «أدمن» (PTY Labs)
--
-- الخطوة 1 (من الداشبورد، مش من هنا):
--   Supabase → Authentication → Users → Add user
--     Email:    حط نفس الإيميل اللي تحت في admin_email
--     Password: أي كلمة سر (6 أحرف على الأقل)
--     ✔ فعّل "Auto Confirm User"
--   تريجر on_auth_user_created (دالة handle_new_user في 01-setup-all.sql)
--   بينشّئ صف profiles أوتوماتيك بدور visitor — فالخطوة 2 بتقلبه admin.
--
-- الخطوة 2: عدّل admin_email تحت وشغّل الملف في SQL Editor.
--
-- ملاحظات أمان:
--  * تعيين الأدوار مستحيل من المتصفح (تريجر trg_guard_profile_role بيرفض)،
--    وSQL Editor مسموح لأن auth.uid() بيبقى فاضي فيه — وده المسار الصحيح.
--  * الأدمن ما يحتاجش profiles.category: بوابة لوحة البائع هي category،
--    بينما لوحة الأدمن بتفحص profiles.role === 'admin' (js/admin.js).
--  * الملف idempotent: يتشغّل أكتر من مرة بأمان، ومحدّث لو الحساب موجود.
--  * phone لازم يمشي مع profiles_phone_check: '^01[0-9]{9}$' (11 رقم).
-- ================================================================

do $$
declare
  admin_email text := 'egsocialmediaservices@gmail.com';  -- ← غيّره لإيميلك
  admin_name  text := 'إدارة دودز';                        -- ← الاسم الظاهر
  admin_phone text := '';                       -- ← اسيبه فاضي بالأمان؛ الأدمن ما يحتاجش تليفون
  v_uid uuid;
begin
  select id into v_uid
    from auth.users
   where lower(email) = lower(admin_email)
   limit 1;

  if v_uid is null then
    raise exception 'إيقاف: مفيش حساب auth بإيميل %. عمل الأول من Authentication → Add user (Auto Confirm) وكرر السكربت.', admin_email;
  end if;

  insert into public.profiles (id, role, provider_type, display_name, phone)
  values (v_uid, 'admin', null, admin_name, nullif(admin_phone, ''))
  on conflict (id) do update
    set role          = 'admin',
        provider_type = null,
        display_name  = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
        phone         = coalesce(excluded.phone, public.profiles.phone);

  raise notice 'الحساب بقى أدمن — uid: %', v_uid;
end;
$$;

-- ================================================================
-- مراجعة: كل الحسابات غير الزوار (اللي ليها لوحة)
--   admin → لوحة الأدمن + لوحة البائع
--   seller / merchant / service_provider → لوحة البائع
--   visitor + category → لوحة البائع للنشاط بتاعه
-- ================================================================
select
  u.email,
  p.role,
  p.provider_type,
  p.category,
  p.display_name,
  p.phone,
  case
    when p.role = 'admin' then 'لوحة الأدمن + لوحة البائع'
    when p.role in ('seller', 'merchant', 'service_provider') then 'لوحة البائع'
    when p.category is not null then 'لوحة البائع (نشاط قسم) + شراء'
    else 'شراء وخدمات بس'
  end as what_he_sees
from public.profiles p
join auth.users u on u.id = p.id
order by (p.role = 'admin') desc, u.email;

-- ================================================================
-- لو عايزة ترجّعي الحساب لزائر عادي (اختياري)
-- ================================================================
-- update public.profiles
--    set role = 'visitor', provider_type = null
--  where id = (select id from auth.users where lower(email) = 'egsocialmediaservices@gmail.com');
