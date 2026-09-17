from pathlib import Path
import base64, re

ROOT=Path('.')
HTML=ROOT/'index.html'
P1_B64=ROOT/'assets/models/sophia-pippen-1.b64'
P2_B64=ROOT/'assets/models/sophia-pippen-2.b64'
P1=ROOT/'assets/models/sophia-pippen-1.jpg'
P2=ROOT/'assets/models/sophia-pippen-2.jpg'

# Decode the exact user-supplied photos staged as base64 text.
P1.write_bytes(base64.b64decode(P1_B64.read_text(encoding='utf-8').strip()))
P2.write_bytes(base64.b64decode(P2_B64.read_text(encoding='utf-8').strip()))
P1_B64.unlink()
P2_B64.unlink()

text=HTML.read_text(encoding='utf-8')
model_id='new-york-women-sophia-pippen'
photo1='https://raw.githubusercontent.com/justinneal907-gif/CLM-CRM/main/assets/models/sophia-pippen-1.jpg'
photo2='https://raw.githubusercontent.com/justinneal907-gif/CLM-CRM/main/assets/models/sophia-pippen-2.jpg'

# Give Sophia a default image plus both package images in the seeded roster record.
start=text.find('{"id":"'+model_id+'"')
if start < 0:
    raise SystemExit('Sophia seed record not found')
end=text.find('},{"id":', start)
if end < 0:
    raise SystemExit('Sophia seed record end not found')
record=text[start:end+1]
record=record.replace('"photoUrl":""', '"photoUrl":"'+photo1+'"', 1)
record=record.replace('"photoFilename":""', '"photoFilename":"sophia-pippen-1.jpg"', 1)
if '"photos":[' not in record:
    needle='"photoFilename":"sophia-pippen-1.jpg"'
    record=record.replace(needle, needle+',"photos":["'+photo1+'","'+photo2+'"]', 1)
text=text[:start]+record+text[end+1:]

marker='function mergeContacts(recovered,current){'
helper=f'''const SOPHIA_DRAFT_MODEL_ID='{model_id}';
const SOPHIA_DRAFT_PHOTO_1='{photo1}';
const SOPHIA_DRAFT_PHOTO_2='{photo2}';
function addSophiaToDraftRecord(record){{
  if(!record||typeof record!=='object')return record;
  const out={{...record}};
  out.modelIds=[...new Set([...(Array.isArray(out.modelIds)?out.modelIds:[]),SOPHIA_DRAFT_MODEL_ID])];
  if(Array.isArray(out.models)){{
    const hasSophia=out.models.some(v=>typeof v==='string'?v.trim().toLowerCase()==='sophia pippen':(v?.id===SOPHIA_DRAFT_MODEL_ID||String(v?.name||'').trim().toLowerCase()==='sophia pippen'));
    if(!hasSophia)out.models=[...out.models,'Sophia Pippen'];
  }}
  out.photoSelections={{...(out.photoSelections||{{}})}};
  if(!out.photoSelections[SOPHIA_DRAFT_MODEL_ID])out.photoSelections[SOPHIA_DRAFT_MODEL_ID]=SOPHIA_DRAFT_PHOTO_1;
  out.html='';
  return out;
}}
function addSophiaToAllDrafts(data){{
  data.recovery=data.recovery||{{}};
  if((data.recovery.sophiaAllDraftsVersion||0)>=1)return data;
  data.drafts=(data.drafts||[]).map(addSophiaToDraftRecord);
  data.draft=addSophiaToDraftRecord(data.draft||{{}});
  data.selected=[...new Set([...(Array.isArray(data.selected)?data.selected:[]),SOPHIA_DRAFT_MODEL_ID])];
  data.photoLibrary=data.photoLibrary||{{}};
  const lib=Array.isArray(data.photoLibrary[SOPHIA_DRAFT_MODEL_ID])?[...data.photoLibrary[SOPHIA_DRAFT_MODEL_ID]]:[];
  for(const photo of [{{url:SOPHIA_DRAFT_PHOTO_1,label:'Sophia Pippen · Photo 1'}},{{url:SOPHIA_DRAFT_PHOTO_2,label:'Sophia Pippen · Photo 2'}}]){{
    if(!lib.some(x=>(typeof x==='string'?x:x?.url)===photo.url))lib.push(photo);
  }}
  data.photoLibrary[SOPHIA_DRAFT_MODEL_ID]=lib.slice(-8);
  const m=(data.models||[]).find(x=>x.id===SOPHIA_DRAFT_MODEL_ID||String(x.name||'').trim().toLowerCase()==='sophia pippen');
  if(m){{
    m.photo=SOPHIA_DRAFT_PHOTO_1;m.photoUrl=SOPHIA_DRAFT_PHOTO_1;m.photoFilename='sophia-pippen-1.jpg';
    m.photos=[...new Set([...(Array.isArray(m.photos)?m.photos:[]),SOPHIA_DRAFT_PHOTO_1,SOPHIA_DRAFT_PHOTO_2])];
  }}
  data.recovery.sophiaAllDraftsVersion=1;
  data.recovery.sophiaAllDraftsUpdatedOn='2026-09-17';
  return data;
}}
'''
if 'function addSophiaToAllDrafts(data)' not in text:
    i=text.find(marker)
    if i < 0:
        raise SystemExit('migration insertion point not found')
    text=text[:i]+helper+text[i:]

old='return removeEm0FromDrafts(applySophiaDescription(applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data))))))}'
new='return addSophiaToAllDrafts(removeEm0FromDrafts(applySophiaDescription(applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data)))))))}'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('applyRecovered return not found')

HTML.write_text(text,encoding='utf-8')

# Validate expected permanent state and emit the app JavaScript for node --check.
html=HTML.read_text(encoding='utf-8')
assert 'function addSophiaToAllDrafts(data)' in html
assert 'sophiaAllDraftsVersion=1' in html
assert photo1 in html and photo2 in html
assert P1.exists() and P2.exists()
scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
Path('/tmp/app.js').write_text('\\n'.join(scripts),encoding='utf-8')
