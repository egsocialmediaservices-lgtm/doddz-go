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
| `04-tighten-policies.sql` | تقفية سياسات `products/orders/order_items` (كان فيه `using(true)` و`OR true` بيسمح بحذف منتجات لأي حساب) + سياسة INSERT تسمح للتاجر يضيف منتج + حارس `profiles.role` | **اتنفّذ ✓** (اتأكد من تصدير القاعدة الحيّة 2026-10-03) |
| `05-provider-sections.sql` | **طبقة الأقسام الأربعة**: `service_categories` + جداول `barber_profiles / carwash_profiles / handmade_profiles / merchant_profiles` + `profiles.category/provider_id` + `signup_requests.category/user_id/provider_id` + `products.provider_id` + الحراس والـRLS + `register_provider_section()` + `set_provider_status()` + تغذية قايمة الحلاقين | **اتنفّذ ✓** (2026-10-03) — الجداول الأربعة + `service_categories` موجودين، ولكل جدول قسم 4 سياسات RLS وتريجر حارس واحد |
| `06-live-sync.sql` | **مزامنة الملفات مع القاعدة الحيّة**: تعريفات `enforce_seller_product_insert()` و `login_email_for_phone()` و تريجر `trg_products_owner_pending` (كانو على القاعدة ملهمش ملف) + النسخة الحيّة من `is_admin()` ودوال المخزون اللي بتستخدم علم `app.deducting_stock` | آمن يتنفّذ أكتر من مرة — بيكرر اللي مشغّل بالفعل |
| `07-core-tables-from-live.sql` | **الجداول الأساسية الستة** اللي كانت معمولة من الداشبورد ملهاش ملف: `profiles` · `products` · `orders` · `order_items` · `signup_requests` · `barber_status` — أعمدة + Defaults + قيود + فهارس + RLS + سياسات، مطابقة للقاعدة الحيّة حرفيًا | للقاعدة الجديدة. على الحالية مش لازم يتنفّذ (القيود متلفّة بـ`do $$ … exception $$` فالإعادة آمنة) |
| `08-barber-team-booking.sql` | **توسعة «قصها» (مرحلة ١)**: bucket `provider-media` + سياسات الرفع لمالك النشاط · `barber_team` (فريق المحل) · `barber_media` (ألبوم + عينات، ٢٠ لكل نوع) · أعمدة `hours`/`location` على جداول الأقسام · `services`+`member_id`+`member_name` في `barber_bookings` · فهرس الميعاد بقى لكل فني على حدة · دالة `owns_provider()` | **اتنفّذ ✓** (2026-10-15) — `barber_team`/`barber_media`/bucket شغالين، والاختبار الحي للوحة البائعPASS |
| `10-staff-requests-and-reviews.sql` | **مرحلة ٢ لـ«قصها»**: `staff_requests` (فني حلاقة/نظافة/كاشير/نظام كاشير من لوحة صاحب الصالون → الأدمن) + `provider_reviews` (تقييم نجوم + كومنت لكل الأقسام الأربعة، `pending` لحد اعتماد الأدمن) · دوال `submit_staff_request` / `set_staff_request_status` / `submit_provider_review` / `set_provider_review_status` / `provider_approved_reviews` / `refresh_provider_rating` · نسخة محدّثة من `guard_provider_row()` بيسمح لإعادة حساب التقييم بعلامة `doddz.rating_refresh` | **لسه ما اتنفّذش** — idempotent، والملف كله transaction واحدة. الصفحة تشتغل من غيره وبتعرض رسالة تقول شغّله |
| `11-home-subcategories.sql` | **تقسيم «المنزل» + تغيير اسم «لاب توب»**: تاغ `subcategory` لـ30 منتج في `section='home'` على 4 مجموعات (ادوات صيانة 14 · مستلزمات مطبخ 6 · مستلزمات حمام 5 · ديكور 5) حسب الـid + توحيد الأسماء القديمة + `category` بتاع `section='laptops'` من «لاب توب» لـ«اكسسوارات لاب توب». فيه خطوة 7 اختيارية تنقل «حوض سباحة للاطفال» لقسم الأطفال | **لسه ما اتنفّذش** — بيعدّل بيانات بس (مفيش DDL). بيعطّل `trg_enforce_seller_product_update` بالاسم أوله وبيرجّعه آخر سطر |
| `12-technician-applications.sql` | **باب التوظيف**: جدول `technician_applications` (استمارة فني حلاقة من صفحة `technician-apply.html` بدون تسجيل دخول) + تريجر حارس + كود متابعة `TA-XXXXXXXX` · دوال `submit_technician_application` (التحقق والتنضيف والتكرار بنفس الرقم) / `technician_application_status` (متابعة الفني) / `set_technician_application_status` و`delete_technician_application` (للأدمن بس) · bucket `technician-applications` عام مع رفع من مجلد `apps/` | **لسه ما اتنفّذش** — idempotent، الملف كله transaction واحدة، اختر «Run without RLS» |
| `90-new-staff-account.sql` | إنشاء حساب موظف/حلاق من الداشبورد (Add user) وربطه بـ`profiles` | للضرورة بس — بقى في مسار أسهل: صاحب النشاط يسجّل من الموقع نفسه |
| `91-new-admin-account.sql` | **تعيين حساب أدمن** (`role='admin'`) — بعد ما تعمل Add user من الداشبورد بـAuto Confirm | شغّله مرة واحدة for your email — مطلوب قبل `04` وقبل تبويب «أنشطة الأقسام» |
| `99-cleanup-test-data.sql` | مسح بيانات الاختبار (طلبات/حجوزات/حسابات `@example.com`) | **لسه ما اتنفّذش** — شغّله بعد ما تخلص جولة الاختبار الحية |
| `diagnostics/*.sql` | تشخيص: حالة `order_items`، والتأكد إن إصلاح المخزون شغال | عند الحاجة |

## الحاجات اللي معمولة جوه الداشبورد بس (مش في ملف) — دور `00` هنا

اللي مش داخل repo إلا بتصديره من القاعدة الحيّة — **اتحدّد بالظبط في 2026-10-03**، التفاصيل في
[`export/DRIFT-REPORT.md`](export/DRIFT-REPORT.md) واللّقط الخام في [`export/live/`](export/live):

- **٦ جداول ملهاش أمر إنشاء في أي ملف قديم** (اتعملت من الداشبورد):
  `profiles` · `products` · `orders` · `order_items` · `signup_requests` · `barber_status`.
  بقى ليهم ملف: **`07-core-tables-from-live.sql`** (أعمدة + Defaults + قيود + فهارس + RLS + السياسات).
- `public.enforce_seller_product_insert()` و `public.login_email_for_phone(text)` و
  تريجر `trg_products_owner_pending` — كانوا على القاعدة ملهمش ملف (دخلوا `06-live-sync.sql`).
- النسخة الحيّة من `is_admin()` و`deduct_product_stock()` و`enforce_seller_product_update()`
  و`set_product_owner_and_pending()` أحدث من `03` (بتستخدم `app.deducting_stock` بدل
  `pg_trigger_depth() > 1`) — كلها في `06-live-sync.sql`.
- دوال `public.track_order(order_id, phone)` و`handle_new_user` طابقت الملفات حرفيًا ✓.
- الـStorage bucket `product-images` وسياساته، والـGRANTS (القسم ٩ و١٠ في `00` — لسه ما اتشغّلوش).

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
   `<script>/<link>` في كل الصفحات الثمانية: `index.html` و `product.html` و `barber.html` و
   `carwash.html` و `handmade.html` و `merchant.html` و `policies.html` و `technician-apply.html`
   (حاليًا `20261029a`).
