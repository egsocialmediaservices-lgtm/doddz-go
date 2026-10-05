-- ================================================================
-- Doddz Go — مزامنة الملفات مع اللي مشاغل على Supabase
-- (اتعمل من تصدير live-schema في 2026-10-03 — شوف export/DRIFT-REPORT.md)
--
-- اللي هنا = حاجة موجودة على القاعدة الحيّة ومفيش أي ملف في المجلد
-- بيعملها أو بيعمل نسخة قديمة منها. يعني لو حد بنى مشروع جديد من
-- الملفات بس، هتلاقي القاعدة دي ناقصة عن الحالية.
--
-- آمن للتشغيل أكثر من مرة (create or replace + drop ... if exists)
-- ومش بيغيّر أي داتا: هيخلي نفس الحاجات اللي مشغّلة حاليًا حرفيًا.
-- ================================================================

-- ── 1) علم "خصم المخزون" بدل pg_trigger_depth() ───────────────
--     النسخة الحيّة بتستخدم app.deducting_stock (أسلم: التريجر
--     بيعلن عن نفسه صراحة قبل ما يعمل update على products).
create or replace function public.deduct_product_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform set_config('app.deducting_stock', 'on', true);

  update public.products
     set stock = greatest(0, coalesce(stock, 0) - new.quantity),
         updated_at = now()
   where id = new.product_id;

  perform set_config('app.deducting_stock', '', true);
  return new;
end;
$$;

create or replace function public.enforce_seller_product_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('app.deducting_stock', true), '') = 'on' then
    return new;
  end if;

  if not public.is_admin() then
    if old.owner_id is distinct from auth.uid() then
      raise exception 'غير مسموح بتعديل منتج مش ملكك';
    end if;
    new.owner_id := old.owner_id;
    new.status   := 'pending';
  end if;

  return new;
end;
$$;

create or replace function public.set_product_owner_and_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('app.deducting_stock', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  if auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;

  if new.status is null or new.status = '' then
    new.status := 'pending';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ── 2) is_admin() ─────────────────────────────────────────────
--     الحيّة بصيغة exists؛ بنفّذها بنفس الشكل بالضبط.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 3) enforce_seller_product_insert() — مش موجودة في أي ملف ──
--     التريجر بتاعها trg_enforce_seller_product_insert مذكور في
--     04-tighten-policies.sql في التعليقات وبس؛ الدالة نفسها اتعملت
--     من الداشبورد. دي نسخها حرفيًا زي ما هي مشغّلة.
create or replace function public.enforce_seller_product_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    new.owner_id := auth.uid();
    new.status   := 'pending';
    new.source   := 'merchant';
  end if;
  return new;
end;
$$;

-- ── 4) login_email_for_phone(p_phone) — مش موجودة في أي ملف ───
--     js/account.js و js/auth.js بيستدعوا الـ RPC دي عشان الدخول
--     برقم التليفون. من غيرها مسار الدخول بالرقم بيموت.
create or replace function public.login_email_for_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare e text;
begin
  select email into e
  from public.profiles
  where phone = p_phone
  limit 1;
  return e;
end;
$$;

-- ── 5) تريجر trg_products_owner_pending — مش موجود في أي ملف ──
--     الدالة set_product_owner_and_pending معرّفة في
--     03-fix-stock-guard.sql لكن مفيش أي ملف بيربطها بـ products.
drop trigger if exists trg_products_owner_pending on public.products;
create trigger trg_products_owner_pending
  before insert on public.products
  for each row execute function public.set_product_owner_and_pending();

-- ── مراجعة سريعة بعد التشغيل ──────────────────────────────────
select p.proname,
       case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end as security
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
 order by p.proname;

select t.tgname as trigger_name, c.relname as on_table
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not t.tgisinternal
 order by c.relname, t.tgname;
