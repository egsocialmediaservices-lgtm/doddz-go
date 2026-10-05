import io, os, re

src = r'''C:/Users/HP/.qoder/tmp/C--Users-HP-Downloads-last-vers-training--2--training/attachments/6608e5bd-8580-4679-8bf1-75d930dbbcc5/0d22c5b4-738d-43bd-907a-bc4c0a00630f.txt'''
outdir = os.path.join(r'C:\Users\HP\Downloads\last vers\training (2)\training\supabase\export', 'live')
os.makedirs(outdir, exist_ok=True)

lines = io.open(src, encoding='utf-8', errors='replace').read().split('\n')
names = ('functions', 'policies', 'triggers', 'tables')

for l in lines[2:]:
    m = re.match(r'^\|\s*(' + '|'.join(names) + r')\s*\|\s*(.*)$', l.rstrip())
    if not m:
        continue
    name, body = m.group(1), m.group(2)
    body = re.sub(r'\s*\|\s*$', '', body.rstrip())
    body = body.replace('<br>', '\n')
    body = body.replace('\\|', '|')          # markdown-escaped pipes from the grid
    body = re.sub(r'(?m)^ {1,20}\|', '', body)  # leftover continuation borders
    io.open(os.path.join(outdir, name + '.sql'), 'w', encoding='utf-8', newline='\n').write(body + '\n')
    print(name, 'chars', len(body), '| escaped-pipes left:', body.count('\\|'))
