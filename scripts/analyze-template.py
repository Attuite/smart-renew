import json, sys

with open(r'D:\AI\smartrenew9\smart-renew\assets\report-templates\report-template-v1.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Total blocks:', len(data['blocks']))

# Style distribution
styles = {}
for b in data['blocks']:
    s = b.get('style', 'none')
    styles[s] = styles.get(s, 0) + 1
print('\n--- Style Distribution ---')
for k, v in sorted(styles.items(), key=lambda x: -x[1]):
    print(k + ': ' + str(v))

# Heading structure
print('\n--- Heading Structure ---')
for b in data['blocks']:
    s = b.get('style', '')
    if s.startswith('Heading'):
        print(s + ' | ' + b['id'] + ' | ' + b.get('text', '')[:80])

# Table summary
print('\n--- Tables ---')
ti = 0
for b in data['blocks']:
    if b.get('type') == 'table':
        ti += 1
        rows = b.get('rows', [])
        ncols = len(rows[0]['cells']) if rows else 0
        header = ' | '.join(rows[0]['cells'])[:120] if rows else ''
        print('Table ' + str(ti) + ': ' + b['id'] + ' | rows:' + str(len(rows)) + ' cols:' + str(ncols) + ' | ' + header)

# Image blocks
print('\n--- Blocks with images ---')
for b in data['blocks']:
    imgs = b.get('images', [])
    if imgs:
        print(b['id'] + ' (' + b.get('style', '') + ') | images: ' + str(len(imgs)) + ' | text: ' + b.get('text', '')[:60])
    if b.get('type') == 'table':
        for ri, row in enumerate(b.get('rows', [])):
            ci = row.get('cellImages', [])
            if any(cimgs for cimgs in ci):
                print('  ' + b['id'] + ' row ' + str(ri) + ' has cellImages')
