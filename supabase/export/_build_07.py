import io, os

LIVE = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export\live'
OUT = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\07-core-tables-from-live.sql'

order = ['profiles', 'products', 'orders', 'order_items', 'signup_requests', 'barber_status']

header = """-- ================================================================
-- Doddz Go — الجداول الأساسية الستة، بالحرف زي ما هي مشغّلة على القاعدة
-- مأخوذة من تصدير القاعدة الحيّة (2026-10-03) — شوف export/DRIFT-REPORT.md
--
-- ليه الملف ده؟ الجداول دي اتعملت من داشبورد Supabase بإيد زمان، فمفيش
-- أي ملف SQL في المجلد بيعملها. من غيرها أي قاعدة جديدة تتبنى على الملفات
-- بس بتقع من أول صفحة (مالهاش profiles ولا products ولا orders).
--
-- الترتيب مهم (التبعية): profiles ← products ← orders ← order_items
--                        ← signup_requests ← barber_status
--
-- آمن على القاعدة الحالية: كل قيد متلف بـ do $$ … exception $$ فسكت لو
-- موجود، والسياسات بتتعمل drop ثم create بنفس التعريف حرفيًا.
--
-- لو ظهر مربع «Enable Row Level Security؟» أي اختيار يمشي: الملف نفسه
-- بيفعّل RLS لكل جدول في نصّه.
--
-- ملاحظة: التعريفات بتطابق الواقع الحالي بما فيه السياسات القديمة
-- السمحة (زي `Users read own profile … OR true`). تشديدها قرار تاني
-- مشمول في DRIFT-REPORT.md نقطة ٥ — الملف ده توثيق مش توصية.
-- ================================================================

"""

parts = []
for name in order:
    txt = io.open(os.path.join(LIVE, 'core-' + name + '.sql'), encoding='utf-8').read().strip()
    out = []
    for line in txt.splitlines():
        s = line.strip()
        if s.startswith('alter table') and ' add constraint ' in s:
            out.append('do $$ begin')
            out.append('  ' + s)
            out.append('exception when others then')
            out.append("  if sqlstate not in ('42P07', '42710') then raise; end if;")
            out.append('end $$;')
        else:
            out.append(line)
    sep = '═' * max(2, 56 - len(name))
    parts.append('-- ══ ' + name + ' ' + sep + '\n' + '\n'.join(out))

io.open(OUT, 'w', encoding='utf-8', newline='\n').write(header + '\n\n'.join(parts) + '\n')
data = io.open(OUT, encoding='utf-8').read()
print('written bytes', len(data))
print('guarded constraint blocks:', data.count('exception when others'))
print('create table stmts:', data.count('create table if not exists public.'))
print('policies:', data.count('create policy "'))
print('rls enables:', data.count(' enable row level security;'))
