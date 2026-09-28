-- ================================================================
-- Doddz Go — إصلاح خصم المخزون وقت الشراء (نسخة آمنة للمعاملة)
--
-- المشكلة الأصلية:
--   tr_deduct_stock على order_items بيعمل UPDATE products لخصم المخزون،
--   فتريجر الحماية trg_enforce_seller_product_update على products بيرمي
--   "غير مسموح بتعديل منتج مش ملكك" لأن owner_id بتاع المنتج فاضي
--   و auth.uid() موجود (مشتري مسجّل دخوله).
--
-- ليه النسخة دي مختلفة:
--   نسخة set_config كانت بتقفل المعاملة جوه التريجر (خطأ 2D000).
--   التمييز هنا هو عمق التريجر: خصم المخزون جه من جوه تريجر تاني
--   (order_items -> UPDATE products) فعمقه أكبر من 1، بينما تعديل
--   المستخدم المباشر بيفضل في عمق 1 وبيفضل محمي زي الأول تمامًا.
--   (ملاحظة: current_user/session_user مش صالحين هنا لأن PostgREST
--    نفسه بيغيّر الدور لكل طلب، فهيميزوا غلط وهيفتحوا الحماية للجميع.)
--
-- التشغيل: Supabase → SQL Editor → الصق كل الملف → Run
-- ================================================================

-- 1) دالة الخصم: نفس جسم الدالة الأصلي، من غير أي set_config
create or replace function public.deduct_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock = greatest(0, coalesce(stock, 0) - new.quantity),
         updated_at = now()
   where id = new.product_id;

  return new;
end;
$$;

-- 2) حارس التحديث على products:
--    بيعفي خصم المخزون الداخلي فقط، وباقي التعديلات محمية زي الأول تمامًا
create or replace function public.enforce_seller_product_update()
returns trigger
language plpgsql
as $$
begin
  --الاستدعاء جه من جوه تريجر تاني (مسار خصم المخزون وقت الشراء)
  if pg_trigger_depth() > 1 then
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

-- 3) حارس الملكية: الملكية تتعيّن عند الإنشاء فقط (INSERT)
--    عشان أي UPDATE (زي خصم المخزون) ما ينقلش المنتج للمشترين
create or replace function public.set_product_owner_and_pending()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.owner_id := auth.uid();
    end if;

    if new.status is null or new.status = '' then
      new.status := 'pending';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- 4) حق حذف الطلبات للأدمن (المسح من المتصفح كان بيعدي بصمت من غير حذف)
drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin"
  on public.orders
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "order_items_delete_admin" on public.order_items;
create policy "order_items_delete_admin"
  on public.order_items
  for delete to authenticated
  using (public.is_admin());

-- 5) اختبار سريع بعد التشغيل: شراء منتج موجود بيخصم من غير خطأ
-- select id, name, stock from public.products limit 5;
