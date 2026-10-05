import io, os, re

src = r'''C:/Users/HP/.qoder/tmp/C--Users-HP-Downloads-last-vers-training--2--training/attachments/6608e5bd-8580-4679-8bf1-75d930dbbcc5/6221089b-0014-4475-8d77-143aa4683998.txt'''
outdir = os.path.join(r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export', 'live')
os.makedirs(outdir, exist_ok=True)

lines = io.open(src, encoding='utf-8', errors='replace').read().split('\n')
rows = []
for l in lines[2:]:
    m = re.match(r'^\|\s*([a-z_]+)\s*\|\s*(.*)$', l.rstrip())
    if not m:
        continue
    name, body = m.group(1), m.group(2)
    body = re.sub(r'\s*\|\s*$', '', body.rstrip())
    body = body.replace('<br>', '\n').replace('\\|', '|')
    io.open(os.path.join(outdir, 'core-' + name + '.sql'), 'w', encoding='utf-8', newline='\n').write(body.strip() + '\n')
    rows.append(name)
    print('---', name, 'chars', len(body), '| escaped pipes left:', body.count('\\|'))
print('rows:', rows)
