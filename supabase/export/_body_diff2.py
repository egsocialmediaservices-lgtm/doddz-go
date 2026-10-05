import io, os, re, glob, difflib

EXPORT = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export\live'
SUPA = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase'
files = {os.path.basename(p): io.open(p, encoding='utf-8', errors='replace').read()
         for p in glob.glob(os.path.join(SUPA, '*.sql'))
         if not os.path.basename(p).startswith('00-')}

fns = io.open(os.path.join(EXPORT, 'functions.sql'), encoding='utf-8').read()
blocks = re.split(r'\n(?=CREATE OR REPLACE FUNCTION )', fns)

def body_of(text):
    # take substring between first pair of $$ / $function$ tags
    m = re.search(r'\$\w*\$(.*?)\$\w*\$', text, re.S)
    return m.group(1) if m else ''

def lines(b):
    out = []
    for l in b.splitlines():
        l = re.sub(r'\s+', ' ', l).strip().lower()
        if l:
            out.append(l)
    return out

for b in blocks:
    m = re.match(r'CREATE OR REPLACE FUNCTION public\.([A-Za-z_0-9]+)', b)
    if not m:
        continue
    name = m.group(1)
    live = lines(body_of(b.split('$function$', 1)[1]) if False else b.split('$function$')[1])
    cands = {f: t for f, t in files.items() if re.search(r'create or replace function (public\.)?' + re.escape(name), t, re.I)}
    best = None
    for f, t in cands.items():
        mm = re.search(r'create or replace function (public\.)?' + re.escape(name) + r'\b[\s\S]*?\$\w*\$([\s\S]*?)\$\w*\$', t, re.I)
        if not mm:
            continue
        repo = lines(mm.group(2))
        ratio = difflib.SequenceMatcher(None, repo, live).ratio()
        if best is None or ratio > best[1]:
            best = (f, ratio, repo)
    if best is None:
        print('### %s : لا يوجد جسم دالة في الملفات' % name)
        continue
    f, ratio, repo = best
    print('### %s  ->  %s  similarity %.2f' % (name, f, ratio))
    if ratio < 0.995:
        for l in difflib.unified_diff(repo, live, 'file', 'live', lineterm='', n=1):
            print('    ' + l[:160])
    print()
