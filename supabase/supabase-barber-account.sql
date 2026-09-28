-- ================================================================
-- Doddz Go — عمل حساب «حلاق» يفتح لوحة البائع فقط (من غير لوحة الأدمن)
--
-- الخطوة 1 (من الداشبورد، مش من هنا):
--   Supabase → Authentication → Users → Add user
--     Email:    حط نفس الإيميل اللي تحت في barber_email
--     Password: أي كلمة سر (6 أحرف على الأقل)
--     ✔ فعّل "Auto Confirm User" وسيبه من غير أي دور
--
-- الخطوة 2: عدّل القيم التلاتة جوه السكربت وشغّله في SQL Editor.
--
-- ملاحظات أمان:
--  * لو شغّل سكربت supabase-tighten-policies.sql فـ trg_guard_profile_role
--    بيمنع أي حساب من المتصفح يعيّن دور لنفسه — لكن SQL Editor مسموح
--    (auth.uid() بيبقى فاضي فيه)، وده المسار الصحيح لتعيين الأدوار.
--  * الدور هنا 'seller' لأنه نفس الدور اللي لوحة الأدمن بتدينه لأي طلب
--    انضمام بعد الموافقة (js/admin.js → approveRequest)، فالسلوك متطابق.
--  * provider_type='service_provider' بيخلي فورم «إضافة منتج» في اللوحة
--    يتقفل على تقديم خدمة (من غير كملة مخزون/سعر منتج) — يناسب الحلاق.
-- ================================================================

do $$
declare
  barber_email text := 'barber@example.com';   -- ← غيّره لإيميل الحساب اللي عملته
  barber_name  text := 'حلاق دودز';            -- ← الاسم الظاهر في اللوحة
  barber_phone text := '010000000000';         -- ← رقم الحلاق (11 رقم يبدأ بـ 010)
  v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(barber_email) limit 1;

  if v_uid is null then
    raise exception 'إيقاف: مفيش حساب auth بإيميل %. عمل الأول من Authentication → Add user وكرر السكربت.', barber_email;
  end if;

  insert into public.profiles (id, role, provider_type, display_name, phone)
  values (v_uid, 'seller', 'service_provider', barber_name, barber_phone)
  on conflict (id) do update
    set role          = 'seller',
        provider_type = 'service_provider',
        display_name  = coalesce(excluded.display_name, public.profiles.display_name),
        phone         = coalesce(excluded.phone, public.profiles.phone);

  raise notice 'الحساب جاهز — uid: %', v_uid;
end;
$$;

-- ================================================================
-- مراجعة: كل الحسابات اللي ليها صلاحية لوحة (غير الزوار)
--   admin             → لوحة البائع + Product Manager
--   seller/merchant/service_provider → لوحة البائع بس
-- ================================================================
select
  p.id,
  u.email,
  p.role,
  p.provider_type,
  p.display_name,
  p.phone,
  case
    when p.role = 'admin' then 'لوحة البائع + Product Manager'
    when p.role in ('seller', 'merchant', 'service_provider') then 'لوحة البائع فقط'
    else 'شراء وخدمات بس'
  end as what_he_sees
from public.profiles p
join auth.users u on u.id = p.id
order by p.role, u.email;

-- ================================================================
-- لو عايز ترجّع الحساب لزائر عادي (اختياري)
-- ================================================================
-- do $$
-- declare v_uid uuid;
-- begin
--   select id into v_uid from auth.users where lower(email) = 'barber@example.com' limit 1;
--   if v_uid is null then raise notice 'مفيش حساب بهذا الإيميل'; return; end if;
--   update public.profiles set role = 'visitor', provider_type = null where id = v_uid;
-- end $$;
