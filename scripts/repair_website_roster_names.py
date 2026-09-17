from pathlib import Path
import re,json

p=Path('index.html')
text=p.read_text(encoding='utf-8')
m=re.search(r'const BASE_ROSTER=(\[.*?\]);\nconst NICHE_MAP=',text,re.S)
if not m: raise SystemExit('BASE_ROSTER not found')
roster=json.loads(m.group(1))

canonical={
'agency-women-lana':'Lana',
'new-york-women-agang':'Agang','new-york-women-claudia-lucchini':'Claudia Lucchini','new-york-women-callie-steg':'Callie Steg','new-york-women-dr-nialah-wilson-small':'Dr. Nialah Wilson-Small','new-york-women-hadiyah-lawal':'Hadiyah Lawal','new-york-women-janel-cheatham':'Janel Cheatham','new-york-women-june-ramadhan':'June Ramadhan','new-york-women-maja-stockwell':'Maja Stockwell','new-york-women-mary-timms':'Mary Timms','new-york-women-mob-e':'Mobée','new-york-women-molly-gardiner':'Molly Gardiner','new-york-women-ni-simone':'Ni Simone','new-york-women-rachel-stone':'Rachel Stone','new-york-women-sal-soliman':'Sal Soliman','new-york-women-seven-wright':'Seven Wright','new-york-women-shanel-cheatham':'Shanel Cheatham','new-york-women-tinin':'Tinin',
'new-york-men-justin-bell':'Justin Bell','new-york-men-matt-rossi':'Matt Rossi','new-york-curve-sarah-mendez':'Sarah Mendez','new-york-development-em0-spit':'Em0 Spit','new-york-development-victoria-sepiashvili':'Victoria Sepiashvili',
'london-women-aj-raubunch':'AJ Raubunch','london-women-ambre-prognitz':'Ambre Prognitz','london-women-amy-allison':'Amy Allison','london-women-daisy-ibi':'Daisy Ibi','london-women-molly-gardiner':'Molly Gardiner','london-men-alex-connor':'Alex Connor','london-men-harry':'Harry','london-men-mikael':'Mikael',
'milan-women-camelia-boca':'Camelia Boca','milan-women-molly-gardiner':'Molly Gardiner',
'los-angeles-women-elle-pickens':'Elle Pickens','los-angeles-women-florencia-gordon':'Florencia Gordon','los-angeles-women-malia':'Malia','los-angeles-men-justice-harper':'Justice Harper',
'miami-women-alaina':'Alaina','miami-women-anastasia':'Anastasia','miami-women-ann-neika':'Ann Neika','miami-women-darian':'Darian','miami-women-fianna-mchale':'Fianna McHale','miami-women-hadiyah-lawal':'Hadiyah Lawal','miami-women-merhoodjie-denaut':'Merhoodjie Denaut','miami-women-norma-huembes':'Norma Huembes','miami-women-phara-joseph':'Phara Joseph','miami-women-raquel':'Raquel','miami-men-khafre-franklin':'Khafre Franklin','miami-men-stevenson-jean':'Stevenson Jean',
'paris-women-legacy-kalaba':'Kalaba','paris-women-legacy-raquel-pelissier':'Raquel Pélissier',
'new-york-women-sophia-pippen':'Sophia Pippen','new-york-women-anhelena-sobol':'Anhelena Sobol','germany-women-bianca-eigenfeld-own':'Bianca Eigenfeld Own','draft-women-amelie':'Amélie','draft-women-clara':'Clara','london-main-reine':'Reine'
}
changed=[]
for r in roster:
    rid=r.get('id','')
    if rid in canonical and r.get('name')!=canonical[rid]:
        changed.append([rid,r.get('name'),canonical[rid]])
        r['name']=canonical[rid]
    elif rid.startswith('site-') and r.get('name'):
        # Correct hyphen/apostrophe capitalization introduced by spaced-letter website titles.
        n=r['name']
        if '-' in n or "'" in n:
            fixed=n.title()
            if fixed!=n:
                changed.append([rid,n,fixed]);r['name']=fixed

# Safety checks: the sync must not create duplicate record IDs or duplicate exact profile URLs.
ids=[r.get('id') for r in roster if r.get('id')]
if len(ids)!=len(set(ids)): raise SystemExit('Duplicate model IDs after website sync')
urls=[r.get('profileUrl') for r in roster if r.get('profileUrl') and 'chezlesmannequins.com' in r.get('profileUrl')]
if len(urls)!=len(set(urls)): raise SystemExit('Duplicate exact CLM profile URLs after website sync')

text=text[:m.start(1)]+json.dumps(roster,ensure_ascii=False,separators=(',',':'))+text[m.end(1):]
p.write_text(text,encoding='utf-8')
scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',text,re.S|re.I)
Path('/tmp/app.js').write_text('\n'.join(scripts),encoding='utf-8')
print(json.dumps({'finalRosterCount':len(roster),'nameRepairs':changed},ensure_ascii=False,indent=2))
