-- ================================================================
-- Doddz Go — تحقق (للقراءة فقط) من النسخة الشغّالة دلوقتي
-- شغّله بعد supabase-fix-stock-guard.sql وأبعتلي النتيجة
-- ================================================================

-- 1) الدوال الثلاث: نفسّر النسخة الشغّالة من الأعمدة بدون قراءة النص
select
  p.proname,
  (p.prosrc ilike '%set_config%')         as uses_set_config,        -- لازم false
  (p.prosrc ilike '%to_jsonb%')           as uses_old_jsonb_variant,  -- لازم false
  (p.prosrc ilike '%pg_trigger_depth%')   as uses_trigger_depth,      -- لازم true في الحارسين
  (p.prosrc ilike '%ملكك%')               as still_raises_for_seller, -- لازم true في enforce
  p.prosecdef                             as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('deduct_product_stock',
                    'enforce_seller_product_update',
                    'set_product_owner_and_pending')
order by p.proname;

-- 2) التريجرز نفسها (توقيتها وتوصيلها)
select
  c.relname as table_name,
  t.tgname  as trigger_name,
  pg_get_triggerdef(t.oid) as definition,
  pr.proname as function_name
from pg_trigger t
join pg_class c   on c.oid = t.tgrelid
join pg_proc  pr  on pr.oid = t.tgfoid
join pg_namespace n on n.oid = pr.pronamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in ('products', 'order_items', 'orders')
order by c.relname, t.tgname;

-- 3) آخر حاجة: سياسة الحذف الخطرة (لازم 0 عشان الزائر ما مسحش منتجات المتجر)
select polname as policy_name,
       polcmd  as command,
       pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.products'::regclass
  and polcmd in ('d', '*')
order by polname;
