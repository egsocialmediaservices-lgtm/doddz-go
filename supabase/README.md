# Supabase — ملفات القاعدة والترتيب الصح للتشغيل

كل ملفات الـSQL الخاصة بالمشروع في المجلد ده. مفيش أي ملف `.sql` في جذر المشروع.
الملف الوحيد اللي بيشير لـSupabase بره المجلد هو `js/supabase-client.js` (بيعرّف الـURL
والمفتاح العام وبينشّئ `window.supabaseClient`) — سيبه في `js/` لأن كل صفحات
`index.html / product.html / barber.html` بتحمّله من هناك، نقله يكسر التحميل.
المشروع ساكن (بلا خطوة build)، فأي تغيير هنا بيدخل فورًا من المتصفح بعد ما يتنفّذ في
**Supabase Studio → SQL Editor** بحساب الـOwner.

## الترتيب (الأرقام في الأسماء = ترتيب التنفيذ)

| الملف | بيعمل إيه | الحالة |
|---|---|---|
| `00-export-live-schema.sql` | **قراءة بس** — يطلع الـDDL الحقيقي لكل جدول/سياسة/تريجر/دالة/View/Storage من القاعدة الحيّة | شغّله، ثم انسخ مخرج كل قسم سطّر سطّر في `supabase/export/live-schema.txt` |
| `01-setup-all.sql` | الأساسيات: قيود `profiles.role` (يشمل `visitor`)، أعمدة العنوان، سياسات `profiles`، `handle_new_user` (إنشاء صف profile مع كل تسجيل)، جدول `barber_bookings` + فرياد التكرار | اتنفّذ ✓ |
| `02-barber-bookings.sql` | جدول الحجوزات + سياساته + دوال الحجز | اتنفّذ ✓ |
| `03-fix-stock-guard.sql` | إصلاح حارس المخزون: `pg_trigger_depth() > 1` عشان تريجر خصم المخزون من `order_items` ما يتحسبش «تعديل من غير المالك» | اتنفّذ ✓ |
| `04-tighten-policies.sql` | تقفية سياسات `products/orders/order_items` (كان فيه `using(true)` و`OR true` بيسمح بحذف منتجات لأي حساب) + سياسة INSERT تسمح للتاجر يضيف منتج | اختياري — **شغّله بعد ما يبقى فيه حساب أدمن** |
| `05-provider-sections.sql` | **طبقة الأقسام الأربعة**: `service_categories` + جداول `barber_profiles / carwash_profiles / handmade_profiles / merchant_profiles` + `profiles.category/provider_id` + `signup_requests.category/user_id/provider_id` + `products.provider_id` + الحراس والـRLS + `register_provider_section()` + `set_provider_status()` + تغذية قايمة الحلاقين | **مطلوب تشغيله دلوقتي** — من غيره الأقسام هتفضل فاضية |
| `90-new-staff-account.sql` | إنشاء حساب موظف/حلاق من الداشبورد (Add user) وربطه بـ`profiles` | للضرورة بس — بقى في مسار أسهل: صاحب النشاط يسجّل من الموقع نفسه |
| `99-cleanup-test-data.sql` | مسح بيانات الاختبار (طلبات/حجوزات/حسابات `@example.com`) | بعد كل جولة اختبار |
| `diagnostics/*.sql` | تشخيص: حالة `order_items`، والتأكد إن إصلاح المخزون شغال | عند الحاجة |

## الحاجات اللي معمولة جوه الداشبورد بس (مش في ملف) — دور `00` هنا

اللي مش داخل repo إلا بتصديره من القاعدة الحيّة:

- `CREATE TABLE products` وكل الأعمدة والقيود الحقيقية (اتعملت من الداشبورد).
- دوال `public.is_admin()` و `public.track_order(order_id, phone)` — `05` بقى بيعرّف
  `is_admin()` بنفسه لو مش موجودة، بس `track_order` لازم تتنسخ من مخرج `00`.
- سياسات RLS الأصلية على `products / orders / order_items / signup_requests`.
- تريجرات `products` (حارس المالك، حارس الإدراج، تريجر خصم المخزون).
- الـStorage bucket `product-images` وسياساته، والـGRANTS.

## ملاحظات تشغيل لازم تتحفظ

1. **الـSQL Editor بينفّذ الملف كله كمعاملة واحدة**: أي سطر يفشل يرجّع كل اللي قبله.
   لو حصل خطأ، عدّل السطر وشغّل الملف من أوله تاني (مش من نصه).
2. `DISABLE TRIGGER ALL` مرفوض (`42501` — الدور `postgres` مش superuser).
   عطّل التريجر **بالاسم**: `alter table products disable trigger trg_xxx;`.
3. أي `UPDATE products` من SQL/Table Editor بترفضه الحراسة لأن `auth.uid()` فاضي هناك.
   عدّل المنتجات من **لوحة الأدمن** بحساب `role='admin'`.
4. **ما فيهوش مفتاح service key في الكود** — كل الصلاحيات RLS + تريجر + دوال
   `SECURITY DEFINER`. أي صلاحية جديدة لازم تتعمل في القاعدة، مش في الـJS.
5. الأدوار (`profiles.role`) محروسة بـ`trg_guard_profile_role`: المتصفح ما يقدرش
   يرقية لنفسه `admin`/`seller`. البوابة الحقيقية للوحة البائع بقى
   `profiles.category` (النشاط في جدول القسم) — و`role='admin'` للوحة الأدمن.
6. بعد أي تعديل في `js/*.js` أو `*.css` لازم يتزود رقم الكاش `?v=` في وسوم
   `<script>/<link>` في `index.html` و `product.html` و `barber.html` (حاليًا `20260926e`).
