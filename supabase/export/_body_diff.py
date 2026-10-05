import io, os, re, glob

EXPORT = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export\live'
SUPA = r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase'

files = {os.path.basename(p): io.open(p, encoding='utf-8', errors='replace').read()
         for p in glob.glob(os.path.join(SUPA, '*.sql'))
         if not os.path.basename(p).startswith('00-')}

fns = io.open(os.path.join(EXPORT, 'functions.sql'), encoding='utf-8').read()
blocks = re.split(r'\n(?=CREATE OR REPLACE FUNCTION )', fns)

def norm(s):
    s = re.sub(r'\s+', ' ', s)
    s = s.replace('public.', '')
    return s.strip().lower()

for b in blocks:
    m = re.match(r'CREATE OR REPLACE FUNCTION public\.([A-Za-z_0-9]+)', b)
    if not m:
        continue
    name = m.group(1)
    body = b.split('$function$')[1] if '$function$' in b else ''
    nb = norm(body)
    found = [f for f, t in files.items() if nb and nb in norm(t)]
    # also check the function exists at all
    exists = [f for f, t in files.items() if re.search(r'\b' + re.escape(name) + r'\b', t)]
    tag = 'SAME as ' + ','.join(found) if found else ('DIFFERS / file=' + ','.join(exists) if exists else 'NOT IN ANY FILE')
    print(('%-34s' % name) + tag)
