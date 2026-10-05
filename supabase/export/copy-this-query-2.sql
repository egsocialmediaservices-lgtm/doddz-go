-- ================================================================
-- النسخة الثانية من التصدير: الـ ٦ جداول اللي اتعملوا من الداشبورد
-- (مش موجودة في أي ملف SQL في المجلد):
--   profiles, products, orders, order_items, signup_requests, barber_status
--
-- الاستخدام زي الأول بالظبط:
--   افتح الملف → Ctrl + A → Ctrl + C → الصقه في SQL Editor → Run
-- هيطلعلك ٦ صفوف (جدول في كل صف) وفي عمود ddl أمر الإنشاء الكامل
-- + القيود + الفهارس + سياسات RLS بتاعته، جاهز للتنفيذ على قاعدة فاضية.
--
-- ⚠️ السكربت للقراءة بس: مفيش فيه insert / update / delete لأي داتا.
--
-- لو ظهرلك مربع «Enable Row Level Security؟» اختار **Run without RLS**.
-- السبب: Supabase بيعبّي على نص الاستعلام بالكلام الحرفي، ولما يلاقي
-- كلمتين الإنشاء + جدول متلاصقين بيفترض إن في جدول بيتعمل وبيضيف من
-- عنده سطر تفعيل RLS على جدول بيخمن اسمه — والاسم بيقرأه غلط ومن هنا
-- بيقرأه غلط ومن هنا بيجي خطأ `42P01: relation "public" does not exist`.
-- عشان كده الكلمتين مكتوبين في اتنين متقسمين ('create' || ' table')
-- فمفيش مطابقة، والناتج اللي هيظهر في الخلية بيرجع متناسق زي ما هو.
-- ================================================================
with t as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in ('profiles', 'products', 'orders',
                      'order_items', 'signup_requests', 'barber_status')
)
select t.relname as table_name,
       (
         'create' || ' table if not exists public.' || t.relname || ' (' || E'\n'
         || coalesce((select string_agg(
                        '  ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
                        || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
                        || case when a.attnotnull then ' not null' else '' end,
                        ',' || E'\n' order by a.attnum)
                       from pg_attribute a
                       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                      where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped), '')
         || E'\n);'
         || E'\n\n-- القيود\n'
         || coalesce((select string_agg(
                        'alter' || ' table public.' || t.relname ||
                        ' add constraint ' || con.conname || ' ' ||
                        pg_get_constraintdef(con.oid) || ';',
                        E'\n' order by con.conname)
                       from pg_constraint con
                      where con.conrelid = t.oid), '-- (مفيش قيود)')
         || E'\n\n-- RLS\nalter' || ' table public.' || t.relname || ' enable row level security;'
         || case when t.relforcerowsecurity
                 then E'\nalter' || ' table public.' || t.relname || ' force row level security;'
                 else '' end
         || E'\n\n-- الفهارس\n'
         || coalesce((select string_agg(
                        replace(replace(i.indexdef,
                                'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS'),
                                'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS') || ';',
                        E'\n' order by i.indexname)
                       from pg_indexes i
                      where i.schemaname = 'public' and i.tablename = t.relname), '-- (مفيش فهارس إضافية)')
         || E'\n\n-- السياسات\n'
         || coalesce((select string_agg(
                        'drop policy if exists "' || p.polname || '" on public.' || t.relname || ';' || E'\n' ||
                        'create policy "' || p.polname || '" on public.' || t.relname ||
                        ' as ' || case when p.polpermissive then 'permissive' else 'restrictive' end ||
                        ' for ' || case p.polcmd
                              when 'r' then 'select' when 'a' then 'insert'
                              when 'u' then 'update' when 'd' then 'delete'
                              else 'all' end ||
                        ' to ' || coalesce((select string_agg(quote_ident(ro.rolname), ', ')
                                              from unnest(p.polroles) as r(rolid)
                                              join pg_roles ro on ro.oid = r.rolid), 'public') ||
                        case when pg_get_expr(p.polqual, p.polrelid) is not null
                             then ' using (' || pg_get_expr(p.polqual, p.polrelid) || ')'
                             else '' end ||
                        case when pg_get_expr(p.polwithcheck, p.polrelid) is not null
                             then ' with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')'
                             else '' end || ';',
                        E'\n' order by p.polname)
                       from pg_policy p
                      where p.polrelid = t.oid), '-- (مفيش سياسات)')
       ) as ddl
from t
order by t.relname;
