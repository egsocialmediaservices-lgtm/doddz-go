# تقرير الفروقات — Supabase الحيّة مقابل ملفات `supabase/`

اتعمل من تصدير `00-export-live-schema.sql` قسم ١٢ بتاريخ **2026-10-03**.
الملفات الخام للتصدير في `supabase/export/live/` (`functions.sql`, `policies.sql`, `triggers.sql`, `tables.sql`).

## ١) المخزون اللي على القاعدة دلوقتي

| الحاجة | العدد | ملاحظة |
|---|---|---|
| جداول في `public` | 12 | **كلها `relrowsecurity = true`** ✅ |
| دوال (functions) | 12 | منهم 2 مش موجودين في أي ملف |
| تريجرز | 9 | منهم 1 مش موجود في أي ملف |
| سياسات RLS | 60 | فيهم مكرّرات من عصر الداشبورد |

الجداول: `barber_bookings, barber_profiles, barber_status, carwash_profiles, handmade_profiles, merchant_profiles, order_items, orders, products, profiles, service_categories, signup_requests`.

## ٢) موجود على القاعدة ومش موجود في الملفات (لازم يتعمل)

**جداول ملهاش `create table` في أي ملف** (اتعملت من الداشبورد بإيدك):
`profiles` · `products` · `orders` · `order_items` · `signup_requests` · `barber_status`
→ الملفات بتاعة ٠١ و٠٥ بتعمل `barber_bookings` و`service_categories` والأربع جداول بتوع الأقسام بس.
دى أخطر نقطة: لو المشروع اتبنى من الملفات على قاعدة جديدة، **الموقع كله يقع** لأن الجداول الأساسية ناقصة.
**خلصت:** التشغيل التاني (`export/copy-this-query-2.sql`) طلع التعريف الكامل، و اتحوّل لـ **`supabase/07-core-tables-from-live.sql`** (أعمدة + Defaults + ٢٢ قيد + الفهارس + RLS + ٣٩ سياسة). اللّقط المنفصلة في `export/live/core-<table>.sql`.

**دوال ملهاش تعريف في أي ملف:**

| الدالة | بتستناها فين |
|---|---|
| `enforce_seller_product_insert()` | التريجر بتاعها على `products`؛ اسمها مذكور في تعليق بس في `04` |
| `login_email_for_phone(text)` | `js/account.js` / `js/auth.js` — الدخول برقم التليفون |

**تريجر ملوش إنشاء في أي ملف:** `trg_products_owner_pending` على `products` (الدالة معرّفة في `03` بس مفيش ربط).

الحل جاهز في **`supabase/06-live-sync.sql`** — فيه التعريفات دي بالحرف زي ما هي مشغّلة، آمن يتعمل أكتر من مرة.

## ٣) الملفات أقديم من القاعدة (القاعدة عليها نسخة أحدث)

| الدالة | الفرق |
|---|---|
| `deduct_product_stock` | الحيّة بتستخدم `set_config('app.deducting_stock','on',true)` حول الـ update |
| `enforce_seller_product_update` | بتتشيك على `current_setting('app.deducting_stock')` بدل `pg_trigger_depth() > 1` |
| `set_product_owner_and_pending` | نفس الاستبدال |
| `is_admin` | الحيّة بصيغة `select exists (select 1 from profiles where id = auth.uid() and role='admin')` |

دي كلها اتعملت من الداشبورد بعد ما `03-fix-stock-guard.sql` اتنفّذ. `06-live-sync.sql` بيجيب الملفات لنفس المستوى.

## ٤) تطابق تام (مفيش فرق)

`guard_profile_role` (٠٤) · `guard_provider_row` (٠٥) · `handle_new_user` (٠١) · `register_provider_section` (٠٥) · `set_provider_status` (٠٥) · `track_order` (٠١)
وتريجرز الأقسام `trg_guard_barber/carwash/handmade/merchant_profiles` بتتعمل ديناميكيًا في `05` (سطر ٢٥٢) — فمش فرق حقيقي.

**٠٤-tighten-policies.sql اتنفّذ فعلًا** ✅ (سياسات `products_insert_authenticated` و`products_delete_owner_or_admin` وتريجر `trg_enforce_seller_product_insert` موجودين على القاعدة) — كان مقترح قبل الإطلاق بقى منتهي.

## ٥) ملاحظات أمان (مفيش حاجة اتغيّرت — دي توصيات)

`profiles` عليها **٩ سياسات**، و٤ منهم بيفتحوا الجدول لأي حساب مسجّل:

| السياسة | معناها |
|---|---|
| `Auth update profiles` — `for all to authenticated using true with check true` | أي حساب يقدر يعدّل **أي** صف profiles |
| `profiles_update_auth` — نفس الحاجة | مكرّرة |
| `profiles_select_auth` — `using true` | أي حساب يقدر يقرا **كل** الصفوف |
| `Users read own profile` — `using ((id = auth.uid()) OR true)` | `OR true` بتلغي الشرط |
| `Users can view own profile` — `to public` | حتى الزائر غير المسجّل |

النتيجة العملية: `role` محمي بتريجر `trg_guard_profile_role` ✅، لكن **أرقام تليفات وإيميلات كل المستخدمين والبيعين قابلة للقراءة من أي حساب**، و`category` / `provider_id` يقدر الحساب يغيّرها لنفسه (ده يفتح لوحة البائع لنشاط مش معتمد — الاعتماد العام لسه قايم على `status='approved'` في جدول القسم).

`products`: سياسة `Public read approved products` فيها `OR (auth.role() = 'authenticated')` → أي مسجّل بيشوف المنتجات اللي لسه `pending`/مرفوضة.

`barber_status` (جدول قديم): `Auth write barber_status` — `for all to authenticated using true with check true`؛ الجدول ده بقى متجاوز (الحالة بقت في `barber_profiles.status`) والكتابة عليه مفتوحة لأي حساب.

مكرّرات بلا ضرر وظيفي: `orders` و`order_items` فيهم **٤ سياسات insert مختلفة** لنفس الحاجة (`orders_insert_any` + `Anyone create orders` + `Public can create orders` + `Anon can create orders`) — شغلهم كله واحد (مسار الزائر). لو اتوحدوا في سياسة واحدة لكل جدول الترتيب بيكون أسهل.

ملاحظة من التعريف الحي: `products.status` الـDefault بتاعه **`'approved'`** (مش `pending`). الأمان دلوقتي إن التريجر `trg_enforce_seller_product_insert` بيجبر `pending` لأي حساب مش أدمن، فالحاجة شغالة — بس أي مسار يدوي يعمل insert من غير التريجر ده (مثلاً SQL Editor بحساب أدمن) بيطلع منتج منشور فورًا.

كمان `profiles.role` الـDefault بتاعه `'seller'`، و`trg_guard_profile_role` بيرجّعه `visitor` لأي تسجيل من المتصفح — فالسلوك صح، بس الـDefault في التعريف مش هو اللي الموقع بيشوفه.

## ٦) الحالة دلوقتي

1. ✅ تصدير كامل: `export/live/{functions,policies,triggers,tables}.sql` + `export/live/core-<table>.sql` للست جداول.
2. ✅ `supabase/06-live-sync.sql` — الدوال والتريجر اللي كانو على القاعدة ملهمش ملف + النسخة الحيّة من دوال المخزون و`is_admin()`.
3. ✅ `supabase/07-core-tables-from-live.sql` — الجداول الأساسية الستة بالكامل: أمر الإنشاء + Defaults + **٢٢ قيد** + الفهارس + تفعيل RLS + **٣٩ سياسة**. بقى في يدك نسخة تبنّي مشروع جديد من `01 → 07 → 91` من غير ما تعتمد على الداشبورد.
4. ⏳ `06` و`07` **اتكتبوا بس ملزومين تشغيل على القاعدة الحالية** (هي كده بالظبط). شغّليهم لو اتعمل مشروع جديد.
5. ⏳ قرار منها: تنضيف داتا الاختبار (٤ أنشطة معتمدة + حسابات تجريبية + طلبات تجريبية) بـ `99-cleanup-test-data.sql`.
6. ⏳ قرار منها: تشديد سياسات `profiles` (نقطة ٥) — محتاجة اختبار مسار البائع والزائر بعدها.
7. ⏳ لسه ما اتصدّرش من `00`: الأقسام ٩ و١٠ (Storage buckets وسياساتها + الـGRANTS) — لو عايزة التوثيق كامل.
