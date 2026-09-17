from pathlib import Path
import re

p=Path('index.html')
text=p.read_text(encoding='utf-8')

SOPHIA_ID='new-york-women-sophia-pippen'
PHOTO1='https://raw.githubusercontent.com/justinneal907-gif/CLM-CRM/main/assets/models/sophia-pippen-1.jpg'
PHOTO2='https://raw.githubusercontent.com/justinneal907-gif/CLM-CRM/main/assets/models/sophia-pippen-2.jpg'

# Put both uploaded photos on Sophia's canonical seed record.
old='"description":"Daughter of Scottie and Larsa Pippen, Goddaughter of Kim Kardashian","photoUrl":"","photoFilename":""'
new=f'"description":"Daughter of Scottie and Larsa Pippen, Goddaughter of Kim Kardashian","photoUrl":"{PHOTO1}","photoFilename":"sophia-pippen-1.jpg","photos":["{PHOTO1}","{PHOTO2}"]'
if old in text:
    text=text.replace(old,new,1)
elif '"photoFilename":"sophia-pippen-1.jpg"' not in text:
    raise SystemExit('Sophia seed photo insertion point not found')

marker='function mergeContacts(recovered,current){'
helper=f'''const SOPHIA_ALL_DRAFTS_ID='{SOPHIA_ID}';
const SOPHIA_PACKAGE_PHOTOS=['{PHOTO1}','{PHOTO2}'];
function addSophiaToDraftRecord(record){{
  if(!record||typeof record!=='object')return record;
  const out={{...record}};
  out.modelIds=[...new Set([...(Array.isArray(out.modelIds)?out.modelIds:[]),SOPHIA_ALL_DRAFTS_ID])];
  if(Array.isArray(out.models)&&!out.models.some(n=>normalizeName(n)==='sophia pippen'))out.models=[...out.models,'Sophia Pippen'];
  if(Array.isArray(out.modelNames)&&!out.modelNames.some(n=>normalizeName(n)==='sophia pippen'))out.modelNames=[...out.modelNames,'Sophia Pippen'];
  out.photoSelections={{...(out.photoSelections||{{}}),[SOPHIA_ALL_DRAFTS_ID]:SOPHIA_PACKAGE_PHOTOS[0]}};
  out.html='';
  return out;
}}
function addSophiaToAllDrafts(data){{
  const model=(data.models||[]).find(m=>m.id===SOPHIA_ALL_DRAFTS_ID||normalizeName(m.name)==='sophia pippen');
  if(model){{
    model.photo=SOPHIA_PACKAGE_PHOTOS[0];
    model.photoUrl=SOPHIA_PACKAGE_PHOTOS[0];
    model.photoFilename='sophia-pippen-1.jpg';
    model.photos=[...SOPHIA_PACKAGE_PHOTOS];
  }}
  data.photoLibrary={{...(data.photoLibrary||{{}})}};
  const current=Array.isArray(data.photoLibrary[SOPHIA_ALL_DRAFTS_ID])?data.photoLibrary[SOPHIA_ALL_DRAFTS_ID]:[];
  const urls=new Set(current.map(x=>typeof x==='string'?x:x?.url).filter(Boolean));
  const merged=[...current];
  SOPHIA_PACKAGE_PHOTOS.forEach((url,i)=>{{if(!urls.has(url))merged.push({{url,label:`Sophia Pippen photo ${{i+1}}`}})}});
  data.photoLibrary[SOPHIA_ALL_DRAFTS_ID]=merged;
  data.drafts=(data.drafts||[]).map(addSophiaToDraftRecord);
  data.draft=addSophiaToDraftRecord(data.draft||{{}});
  data.selected=[...new Set([...(Array.isArray(data.selected)?data.selected:[]),SOPHIA_ALL_DRAFTS_ID])];
  data.recovery={{...(data.recovery||{{}}),sophiaAllDraftsVersion:1,sophiaAllDraftsOn:'2026-09-17'}};
  return data;
}}
function modelDraftPhotosHtml(m){{
  if(m?.id===SOPHIA_ALL_DRAFTS_ID){{
    return SOPHIA_PACKAGE_PHOTOS.map((url,i)=>`<div style="text-align:left"><img src="${{esc(url)}}" width="440" style="max-width:100%;height:auto;margin:8px 0 0" alt="Sophia Pippen photo ${{i+1}}"></div>`).join('');
  }}
  const url=draftPhotoForModel(m);
  return url?`<div style="text-align:left"><img src="${{esc(url)}}" width="440" style="max-width:100%;height:auto;margin:8px 0 0" alt="${{esc(m.name)}}"></div>`:'';
}}
'''
if 'function addSophiaToAllDrafts(data)' not in text:
    i=text.find(marker)
    if i<0: raise SystemExit('Sophia all-drafts insertion point not found')
    text=text[:i]+helper+text[i:]

old_return='return removeEm0FromDrafts(applySophiaDescription(applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data))))))}'
new_return='return addSophiaToAllDrafts(removeEm0FromDrafts(applySophiaDescription(applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data)))))))}'
if old_return in text:
    text=text.replace(old_return,new_return,1)
elif new_return not in text:
    raise SystemExit('applyRecovered return not found')

# Make the existing Sophia description migration keep the two new images too.
needle="m.description='Daughter of Scottie and Larsa Pippen, Goddaughter of Kim Kardashian';"
replacement=needle+"\n    m.photo=SOPHIA_PACKAGE_PHOTOS[0];m.photoUrl=SOPHIA_PACKAGE_PHOTOS[0];m.photoFilename='sophia-pippen-1.jpg';m.photos=[...SOPHIA_PACKAGE_PHOTOS];"
if needle in text and "m.photoFilename='sophia-pippen-1.jpg'" not in text[text.find('function applySophiaDescription'):text.find('function addSophiaToAllDrafts') if text.find('function addSophiaToAllDrafts')>0 else len(text)]:
    text=text.replace(needle,replacement,1)

# The live email renderer previously displayed one chosen image per model. For Sophia,
# render both supplied package photos in every draft.
old_photo='${d.photos&&draftPhotoForModel(m)?`<div style="text-align:left"><img src="${esc(draftPhotoForModel(m))}" width="440" style="max-width:100%;height:auto;margin:8px 0 0" alt="${esc(m.name)}"></div>`:\'\'}'
if old_photo in text:
    text=text.replace(old_photo,"${d.photos?modelDraftPhotosHtml(m):''}")

# Also patch the older duplicate renderer if present.
old_photo2='${d.photos&&draftPhotoForModel(m)?`<div><img src="${esc(draftPhotoForModel(m))}" width="561" style="max-width:100%;height:auto;margin:8px 0" alt="${esc(m.name)}"></div>`:\'\'}'
if old_photo2 in text:
    text=text.replace(old_photo2,"${d.photos?modelDraftPhotosHtml(m):''}")

p.write_text(text,encoding='utf-8')

html=p.read_text(encoding='utf-8')
assert 'function addSophiaToAllDrafts(data)' in html
assert 'sophiaAllDraftsVersion:1' in html
assert PHOTO1 in html and PHOTO2 in html
assert 'modelDraftPhotosHtml(m)' in html
# Preserve Em0 exclusion.
assert 'function removeEm0FromDrafts(data)' in html
scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
Path('/tmp/app.js').write_text('\\n'.join(scripts),encoding='utf-8')
