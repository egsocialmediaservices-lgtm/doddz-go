import io, os, re, glob

EXPORT = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export\live'
SUPA = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase'
DIAG = os.path.join(SUPA, 'diagnostics')

files = [p for p in glob.glob(os.path.join(SUPA, '*.sql'))]
repo_text = {}
for p in files:
    repo_text[os.path.basename(p)] = io.open(p, encoding='utf-8', errors='replace').read()
all_text = '\n'.join(repo_text.values())

def read(name):
    return io.open(os.path.join(EXPORT, name), encoding='utf-8').read()

fns = io.open(os.path.join(EXPORT, 'functions.sql'), encoding='utf-8').read()
fn_names = re.findall(r'CREATE OR REPLACE FUNCTION public\.([a-zA-Z_0-9]+)', fns)

pol = read('policies.sql')
pol_rows = [l for l in pol.splitlines() if l.startswith('create policy ')]
# policy name = text between 'create policy ' and ' on public.'
pol_named = []
for l in pol_rows:
    m = re.match(r'create policy (.*?) on public\.([a-zA-Z_0-9]+) ', l)
    if m:
        pol_named.append((m.group(1), m.group(2)))
    else:
        print('UNPARSED POLICY:', l[:120])

trg = read('triggers.sql')
trg_named = re.findall(r'CREATE TRIGGER ([a-zA-Z_0-9]+) \w+.*? ON public\.([a-zA-Z_0-9]+)', trg)

tbl = read('tables.sql')
tbl_named = [l.split(' (')[0].strip() for l in tbl.splitlines() if 'rls=' in l]

print('=== FUNZIONI (%d) ===' % len(fn_names))
for n in fn_names:
    hits = [f for f, t in repo_text.items() if re.search(r'\b' + re.escape(n) + r'\b', t)]
    print(('  MISSING ' if not hits else '  ok      ') + n.ljust(32) + (','.join(hits) if hits else '<< ليس في أي ملف'))

print()
print('=== TRIGGERS (%d) ===' % len(trg_named))
for n, t in trg_named:
    hits = [f for f, tx in repo_text.items() if re.search(r'\b' + re.escape(n) + r'\b', tx)]
    print(('  MISSING ' if not hits else '  ok      ') + n.ljust(34) + t.ljust(20) + (','.join(hits) if hits else '<< ليس في أي ملف'))

print()
print('=== TABLES (%d) ===' % len(tbl_named))
for n in tbl_named:
    hits = [f for f, tx in repo_text.items() if re.search(r'create table[\s\S]{0,40}?\b' + re.escape(n) + r'\b', tx, re.I)]
    print(('  MISSING ' if not hits else '  ok      ') + n.ljust(28) + (','.join(hits) if hits else '<< مفيش create table في الملفات'))

print()
print('=== POLICIES (%d) ===' % len(pol_named))
miss = []
for n, t in pol_named:
    hits = [f for f, tx in repo_text.items() if re.search(r'(?i)create (or replace )?policy\b[^\n;]*' + re.escape(n), tx)]
    if not hits:
        miss.append((n, t))
print('missing count:', len(miss))
for n, t in miss:
    print('  MISSING  ' + n[:70] + '   [' + t + ']')
