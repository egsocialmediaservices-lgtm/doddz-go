-- ================================================================
-- نسخة واحدة جاهزة للنسخ: افتح الملف ده → Ctrl+A → Ctrl+C
-- البسته في SQL Editor في Supabase → دوس زرار Run
-- مفيش حاجة محتاجة تحدّدها بالماوس.
--
-- بيطلّع ٤ صفوف × عمودين (part و ddl):
--   functions = كل الدوال (is_admin / track_order / register_provider_section ...)
--   policies  = كل سياسات RLS
--   triggers  = كل التريجرز
--   tables    = أسماء الجداول وأعمدتها وحالة RLS
-- ================================================================
select 'functions' as part,
       (select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by p.proname)
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f') as ddl
union all
select 'policies',
       (select string_agg(
            'create policy ' || q.polname || ' on public.' || q.relname || ' ; -- ' ||
            q.cmd || ' to ' || q.roles || ' using ' || coalesce(q.using_txt,'null') ||
            ' with check ' || coalesce(q.check_txt,'null'), E'\n' order by q.polname)
          from (
            select pol.polname, cl.relname,
              case pol.polcmd when 'r' then 'select' when 'a' then 'insert'
                   when 'u' then 'update' when 'd' then 'delete' else 'all' end as cmd,
              coalesce((select string_agg(ro.rolname, ',')
                          from unnest(pol.polroles) as r(rolid)
                          join pg_roles ro on ro.oid = r.rolid), 'public') as roles,
              pg_get_expr(pol.polqual, pol.polrelid)     as using_txt,
              pg_get_expr(pol.polwithcheck, pol.polrelid) as check_txt
            from pg_policy pol
            join pg_class cl on cl.oid = pol.polrelid
            join pg_namespace n on n.oid = cl.relnamespace
            where n.nspname = 'public'
          ) q)
union all
select 'triggers',
       (select string_agg(pg_get_triggerdef(t.oid), E';\n' order by cl.relname, t.tgname)
          from pg_trigger t
          join pg_class cl on cl.oid = t.tgrelid
          join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and not t.tgisinternal)
union all
select 'tables',
       (select string_agg(
            cl.relname || ' (' ||
            coalesce((select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', '
                          order by a.attnum)
                       from pg_attribute a
                      where a.attrelid = cl.oid and a.attnum > 0 and not a.attisdropped), '')
            || ') rls=' || cl.relrowsecurity,
            E'\n' order by cl.relname)
          from pg_class cl
          join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relkind in ('r','p'));
