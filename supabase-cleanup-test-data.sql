-- ================================================================
-- Doddz Go — مسح بيانات الاختبار اللي اتعملت أثناء الفحص
-- (الطلبات الحقيقية بتاعة عملائك مش هتتمسح — القائمة محددة بالـID)
-- التشغيل: Supabase → SQL Editor → Run
-- ================================================================

-- 1) طلبات الاختبار (مسجلة بواسطة المتصفح أثناء الفحص)
delete from public.order_items
 where order_id in (
   'test_diag_order_1',
   'order_1790375083438_tw3xbr',   -- تجربة تشخيص
   'order_1790375126596_9l3q17',   -- زائر تجريبي
   'order_1790376892480_t1dm6n',   -- زائر محمي
   'order_probe_1790376926060',
   'order_1790377746935_k4e1ms',   -- زائر اختبار
   'order_probe2_1790377767794',
   'order_anonprobe_1790377806564',
   'order_1790379580759_pfo2f6',   -- زائر التحقق UI
   'order_1790380295511_rmidoz',
   'order_1790380664436_7xnh85',   -- زائر بدون دخول
   'order_1790380845444_szepw6',   -- طلب التحقق النهائي
   'sql_probe_order'
 );

delete from public.orders
 where id in (
   'test_diag_order_1',
   'order_1790375083438_tw3xbr',
   'order_1790375126596_9l3q17',
   'order_1790376892480_t1dm6n',
   'order_probe_1790376926060',
   'order_1790377746935_k4e1ms',
   'order_probe2_1790377767794',
   'order_anonprobe_1790377806564',
   'order_1790379580759_pfo2f6',
   'order_1790380295511_rmidoz',
   'order_1790380664436_7xnh85',
   'order_1790380845444_szepw6',
   'sql_probe_order'
 );

-- 2) حجز الحلاقين التجريبي
delete from public.barber_bookings
 where customer_phone in ('01012345678') and customer_name = 'زائر الحجز';

-- 3) إرجاع المخزون: كان 40 قبل أول طلب اختبار (بعدين اتخصم 6 units)
--    ⚠️ لو كنت عدّلت المخزون يدويًا في الفترة دي، حط الرقم الصح بدل 40
--    حارس المنتجات بيرفض أي تحديث مباشر من SQL Editor، فبنقفله بالاسم
--    جوه نفس المعاملة ونرجّعه فورًا ( Disable trigger all مرفوض في Supabase
--    لأنه بيلمس تريجرز المفاتيح الأجنبية ).
begin;
  alter table public.products disable trigger trg_enforce_seller_product_update;

  update public.products
     set stock = 40, updated_at = now()
   where id = 'doddz_1789854890645_uaa9';

  alter table public.products enable trigger trg_enforce_seller_product_update;
commit;

-- 4) حسابات الزوار التجريبية (auth + profiles)
--    احذف السطور دي لو عايزهم يفضلوا للاختبار تاني
delete from public.profiles
 where id in ('aaee0ebf-cc6a-48f5-8734-97bec1421f63',
              'fe68cf9c-8be6-498a-9827-bb2618c1111d');

delete from auth.users
 where id in ('aaee0ebf-cc6a-48f5-8734-97bec1421f63',
              'fe68cf9c-8be6-498a-9827-bb2618c1111d');

-- 5) مراجعة: المفروض الطلبات المتبقية تكون الحقيقية فقط
select id, customer_name, customer_phone, total, status, created_at
  from public.orders
 order by created_at desc
 limit 20;
