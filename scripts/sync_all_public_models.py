from pathlib import Path
import json,re

p=Path('index.html')
text=p.read_text(encoding='utf-8')

records=[
 {"id":"public-development-ainoa","name":"Ainoa","location":"","division":"Development","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/development","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True,"notes":"Listed on the public Development board in the September 17, 2026 site index; individual profile details were not exposed by the current crawl."},
 {"id":"public-women-1-adele-ustupa","name":"Adele Ustupa","location":"","division":"Women (public board women-1)","measurements":"Height: 172cm | Bust: 75cm | Waist: 57cm | Hip: 75cm | Shoe: 39/40EU","profileUrl":"https://www.chezlesmannequins.com/women-1/adele","photoUrl":"","photoFilename":"Facetune_04-08-2025-17-55-21.jpeg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-1-evelina","name":"Evelina","location":"","division":"Women (public board women-1)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-1/evelina","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-1-zile","name":"Zile","location":"","division":"Women (public board women-1)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-1/zile","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-1-elizabete","name":"Elizabete","location":"","division":"Women (public board women-1)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-1/elizabete-kft2n","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-1-erica","name":"Erica","location":"","division":"Women (public board women-1)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-1/erica","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-81-asha-peets","name":"A’sha Peets","location":"","division":"Women (public board women-81)","measurements":"Height: 5’10’’ | Bust: 33’’ | Waist: 24’’ | Hip: 35’’","profileUrl":"https://www.chezlesmannequins.com/women-81/a-q-u-i-s-h-a-p-e-e-t-s","photoUrl":"","photoFilename":"Screenshot_20200702-231359_Samsung Internet.jpg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-81-iyanu","name":"Iyanu","location":"","division":"Women (public board women-81)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-81/iyanu","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-81-mercedes","name":"Mercedes","location":"","division":"Women (public board women-81)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-81/mercedes","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-81-nadya","name":"Nadya","location":"","division":"Women (public board women-81)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-81/n-a-d-y-a","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women-81-tsahai","name":"Tsahai","location":"","division":"Women (public board women-81)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women-81/tsahai","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-adhar-arop","name":"Adhar Arop","location":"Nairobi","division":"Women (public board women7)","measurements":"Height: 5’10’’ | Bust: 31’’ | Waist: 23.5’’ | Hip: 34’’","profileUrl":"https://www.chezlesmannequins.com/women7/a-d-h-a-r","photoUrl":"","photoFilename":"IMG_2850.jpg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-idong","name":"Idong","location":"","division":"Women (public board women7)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women7/i-d-o-n-g","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-leo","name":"Leo","location":"","division":"Women (public board women7)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women7/l-e-o-b-o-y-i-k-a","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-mildred","name":"Mildred","location":"","division":"Women (public board women7)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women7/m-i-l-d-r-e-d-a-c-h-i-e-n-g","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-nyabalang","name":"Nyabalang","location":"","division":"Women (public board women7)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women7/n-y-a-b-a-l-a-n-g","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-seyi-joseph","name":"Seyi Joseph","location":"Nigeria","division":"Women (public board women7)","measurements":"Height: 5’11” | Bust: 34” | Waist: 27” | Hip: 35”","profileUrl":"https://www.chezlesmannequins.com/women7/s-e-y-i","photoUrl":"","photoFilename":"Screen Shot 2022-07-08 at 7.32.50 PM.png","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-women7-thopego","name":"Thopego","location":"","division":"Women (public board women7)","measurements":"Measurements pending public profile sync","profileUrl":"https://www.chezlesmannequins.com/women7/thopego","photoUrl":"","photoFilename":"","source":"Chez Les Mannequins public board","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-men-4-inaki","name":"Iñaki","location":"","division":"Men (public board men-4)","measurements":"Height: 176cm | Chest: 96cm | Waist: 79cm | Hip: 95cm | Shoe: 45EU","profileUrl":"https://www.chezlesmannequins.com/men-4/i-n-a-k-i","photoUrl":"","photoFilename":"IMG_1203.jpg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-men-4-pau-tubert","name":"Pau Tubert","location":"","division":"Men (public board men-4)","measurements":"Height: 183cm | Chest: 104cm | Waist: 84cm | Hip: 101.6cm | Shoe: 41EU","profileUrl":"https://www.chezlesmannequins.com/men-4/p-a-u-t-u-b-e-r-t","photoUrl":"","photoFilename":"IMG-4900.jpg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True},
 {"id":"public-curve-2-sophie-harvey","name":"Sophie Harvey","location":"","division":"Curve (public board curve-2)","measurements":"Height: 172cm | Bust: 96cm | Waist: 76cm | Hip: 108cm | Shirt: 40 | Trousers: 42 | Eye: Green | Shoe: 41","eyes":"Green","profileUrl":"https://www.chezlesmannequins.com/curve-2/s-o-p-h-i-e","photoUrl":"","photoFilename":"eyes.jpeg","source":"Chez Les Mannequins public profile","sourceDate":"2026-09-17","activeBoard":True}
]

m=re.search(r"const BASE_ROSTER=(\[.*?\]);\nconst NICHE_MAP=",text,re.S)
if not m: raise SystemExit('BASE_ROSTER not found')
roster=json.loads(m.group(1))

def norm(s):
    return re.sub(r'[^a-z0-9]+','',str(s).lower().replace('ñ','n').replace('’',"'").replace('‘',"'"))
existing_ids={x.get('id') for x in roster}
existing_profiles={x.get('profileUrl') for x in roster if x.get('profileUrl')}
existing_names={norm(x.get('name','')) for x in roster}
added=[]
for r in records:
    # Profile URL is the strongest unique key; otherwise prevent accidental duplicate people.
    if r['id'] in existing_ids or (r.get('profileUrl') and r['profileUrl'] in existing_profiles) or norm(r['name']) in existing_names:
        continue
    roster.append(r);added.append(r['name']);existing_ids.add(r['id']);existing_profiles.add(r.get('profileUrl'));existing_names.add(norm(r['name']))
new='const BASE_ROSTER='+json.dumps(roster,ensure_ascii=False,separators=(',',':'))+';\nconst NICHE_MAP='
text=text[:m.start()]+new+text[m.end():]
# Record the public-roster reconciliation without disturbing saved workspace data.
text=text.replace("rosterCheckedOn:'2026-09-14'","rosterCheckedOn:'2026-09-17'",1)
p.write_text(text,encoding='utf-8')

html=p.read_text(encoding='utf-8')
for r in records:
    assert r['name'] in html
scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
Path('/tmp/app.js').write_text('\n'.join(scripts),encoding='utf-8')
print('Added',len(added),'models:',', '.join(added))
