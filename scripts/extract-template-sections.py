"""
Extract template sections from report-template-v1.json.
Produces a structured JSON mapping of all 1166 blocks into sections.
"""
import json, os

BASE = r'D:\AI\smartrenew9\smart-renew'
with open(os.path.join(BASE, 'assets', 'report-templates', 'report-template-v1.json'), 'r', encoding='utf-8') as f:
    data = json.load(f)

blocks = data['blocks']

# Build sections from Heading structure
sections = []
current_h1 = None
current_h2 = None
current_h3 = None

for b in blocks:
    style = b.get('style', '')
    bid = b['id']
    text = b.get('text', '')
    btype = b.get('type', 'paragraph')

    if style == 'Heading 1':
        current_h1 = {'id': bid, 'title': text, 'h2s': []}
        sections.append(current_h1)
        current_h2 = None
        current_h3 = None
    elif style == 'Heading 2' and current_h1:
        current_h2 = {'id': bid, 'title': text, 'h3s': [], 'blocks': []}
        current_h1['h2s'].append(current_h2)
        current_h3 = None
    elif style == 'Heading 3' and current_h2:
        current_h3 = {'id': bid, 'title': text, 'blocks': []}
        current_h2['h3s'].append(current_h3)
    elif style == 'Heading 4' and current_h2:
        # Heading 4 = indicator item titles within h3 or directly under h2
        current_h3 = {'id': bid, 'title': text, 'blocks': [], 'isIndicator': True}
        current_h2['h3s'].append(current_h3)

# Count blocks per section range
def find_block_index(bid):
    for i, b in enumerate(blocks):
        if b['id'] == bid:
            return i
    return -1

# For each section, find the range of blocks
for s in sections:
    s['startIndex'] = find_block_index(s['id'])
    for h2 in s['h2s']:
        h2['startIndex'] = find_block_index(h2['id'])
        for h3 in h2['h3s']:
            h3['startIndex'] = find_block_index(h3['id'])

# Now assign blocks to sections by determining boundaries
for si, s in enumerate(sections):
    start = s['startIndex']
    end = sections[si + 1]['startIndex'] if si + 1 < len(sections) else len(blocks)
    s['blockRange'] = [start, end - 1]

    for hi, h2 in enumerate(s['h2s']):
        h2_start = h2['startIndex']
        # Find next h2 or h1 boundary
        h2_end = s['blockRange'][1]
        for hj in range(hi + 1, len(s['h2s'])):
            h2_end = s['h2s'][hj]['startIndex'] - 1
            break
        h2['blockRange'] = [h2_start, h2_end]

        for h3i, h3 in enumerate(h2['h3s']):
            h3_start = h3['startIndex']
            h3_end = h2_end
            for h3j in range(h3i + 1, len(h2['h3s'])):
                h3_end = h2['h3s'][h3j]['startIndex'] - 1
                break
            h3['blockRange'] = [h3_start, h3_end]

            # Count block types in this range
            range_blocks = blocks[h3_start:h3_end + 1]
            h3['stats'] = {
                'total': len(range_blocks),
                'paragraphs': sum(1 for b in range_blocks if b.get('type') == 'paragraph'),
                'tables': sum(1 for b in range_blocks if b.get('type') == 'table'),
                'images': sum(len(b.get('images', [])) for b in range_blocks),
            }

# Also collect all images in the document
all_images = []
for b in blocks:
    for img in b.get('images', []):
        all_images.append({'blockId': b['id'], 'src': img.get('src', ''), 'alt': img.get('alt', '')})
    for ri, row in enumerate(b.get('rows', [])):
        for ci, cell_imgs in enumerate(row.get('cellImages', [])):
            for img in cell_imgs:
                all_images.append({'blockId': b['id'], 'row': ri, 'col': ci, 'src': img.get('src', ''), 'alt': img.get('alt', '')})

# Old project keywords to detect
old_keywords = [
    '绵阳', '科技城新区', '重点片区', '虹苑路社区', '金祥寺社区', '张家营村',
    '普明街道', '永兴镇', '安昌河', '青片小区', '高新假日小区', '文泉凯旋小区',
    '太阳岛小区', '广夏城', '广厦城', '华瑞汽车厂', '路南工业园',
    '玻钢厂', '绵阳市', '2025年', '2026年'
]

# Scan blocks for old project content
old_content_hits = []
for b in blocks:
    text = b.get('text', '')
    if any(kw in text for kw in old_keywords):
        old_content_hits.append({
            'blockId': b['id'],
            'style': b.get('style', ''),
            'textPreview': text[:120],
            'keywords': [kw for kw in old_keywords if kw in text]
        })

# Stats summary
stats = {
    'totalBlocks': len(blocks),
    'totalParagraphs': sum(1 for b in blocks if b.get('type') == 'paragraph'),
    'totalTables': sum(1 for b in blocks if b.get('type') == 'table'),
    'totalImages': len(all_images),
    'totalSections': len(sections),
    'totalH2': sum(len(s['h2s']) for s in sections),
    'totalH3': sum(len(h2['h3s']) for s in sections for h2 in s['h2s']),
    'oldProjectHits': len(old_content_hits),
    'heading1Count': len(sections),
}

output = {
    'templateId': data['id'],
    'stats': stats,
    'sections': sections,
    'allImages': all_images,
    'oldContentHits': old_content_hits,
}

outpath = os.path.join(BASE, 'docs', 'report-studio', 'template-section-analysis.json')
os.makedirs(os.path.dirname(outpath), exist_ok=True)
with open(outpath, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print('Wrote template-section-analysis.json')
print(json.dumps(stats, ensure_ascii=False, indent=2))
print('Old project content hits:', len(old_content_hits))
for h in old_content_hits[:10]:
    print('  ' + h['blockId'] + ' | ' + h['textPreview'][:60])
