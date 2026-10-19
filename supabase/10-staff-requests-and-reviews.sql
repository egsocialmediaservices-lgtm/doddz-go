-- ================================================================
-- 10 — طلبات العمالة + تقييمات وتعليقات الزوار
-- ================================================================
-- الملف ده بيضيف حاجتين جديدتين في Supabase، الاتنين بيعدّوا على
-- شاشة الأدمن في الموقع (لوحة إدارة Doddz):
--
--   1) staff_requests  → زرار «طلب عمالة» في لوحة صاحب الصالون
--      (فني حلاقة / فني نظافة / كاشير / نظام كاشير) والطلب يوصل للأدمن.
--   2) provider_reviews → الزائر يدي تقييم بالنجوم + كومنت على أي نشاط،
--      والحالة «pending» لحد ما الأدمن يعتمدُه؛ المعتمد بس اللي يبان
--      للناس، ومنه بيتحسّب متوسط التقييم وعدد المراجعات.
--
-- الأمان: كل الصلاحيات في الطبقة دي (RLS + تريجرات + دوال)، مش في js.
-- متغيرات الطلب والتقييم مش بتتقرأ من المتصفح إطلاقًا — التريجر بيثبّتها.
--
-- ⚠️ مهم: SQL Editor بينفّذ الملف كله على transaction واحدة — لو سطر
--    فشل، كل حاجة ترجع زي ما كانت. شغّل الملف من أوله تاني بعد أي خطأ.
--    ومتستخدمش ALTER TABLE ... DISABLE TRIGGER ALL (ممنوع 42501).
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- 1) طلبات العمالة — staff_requests
-- ════════════════════════════════════════════════════════════════

create table if not exists public.staff_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider_id   text,
  provider_name text,
  section       text not null default 'barbers'
                check (section in ('barbers','carwash','handmade','merchants')),
  kind          text not null
                check (kind in ('barber_tech','cleaning_tech','cashier','pos_system')),
  quantity      int  not null default 1 check (quantity between 1 and 20),
  governorate   text,
  area          text,
  contact_phone text,
  notes         text,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','done')),
  admin_notes   text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists staff_requests_status_idx on public.staff_requests (status);
create index if not exists staff_requests_user_idx   on public.staff_requests (user_id);

alter table public.staff_requests enable row level security;

-- ── الحارس: المالك والحالة بيتثبتوا في السيرفر ──────────────────
-- * حساب من الموقع: user_id = auth.uid() و status = 'pending'.
-- * غير الأدمن ما يقدرش يحالة الطلب بنفسه ولا يغيّر ملاحظات الأدمن.
-- * SQL Editor (auth.uid() فاضي) أو حساب أدمن: بيعدّوا عاديين.
create or replace function public.guard_staff_request_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id     := auth.uid();
    new.status      := 'pending';
    new.admin_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.user_id     := old.user_id;
    new.status      := old.status;
    new.admin_notes := old.admin_notes;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_staff_requests on public.staff_requests;
create trigger trg_guard_staff_requests
  before insert or update on public.staff_requests
  for each row execute function public.guard_staff_request_row();

-- ── السياسات ────────────────────────────────────────────────────
drop policy if exists "staff_requests_read_owner_or_admin" on public.staff_requests;
create policy "staff_requests_read_owner_or_admin"
  on public.staff_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "staff_requests_insert_owner" on public.staff_requests;
create policy "staff_requests_insert_owner"
  on public.staff_requests
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- المستخدم يقدر يعدّل طلبه وهو لسه «pending» بس — والتريجر بيرجّع
-- الحالة والملاحظات الإدارية لأقديم قيمهم.
drop policy if exists "staff_requests_update_owner_pending" on public.staff_requests;
create policy "staff_requests_update_owner_pending"
  on public.staff_requests
  for update to authenticated
  using      ((user_id = auth.uid() and status = 'pending') or public.is_admin())
  with check ((user_id = auth.uid() and status = 'pending') or public.is_admin());

drop policy if exists "staff_requests_delete_owner_or_admin" on public.staff_requests;
create policy "staff_requests_delete_owner_or_admin"
  on public.staff_requests
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- الأدمن بس اللي يعدّل حالة الطلب من اللوحة — والفحص كمان جوه الدالة.
drop policy if exists "staff_requests_admin_all" on public.staff_requests;
create policy "staff_requests_admin_all"
  on public.staff_requests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- صاحب الطلب يشوف طلباته ويشيلها (اللوحة بتاعتُه).
drop policy if exists "staff_requests_select_own" on public.staff_requests;
create policy "staff_requests_select_own"
  on public.staff_requests
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "staff_requests_delete_own" on public.staff_requests;
create policy "staff_requests_delete_own"
  on public.staff_requests
  for delete to authenticated
  using (user_id = auth.uid());


-- ── إرسال طلب عمالة من لوحة صاحب الصالون ────────────────────────
-- الاستدعاء:
--   client.rpc('submit_staff_request', {
--     p_kind: 'barber_tech', p_quantity: 2,
--     p_notes: '...', p_area: 'المعادي', p_governorate: 'القاهرة'
--   })
-- الحساب لازم يكون مربوط بنشاط في «قصها» — الدالة بتجيب النشاط نفسه
-- من profiles/باربر_بروفيلز، فمحدش يقدر يزوّر provider_id لحساب تاني.
create or replace function public.submit_staff_request(
  p_kind        text,
  p_quantity    int    default 1,
  p_notes       text   default null,
  p_area        text   default null,
  p_governorate text   default null,
  p_phone       text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_provider text;
  v_name     text;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'لازم تكون مسجّل دخول الأول';
  end if;

  if p_kind is null or p_kind not in ('barber_tech','cleaning_tech','cashier','pos_system') then
    raise exception 'نوع الطلب غير معروف';
  end if;

  -- النشاط بتاع الحساب: أول حاجة من profiles.provider_id، ولو فاضي
  -- بنبحث على الصالون اللي user_id بتاعه. المعرّف من المتصفح مش مقرو
  -- أصلًا — الدالة هي اللي بتحدده.
  select provider_id into v_provider from profiles where id = v_uid;

  select id, name into v_provider, v_name
    from barber_profiles
   where (v_provider is not null and id = v_provider)
      or (v_provider is null and user_id = v_uid)
   limit 1;

  if v_provider is null then
    raise exception 'مفيش صالون مربوط بالحساب ده — اعمل الصالون من لوحة النشاط الأول';
  end if;

  insert into staff_requests
    (user_id, provider_id, provider_name, section, kind, quantity,
     governorate, area, contact_phone, notes)
  values
    (v_uid, v_provider, v_name, 'barbers', p_kind,
     coalesce(nullif(p_quantity, 0), 1),
     nullif(btrim(coalesce(p_governorate, '')), ''),
     nullif(btrim(coalesce(p_area, '')), ''),
     nullif(btrim(coalesce(p_phone, '')), ''),
     nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'status', 'pending');
end;
$$;

grant execute on function public.submit_staff_request(text, int, text, text, text, text) to authenticated;

revoke execute on function public.submit_staff_request(text, int, text, text, text, text) from anon;


-- ── الأدمن يحالة الطلب (قبول / رفض / تم التنفيذ) ────────────────
create or replace function public.set_staff_request_status(
  p_id          uuid,
  p_status      text,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row staff_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'الإدارة بس اللي تحوّل حالة طلب العمالة';
  end if;

  if p_status not in ('pending','approved','rejected','done') then
    raise exception 'حالة غير معروفة: %', p_status;
  end if;

  update staff_requests
     set status      = p_status,
         admin_notes = coalesce(nullif(btrim(coalesce(p_admin_notes, '')), ''), admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at  = now()
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'الطلب مش موجود';
  end if;

  return jsonb_build_object('success', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

grant execute on function public.set_staff_request_status(uuid, text, text) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 2) تقييمات وتعليقات الزوار — provider_reviews
--    نشاط/عميل/تقييم/كومنت — الحالة pending لحد اعتماد الأدمن.
--    كل مستخدم ليه مراجعة واحدة بس على النشاط (اتحاد بيعدّلها).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.provider_reviews (
  id           uuid primary key default gen_random_uuid(),
  section      text not null
               check (section in ('barbers','carwash','handmade','merchants')),
  provider_id  text not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  rating       int  not null check (rating between 1 and 5),
  comment      text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  admin_notes  text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint provider_reviews_one_per_user unique (section, provider_id, user_id)
);

create index if not exists provider_reviews_provider_idx on public.provider_reviews (section, provider_id, status);
create index if not exists provider_reviews_status_idx   on public.provider_reviews (status);

alter table public.provider_reviews enable row level security;

-- ── الحارس: المالك والحالة والـSECURITY DEFINER ─────────────────
create or replace function public.guard_provider_review_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id     := auth.uid();
    new.status      := 'pending';
    new.admin_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    -- لصاحب المراجعة: يغيّر التقييم والكومنت بس، والحالة ترجع pending
    new.user_id     := old.user_id;
    new.section     := old.section;
    new.provider_id := old.provider_id;
    new.status      := 'pending';
    new.admin_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_provider_reviews on public.provider_reviews;
create trigger trg_guard_provider_reviews
  before insert or update on public.provider_reviews
  for each row execute function public.guard_provider_review_row();

-- ── السياسات ────────────────────────────────────────────────────
-- الكل يشوف المعتمد، وصاحب المراجعة يشوف حقّه في أي حالة.
drop policy if exists "provider_reviews_read" on public.provider_reviews;
create policy "provider_reviews_read"
  on public.provider_reviews
  for select to anon, authenticated
  using (status = 'approved' or (auth.uid() is not null and user_id = auth.uid()) or public.is_admin());

drop policy if exists "provider_reviews_insert_owner" on public.provider_reviews;
create policy "provider_reviews_insert_owner"
  on public.provider_reviews
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- المستخدم يعدّل مراجعته، والأدمن يعدّل الحالة — التمييز جوه الدالة.
drop policy if exists "provider_reviews_update" on public.provider_reviews;
create policy "provider_reviews_update"
  on public.provider_reviews
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "provider_reviews_delete_owner_or_admin" on public.provider_reviews;
create policy "provider_reviews_delete_owner_or_admin"
  on public.provider_reviews
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());


-- ── الدوال المشتركة: اسم جدول القسم + إعادة حساب التقييم ────────
create or replace function public.provider_section_table(p_section text)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select section_table
    from service_categories
   where code = p_section;
$$;

-- ================================================================
-- ⚠️ نسخة محدّثة من حارس الأنشطة (guard_provider_row في 05)
--    ليه؟ التريجر القديم بيمنع أي حساب غير الأدمن يغيّر rating و
--    reviews_count على جداول الأقسام — وده بيكسر إعادة حساب التقييم،
--    لأن الدالة بتتنفّذ بحساب الزائر العادي (اللي بيبعت تقييمه).
--    الحل: علامة داخل نفس الـ transaction اسمها doddz.rating_refresh
--    بتتظبط جوه refresh_provider_rating بس، وبتنتهي مع نفس الـ transaction.
--    باقي قواعد الحارس (المالك/الحالة/الاعتماد) زي ما هي حرفيًا.
-- ================================================================
create or replace function public.guard_provider_row()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin()
     or coalesce(current_setting('doddz.rating_refresh', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is null then new.user_id := auth.uid(); end if;
    new.status      := 'pending';
    new.approved_at := null;
    new.approved_by := null;
  else
    new.user_id       := old.user_id;
    new.status        := old.status;
    new.approved_at   := old.approved_at;
    new.approved_by   := old.approved_by;
    new.rating        := old.rating;
    new.reviews_count := old.reviews_count;
    new.is_featured   := old.is_featured;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- المتوسط والعدد من المراجعات المعتمدة بس — والمتوسط بخانتين عشريتين
create or replace function public.refresh_provider_rating(p_section text, p_provider_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
begin
  v_table := public.provider_section_table(p_section);
  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  -- علامة داخل الـ transaction دي بس عشان حارس الأنشطة يمرّر التحديث
  perform set_config('doddz.rating_refresh', 'on', true);

  execute format($q$
    update public.%1$I
       set rating        = coalesce((select round(avg(rating)::numeric, 2)
                                       from provider_reviews
                                      where section = $1 and provider_id = $2
                                        and status = 'approved'), 0),
           reviews_count = (select count(*)::int
                              from provider_reviews
                             where section = $1 and provider_id = $2
                               and status = 'approved'),
           updated_at    = now()
     where id = $2
  $q$, v_table)
  using p_section, p_provider_id;

  perform set_config('doddz.rating_refresh', 'off', true);
end;
$$;


-- ── الزائر يرسل تقييمه (بيروح pending) ──────────────────────────
--   client.rpc('submit_provider_review', {
--     p_section: 'barbers', p_provider_id: 'srv_...', p_rating: 5,
--     p_comment: 'استقبال حلو وقصة ظبط'
--   })
-- المراجعة لو موجودة بتمسح اعتمادها وترجع للمراجعة من أول.
create or replace function public.submit_provider_review(
  p_section     text,
  p_provider_id text,
  p_rating      int,
  p_comment     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_table   text;
  v_exists  boolean;
  v_id      uuid;
  v_st      text;
begin
  if v_uid is null then
    raise exception 'لازم تكون مسجّل دخول عشان تعطي تقييم';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'التقييم لازم يكون من ١ لـ ٥ نجوم';
  end if;

  v_table := public.provider_section_table(p_section);
  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  execute format('select exists (select 1 from public.%I where id = $1 and status = ''approved'')'
                 , v_table)
     into v_exists
    using p_provider_id;

  if not v_exists then
    raise exception 'النشاط ده مش متاح للمراجعة حاليًا';
  end if;

  execute format($q$
    insert into provider_reviews (section, provider_id, user_id, rating, comment, status)
    values ($1, $2, $3, $4, nullif(btrim(coalesce($5, '')), ''), 'pending')
    on conflict (section, provider_id, user_id) do update
      set rating      = excluded.rating,
          comment     = excluded.comment,
          status      = 'pending',
          admin_notes = null,
          reviewed_by = null,
          reviewed_at = null,
          updated_at  = now()
    returning id, status
  $q$)
  using p_section, p_provider_id, v_uid, p_rating, p_comment
  into v_id, v_st;

  -- لو المراجعة كانت معتمدة قبل كده، المتوسط بيتظبط حالًا
  public.refresh_provider_rating(p_section, p_provider_id);

  return jsonb_build_object('success', true, 'id', v_id, 'status', v_st);
end;
$$;

grant execute on function public.submit_provider_review(text, text, int, text) to authenticated;
revoke execute on function public.submit_provider_review(text, text, int, text) from anon;


-- ── الأدمن يعتمد / يرفض المراجعة ────────────────────────────────
create or replace function public.set_provider_review_status(
  p_id          uuid,
  p_status      text,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row provider_reviews%rowtype;
begin
  if not public.is_admin() then
    raise exception 'الإدارة بس اللي تعتمد أو ترفض تقييمات الزوار';
  end if;

  if p_status not in ('pending','approved','rejected') then
    raise exception 'حالة غير معروفة: %', p_status;
  end if;

  update provider_reviews
     set status      = p_status,
         admin_notes = coalesce(nullif(btrim(coalesce(p_admin_notes, '')), ''), admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at  = now()
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'المراجعة مش موجودة';
  end if;

  public.refresh_provider_rating(v_row.section, v_row.provider_id);

  return jsonb_build_object('success', true,
                            'id', v_row.id,
                            'status', v_row.status,
                            'provider_id', v_row.provider_id,
                            'section', v_row.section);
end;
$$;

grant execute on function public.set_provider_review_status(uuid, text, text) to authenticated;


-- ── قايمة المراجعات المعتمدة لنشاط (للصفحة العامة، بتشتغل حتى بدون تسجيل) ──
create or replace function public.provider_approved_reviews(
  p_section     text,
  p_provider_id text
)
returns table (
  id         uuid,
  rating     int,
  comment    text,
  created_at timestamptz,
  reviewer   text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.comment, r.created_at,
         coalesce(nullif(btrim(p.display_name), ''), 'زائر Doddz Go') as reviewer
    from provider_reviews r
    left join profiles p on p.id = r.user_id
   where r.section = p_section
     and r.provider_id = p_provider_id
     and r.status = 'approved'
   order by r.created_at desc
   limit 60;
$$;

grant execute on function public.provider_approved_reviews(text, text) to anon, authenticated;


-- ================================================================
-- ✅ انتهى. التحقق السريع (اختياري) — شغّله لو عايز تتأكد:
--
--   select count(*) from staff_requests;
--   select count(*) from provider_reviews;
--   select proname from pg_proc
--    where proname in ('submit_staff_request','set_staff_request_status',
--                      'submit_provider_review','set_provider_review_status',
--                      'provider_approved_reviews','refresh_provider_rating');
--
-- وفي لوحة الأدمن هتظهر تبويبتين جديدتين: «طلبات عمالة» و«تقييمات الزوار».
-- ================================================================
