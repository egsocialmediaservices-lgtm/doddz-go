CREATE OR REPLACE FUNCTION public.deduct_product_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.deducting_stock', 'on', true);

  update public.products
     set stock = greatest(0, coalesce(stock, 0) - new.quantity),
         updated_at = now()
   where id = new.product_id;

  perform set_config('app.deducting_stock', '', true);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_seller_product_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    new.owner_id := auth.uid();
    new.status   := 'pending';
    new.source   := 'merchant';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_seller_product_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_provider_row()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if auth.uid() is null or public.is_admin() then
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, role, display_name, phone)
  values (
    new.id,
    'visitor',
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.login_email_for_phone(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e text;
begin
  select email into e
  from public.profiles
  where phone = p_phone
  limit 1;
  return e;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_provider_section(p_section text, p_name text, p_owner_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_governorate text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_logo_url text DEFAULT NULL::text, p_services jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid      uuid := auth.uid();
  v_table    text;
  v_provider text;
  v_status   text;
  v_request  text;
begin
  if v_uid is null then
    raise exception 'لازم تكون مسجّل دخول الأول';
  end if;

  select section_table into v_table
    from public.service_categories
   where code = p_section;

  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'اسم النشاط مطلوب';
  end if;

  execute format($q$
    insert into public.%1$I
      (user_id, name, owner_name, phone, governorate, area, address, description, logo_url, services)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, '[]'::jsonb))
    on conflict (user_id) do update
      set name        = excluded.name,
          owner_name  = coalesce(excluded.owner_name,  public.%1$I.owner_name),
          phone       = coalesce(excluded.phone,       public.%1$I.phone),
          governorate = coalesce(excluded.governorate, public.%1$I.governorate),
          area        = coalesce(excluded.area,        public.%1$I.area),
          address     = coalesce(excluded.address,     public.%1$I.address),
          description = coalesce(excluded.description, public.%1$I.description),
          logo_url    = coalesce(excluded.logo_url,    public.%1$I.logo_url),
          services    = case when excluded.services <> '[]'::jsonb
                             then excluded.services else public.%1$I.services end,
          updated_at  = now()
    returning id, status
  $q$, v_table)
  using v_uid, btrim(p_name),
        nullif(btrim(coalesce(p_owner_name,  '')), ''),
        nullif(btrim(coalesce(p_phone,       '')), ''),
        nullif(btrim(coalesce(p_governorate, '')), ''),
        nullif(btrim(coalesce(p_area,        '')), ''),
        nullif(btrim(coalesce(p_address,     '')), ''),
        nullif(btrim(coalesce(p_description, '')), ''),
        nullif(btrim(coalesce(p_logo_url,    '')), ''),
        p_services
  into v_provider, v_status;

  -- الحساب يعرف قسمه — الدور بيفضل زي ما هو
  update public.profiles
     set category     = p_section,
         provider_id  = v_provider,
         phone        = coalesce(nullif(btrim(coalesce(p_phone, '')), ''), phone),
         display_name = coalesce(nullif(btrim(coalesce(p_owner_name, '')), ''), display_name)
   where id = v_uid;

  -- الطلب يظهر في لوحة الأدمن (قسم منضبط + مربوط بالحساب والنشاط)
  insert into public.signup_requests
    (request_type, category, user_id, provider_id, full_name, email, phone,
     business_name, description, status)
  values
    (case when p_section = 'merchants' then 'merchant' else 'service_provider' end,
     p_section, v_uid, v_provider,
     coalesce(nullif(btrim(coalesce(p_owner_name, '')), ''),
              (select email from auth.users where id = v_uid)),
     (select email from auth.users where id = v_uid),
     nullif(btrim(coalesce(p_phone, '')), ''),
     btrim(p_name),
     nullif(btrim(coalesce(p_description, '')), ''),
     'pending')
  returning id::text into v_request;

  return jsonb_build_object(
    'section',     p_section,
    'provider_id', v_provider,
    'status',      v_status,
    'request_id',  v_request
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_product_owner_and_pending()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_provider_status(p_section text, p_id text, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_table text;
  v_row   jsonb;
begin
  if not public.is_admin() then
    raise exception 'غير مسموح: الدالة دي لحساب الأدمن فقط';
  end if;

  if p_status not in ('pending','approved','rejected') then
    raise exception 'حالة غير مقبولة: %', p_status;
  end if;

  select section_table into v_table
    from public.service_categories
   where code = p_section;

  if v_table is null or to_regclass('public.' || v_table) is null then
    raise exception 'قسم غير معروف: %', p_section;
  end if;

  execute format($q$
    update public.%I
       set status      = $2,
           approved_at = case when $2 = 'approved' then now() else null end,
           approved_by = auth.uid(),
           updated_at  = now()
     where id = $1
    returning jsonb_build_object('id', id, 'name', name, 'status', status)
  $q$, v_table)
  using p_id, p_status
  into v_row;

  if v_row is null then
    raise exception 'مفيش نشاط بالمعرّف % في قسم %', p_id, p_section;
  end if;

  -- نشاط الحساب في profiles + طلب الانضمام بتاعه يتقفلوا
  update public.profiles p
     set provider_id = coalesce(p.provider_id, p_id)
    from public.signup_requests r
   where r.user_id = p.id and r.provider_id = p_id;

  update public.signup_requests
     set status = case when p_status = 'approved' then 'approved' else 'rejected' end,
         reviewed_at = now()
   where provider_id = p_id;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track_order(p_order_id text, p_phone text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o record;
  items json;
begin
  select * into o
  from public.orders
  where trim(customer_phone) = trim(p_phone)
    and (
      id = trim(p_order_id)
      or upper(right(id, 8)) = upper(trim(p_order_id))
    )
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(json_agg(json_build_object(
    'product_name',  oi.product_name,
    'quantity',      oi.quantity,
    'unit_price',    oi.unit_price,
    'line_total',    oi.line_total,
    'product_image', oi.product_image
  )), '[]'::json)
  into items
  from public.order_items oi
  where oi.order_id = o.id;

  return json_build_object(
    'id',               o.id,
    'ref',              upper(right(o.id, 8)),
    'status',           o.status,
    'total',            o.total,
    'delivery_fee',     o.delivery_fee,
    'items_subtotal',   o.items_subtotal,
    'payment_method',   o.payment_method,
    'customer_name',    o.customer_name,
    'customer_area',    o.customer_area,
    'customer_address', o.customer_address,
    'created_at',       o.created_at,
    'items',            items
  );
end;
$function$

