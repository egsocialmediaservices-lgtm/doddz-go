-- ================================================================
-- Doddz Go — تقفية سياسات RLS السمحة (اختياري لكن مهم قبل الإطلاق)
--
-- اللي طلع من الـdiagnostic بتاعك — سياسات بتدي صلاحية لأي حساب:
--   products    : "Auth manage products"            ALL    using(true)
--   products    : "Auth insert products"            INSERT using(true)
--   products    : "Owner or admin update products"  UPDATE using(true)
--   products    : "Owner or admin delete products"  DELETE (owner_id = auth.uid() OR true)
--                 ← أي حساب مسجّل يقدر يمسح أي منتج في المتجر
--   orders      : "Auth read orders" + "Authenticated read orders"    SELECT using(true)
--   orders      : "Auth update orders" + "Authenticated update orders" UPDATE using(true)
--   order_items : "Auth/Authenticated read order items"              SELECT using(true)
--                 ← أي مسجّل يقدر يقرأ أسماء وتليفونات وعناوين كل العملاء
--
-- السياسات دي PERMISSIVE (بتتعمل OR مع غيرها)، والنسخة الضيقة منها
-- موجودة فعلًا (is_admin() أو المالك) — فالسكربت بيشيل الواسعة بس.
--
-- ⚠️ قبل التشغيل: لازم يكون في حساب واحد على الأقل role='admin' في profiles
--    (القسم 5 في supabase-setup-all.sql). غير كده لوحة الأدمن هتقف.
--    بعد التشغيل جرّب فورًا: دخول الأدمن → تعديل منتج → حذف منتج.
-- ================================================================

-- 0) فحص أمان: لو مفيش أدمن مسجّل في profiles، وقف من غير ما تنفّذ حاجة
do $$
declare
  admin_count int;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';
  if admin_count = 0 then
    raise exception 'إيقاف: مفيش أي حساب role=admin في profiles. شغّل القسم 5 في supabase-setup-all.sql الأول (تحديد حسابك كأدمن) وبعدين كرر السكربت ده.';
  end if;
  raise notice 'عدد حسابات الأدمن: %', admin_count;
end;
$$;

-- 1) products
drop policy if exists "Auth manage products" on public.products;
drop policy if exists "Auth insert products" on public.products;
drop policy if exists "Owner or admin update products" on public.products;
drop policy if exists "Owner or admin delete products" on public.products;

-- 2) orders
drop policy if exists "Auth read orders" on public.orders;
drop policy if exists "Authenticated read orders" on public.orders;
drop policy if exists "Auth update orders" on public.orders;
drop policy if exists "Authenticated update orders" on public.orders;

-- 3) order_items
drop policy if exists "Auth read order items" on public.order_items;
drop policy if exists "Authenticated read order items" on public.order_items;

-- 4) سياسة حذف منتجات احتياطية (لو كل السياسات الضيقة اتمسحت بالغلط)
drop policy if exists "products_delete_owner_or_admin" on public.products;
create policy "products_delete_owner_or_admin"
  on public.products
  for delete to authenticated
  using (public.is_admin() or owner_id = auth.uid());

-- 5) منع تصعيد الصلاحية: policy بتاعة profiles سمحة لأي حساب يكتب أي صف،
--    يعني زائر يقدر يغيّر role بتاعه لـ 'admin'. التريجر ده بيرفض ده
--    من غير ما يلمس السياسات (فمفيش خطر كسر حاجة شغالة).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- من SQL Editor أو أدوات الأدمن مفيش JWT، فـ auth.uid() فاضي:
  -- ده بيخليك تقدر تعيّن نفسك أدمن من هنا، لكن مستحيل عن طريق المتصفح
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.role := old.role;
  else
    new.role := 'visitor';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- 6) مراجعة: السياسات اللي لسه شرطها true
select
  c.relname as table_name,
  p.polname as policy_name,
  case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'u' then 'UPDATE'
                when 'd' then 'DELETE' when '*' then 'ALL' end as command,
  pg_get_expr(p.polqual, p.polrelid) as using_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname in ('products', 'orders', 'order_items')
  and coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') ilike '%true%'
order by c.relname, p.polname;
-- المفروض يفضل بعد التشغيل: سياسات الإدراج فقط (لازم guest checkout يشتغل)
