-- ================================================================
-- تشخيص (قراءة فقط): مين بيرفض "غير مسموح بتعديل منتج مش ملكك"
-- Supabase → SQL Editor → Run → ابعتلي عمود name و src للنتايج
-- ================================================================

select 'TRIGGER_ON_ORDER_ITEMS' as kind,
       tg.tgname || '  ->  fn:' || p.proname as name,
       left(p.prosrc, 1200) as src
from pg_trigger tg
join pg_class c    on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc  p    on p.oid = tg.tgfoid
where n.nspname = 'public'
  and c.relname = 'order_items'
  and not tg.tgisinternal

union all

-- التريجرز على products (ممكن يكون سبب غير مباشر)
select 'TRIGGER_ON_PRODUCTS',
       tg.tgname || '  ->  fn:' || p.proname,
       left(p.prosrc, 1200)
from pg_trigger tg
join pg_class c     on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc  p     on p.oid = tg.tgfoid
where n.nspname = 'public'
  and c.relname = 'products'
  and not tg.tgisinternal

union all

-- أي دالة في public جسمها بيحتوي الرسالة دي
select 'FUNCTION_RAISES_MSG', p.proname, left(p.prosrc, 1200)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%ملكك%'

union all

-- سياسات RLS على order_items و products
select 'POLICY_' || tablename, policyname || ' | ' || permissive || ' | ' || cmd, coalesce(with_check, qual)
from pg_policies
where schemaname = 'public'
  and tablename in ('order_items', 'products', 'orders')

order by 1;
