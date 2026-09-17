from pathlib import Path
import re

p=Path('index.html')
text=p.read_text(encoding='utf-8')

marker='function mergeContacts(recovered,current){'
helper="""const EM0_DRAFT_MODEL_ID='new-york-development-em0-spit';
function stripEm0FromDraftRecord(record){
  if(!record||typeof record!=='object')return record;
  const out={...record};
  const isEm0Name=v=>['em0','em0 spit'].includes(String(v||'').trim().toLowerCase());
  if(Array.isArray(out.modelIds))out.modelIds=out.modelIds.filter(id=>id!==EM0_DRAFT_MODEL_ID);
  if(Array.isArray(out.models))out.models=out.models.filter(name=>!isEm0Name(name));
  if(out.packageDepthReview&&typeof out.packageDepthReview==='object'){
    const review={...out.packageDepthReview};
    if(Array.isArray(review.addedModels))review.addedModels=review.addedModels.filter(name=>!isEm0Name(name));
    if(review.reasons&&typeof review.reasons==='object'){
      review.reasons={...review.reasons};
      delete review.reasons.Em0;delete review.reasons['Em0 Spit'];
    }
    if(Array.isArray(review.profileSources))review.profileSources=review.profileSources.filter(url=>!String(url||'').toLowerCase().includes('/development/em0spit'));
    out.packageDepthReview=review;
  }
  out.html='';
  return out;
}
function removeEm0FromDrafts(data){
  data.drafts=(data.drafts||[]).map(stripEm0FromDraftRecord);
  data.draft=stripEm0FromDraftRecord(data.draft||{});
  data.selected=(data.selected||[]).filter(id=>id!==EM0_DRAFT_MODEL_ID);
  if(data.draftPhotoSelections&&typeof data.draftPhotoSelections==='object')delete data.draftPhotoSelections[EM0_DRAFT_MODEL_ID];
  data.recovery={...(data.recovery||{}),em0RemovedFromDraftsOn:'2026-09-17'};
  return data;
}
"""
if 'function removeEm0FromDrafts(data)' not in text:
    i=text.find(marker)
    if i<0: raise SystemExit('cleanup insertion point not found')
    text=text[:i]+helper+text[i:]

patterns=[
'return applySophiaDescription(applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data)))))}',
'return applyLanaMeasurements(applyMilanOpenCloseResearch(expandMilanPackages(applyMilanAvailability(data))))}'
]
replaced=False
for old in patterns:
    if old in text:
        text=text.replace(old,'return removeEm0FromDrafts('+old[len('return '):-1]+')}',1)
        replaced=True
        break
if not replaced and 'return removeEm0FromDrafts(' not in text:
    raise SystemExit('applyRecovered return not found')

p.write_text(text,encoding='utf-8')

html=p.read_text(encoding='utf-8')
assert 'function removeEm0FromDrafts(data)' in html
assert "em0RemovedFromDraftsOn:'2026-09-17'" in html
scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
Path('/tmp/app.js').write_text('\\n'.join(scripts),encoding='utf-8')
