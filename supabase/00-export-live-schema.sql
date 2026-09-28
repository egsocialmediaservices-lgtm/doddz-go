-- ================================================================
-- Doddz Go — تصدير حالة Supabase الحيّة (read-only بالكامل)
--
-- الهدف: أي حاجة متطبقة دلوقتي جوه داشبورد Supabase وموجهاش في ملف
--        في المجلد ده (جدول products، دالة is_admin()، تريجرز، سياسات
--        RLS، باكيت الصور...) تطلع مكتوبة هنا تقدر تنقلها لملف.
--
-- شغّله في SQL Editor وقولّي نتيجة الأقسام اللي فيها فرق عن الملفات
-- (خصوصًا القسم 1 والجداول في القسم 5) وأنا أحوّلها لـ migration.
-- السكربت ما بيغيّرش أي حاجة: select / pg_get_* بس.
-- ================================================================

-- ── 1) الجداول وأعمدتها في schema public ──────────────────────
select
  c.relname as table_name,
  a.attnum  as col_no,
  a.attname as column_name,
  format_type(a.atttypid, a.atttypmod) as data_type,
  not a.attnotnull as nullable,
  pg_get_expr(d.adbin, d.adrelid) as default_value,
  col_description(c.oid, a.attnum) as comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname, a.attnum;


-- ── 2) القيود (PK / FK / CHECK / UNIQUE) ──────────────────────
select
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY'
                   when 'c' then 'CHECK' when 'u' then 'UNIQUE' end as kind,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, kind, con.conname;


-- ── 3) الفهارس ────────────────────────────────────────────────
select
  tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ── 4) سياسات RLS كاملة (with_check + الأدوار + permissive) ──
select
  c.relname as table_name,
  p.polname as policy_name,
  case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'u' then 'UPDATE'
                when 'd' then 'DELETE' when '*' then 'ALL' end as command,
  p.polpermissive as permissive,
  array_to_string(array(select rolname from unnest(p.polroles) r(rolid)
                        join pg_roles ro on ro.oid = r.rolid), ',') as roles,
  pg_get_expr(p.polqual, p.polrelid) as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;


-- ── 5) حالة RLS لكل جدول (مهم: جدول من غير RLS = مكشوف) ──────
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policies_count,
  (select relreplident from pg_class x where x.oid = c.oid) as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;


-- ── 6) التريجرز (تعريفها الكامل — يشمل حارس المنتجات والمخزون) ─
select
  t.tgname as trigger_name,
  c.relname as table_name,
  pg_get_triggerdef(t.oid) as definition,
  p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public' and not t.tgisinternal
order by c.relname, t.tgname;


-- ── 7) الدوال (بما فيها is_admin و track_order والتريجر فولرز) ─
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- ── 8) الفيوز (لو أي حاجة معرّفة في الداشبورد) ────────────────
select
  c.relname as view_name,
  pg_get_viewdef(c.oid, true) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by c.relname;


-- ── 9) Storage: الباكيتات + سياساتها ──────────────────────────
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- سياسات الوصول على الكاينات (pg_policy أشمل من storage.policies هنا
-- لأن تخزينها بيعرض sh expression)
select
  c.relname as table_name,
  p.polname as policy_name,
  case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'u' then 'UPDATE'
                when 'd' then 'DELETE' when '*' then 'ALL' end as command,
  p.polpermissive as permissive,
  array_to_string(array(select rolname from unnest(p.polroles) r(rolid)
                        join pg_roles ro on ro.oid = r.rolid), ',') as roles,
  pg_get_expr(p.polqual, p.polrelid) as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
order by c.relname, p.polname;


-- ── 10) الأدوار وتراخيص الوصول على جداول public ───────────────
select
  c.relname as table_name,
  privilege_type,
  grantee
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where g.table_schema = 'public'
order by c.relname, grantee, privilege_type;


-- ── 11) عدّادات سريعة: كام صف في كل جدول (للتأكد من مكان الداتا)
select 'products' as table_name, count(*) from public.products
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'profiles', count(*) from public.profiles
union all select 'signup_requests', count(*) from public.signup_requests
union all select 'barber_status', count(*) from public.barber_status
union all select 'barber_bookings', count(*) from public.barber_bookings
order by table_name;


-- ================================================================
-- 12) (اختياري) كل حاجة في خلية واحدة — أسهل حاجة للنسخ
--     شغّل الاستعلام ده لوحده (حدّد كل النص واعمل Run)، طلع عمود
--     live_schema فيه 4 صفوف — اضغط على الخلية → Copy → البسني
--     المحتوى أو احفظه في supabase/export/live-schema.txt
--     (القسم الأول public DDL بس، بدون أي دوال نظام).
-- ================================================================
select 'functions' as part,
       (select string_agg(pg_get_functiondef(p.oid), E';\n\n')
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          join pg_am am on am.oid = p.proamid
         where n.nspname = 'public' and am.amname = 'heap') as ddl
union all
select 'policies',
       (select string_agg(
            'create policy ' || q.polname || ' on public.' || q.relname || ' ; -- ' ||
            q.cmd || ' to ' || q.roles || ' using ' || coalesce(q.using_txt,'null') ||
            ' with check ' || coalesce(q.check_txt,'null'), E'\n')
          from (
            select pol.polname, cl.relname,
              case pol.polcmd when 'r' then 'select' when 'a' then 'insert'
                   when 'u' then 'update' when 'd' then 'delete' else 'all' end as cmd,
              coalesce((select string_agg(ro.rolname, ',') from unnest(pol.polroles) rid
                          join pg_roles ro on ro.oid = rid), 'public') as roles,
              pg_get_expr(pol.polqual, pol.polrelid)     as using_txt,
              pg_get_expr(pol.polwithcheck, pol.polrelid) as check_txt
            from pg_policy pol
            join pg_class cl on cl.oid = pol.polrelid
            join pg_namespace n on n.oid = cl.relnamespace
            where n.nspname = 'public'
          ) q)
union all
select 'triggers',
       (select string_agg(pg_get_triggerdef(t.oid), E';\n')
          from pg_trigger t
          join pg_class cl on cl.oid = t.tgrelid
          join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and not t.tgisinternal)
union all
select 'tables',
       (select string_agg(
            cl.relname || ' (' ||
            (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ')
               from pg_attribute a
              where a.attrelid = cl.oid and a.attnum > 0 and not a.attisdropped
              order by a.attnum) || ') rls=' || cl.relrowsecurity, E'\n')
          from pg_class cl
          join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relkind in ('r','p')
         order by cl.relname);
