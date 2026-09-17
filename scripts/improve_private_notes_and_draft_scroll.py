from pathlib import Path
import re

p=Path('index.html')
text=p.read_text(encoding='utf-8')

# 1) Make private notes visually prominent in the package builder and saved-draft cards.
css='''
/* PRIVATE NOTES VISIBILITY + DRAFT OPEN POSITION 2026-09-17 */
.private-notes-field{border:2px solid var(--accent);background:var(--soft);border-radius:11px;padding:12px;box-shadow:0 1px 0 rgba(0,0,0,.04)}
.private-notes-field>label{font-size:13px;letter-spacing:.02em;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.private-note-badge{display:inline-block;background:var(--accent);color:#fff;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;letter-spacing:.08em}
.private-notes-field textarea{background:#fff;border:1px solid var(--accent);min-height:112px}
.private-notes-field .private-note-help{margin-top:6px;font-size:11px;font-weight:700;color:var(--accent)}
.draft-private-note{margin-top:9px;padding:9px 10px;border:1px solid var(--accent);border-left-width:4px;border-radius:7px;background:var(--soft);color:var(--ink);font-size:12px;line-height:1.45}
.draft-private-note b{font-size:10px;letter-spacing:.08em;color:var(--accent)}
'''
if 'PRIVATE NOTES VISIBILITY + DRAFT OPEN POSITION 2026-09-17' not in text:
    text=text.replace('</style>',css+'</style>',1)

old_field='<div class="field"><label>Private notes</label><textarea id="emailPrivateNotes" rows="4" placeholder="Internal package notes. Saved in the CRM and never included in the email draft."></textarea><div class="muted tiny" style="margin-top:5px">Saved with this package · never included in preview, copied email, or Gmail compose.</div></div>'
new_field='<div class="field private-notes-field"><label><span class="private-note-badge">INTERNAL ONLY</span> Private notes</label><textarea id="emailPrivateNotes" rows="5" placeholder="Internal package notes. Saved in the CRM and never included in the email draft."></textarea><div class="private-note-help">Visible in the CRM only · never included in preview, copied email, or Gmail compose.</div></div>'
if old_field in text:
    text=text.replace(old_field,new_field,1)
elif 'class="field private-notes-field"' not in text:
    raise SystemExit('Private notes field not found')

# 2) Opening a saved draft should always land at the top of the package page.
old_load="function loadDraft(id){const d=db.drafts.find(x=>x.id===id);if(!d)return;db.activeDraftId=id;db.draft={...structuredClone(seed.draft),...structuredClone(d)};selected=(d.modelIds||[]).filter(modelId=>db.models.some(m=>m.id===modelId));if(!selected.length&&Array.isArray(d.models)){for(const name of d.models){const m=db.models.find(x=>normalizeName(x.name)===normalizeName(name));if(m&&!selected.includes(m.id))selected.push(m.id)}}db.selected=[...selected];resetDraftUtilityControls();persistWorkspaceSafe(false);go('email');setStatus(`Loaded ${d.brandProject||d.company||d.subject||'saved package'}.`)}"
new_load="function loadDraft(id){const d=db.drafts.find(x=>x.id===id);if(!d)return;db.activeDraftId=id;db.draft={...structuredClone(seed.draft),...structuredClone(d)};selected=(d.modelIds||[]).filter(modelId=>db.models.some(m=>m.id===modelId));if(!selected.length&&Array.isArray(d.models)){for(const name of d.models){const m=db.models.find(x=>normalizeName(x.name)===normalizeName(name));if(m&&!selected.includes(m.id))selected.push(m.id)}}db.selected=[...selected];resetDraftUtilityControls();persistWorkspaceSafe(false);go('email');requestAnimationFrame(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0});setStatus(`Loaded ${d.brandProject||d.company||d.subject||'saved package'}.`)}"
if old_load in text:
    text=text.replace(old_load,new_load,1)
elif 'requestAnimationFrame(()=>{window.scrollTo(0,0)' not in text:
    raise SystemExit('loadDraft function not found')

# 3) Surface private notes directly on saved package cards for at-a-glance scanning.
start=text.find('function renderDrafts(){')
end=text.find('\nfunction activeDraftRecord()',start)
if start<0 or end<0:
    raise SystemExit('renderDrafts block not found')
old_render=text[start:end]
new_render='''function renderDrafts(){if(!$('#savedDrafts'))return;$('#savedDrafts').innerHTML=db.drafts.slice().reverse().map(d=>{const activeDraft=d.id===db.activeDraftId;const privateNote=String(d.notes||'').trim();const privatePreview=privateNote?(privateNote.length>220?privateNote.slice(0,220).trimEnd()+'…':privateNote):'';return `<div class="draft-card" style="${activeDraft?'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset':''}"><b>${esc(d.subject||'Untitled draft')}</b>${activeDraft?' <span class="pill">OPEN</span>':''}<div class="muted">${esc(d.date||'')} · ${esc(d.brandProject||d.recipientEmail||'')} · ${esc((d.models||[]).join(', '))}${d.source?` · ${esc(d.source)}`:''}</div>${privatePreview?`<div class="draft-private-note"><b>PRIVATE NOTES</b><div>${esc(privatePreview).replace(/\\n/g,'<br>')}</div></div>`:''}<div class="actions" style="margin-top:8px"><button class="btn${activeDraft?' primary':''}" onclick="loadDraft('${d.id}')">${activeDraft?'Reload':'Open'}</button>${d.gmailUrl?`<a class="btn" href="${esc(d.gmailUrl)}" target="_blank" rel="noopener">Gmail</a>`:''}<button class="btn danger" onclick="deleteDraft('${d.id}')">Delete</button></div></div>`}).join('')||'<div class="empty">No saved drafts.</div>'}'''
if 'draft-private-note' not in old_render or 'PRIVATE NOTES' not in old_render:
    text=text[:start]+new_render+text[end:]

p.write_text(text,encoding='utf-8')

html=p.read_text(encoding='utf-8')
assert 'class="field private-notes-field"' in html
assert 'draft-private-note' in html
assert 'PRIVATE NOTES</b>' in html
assert 'requestAnimationFrame(()=>{window.scrollTo(0,0)' in html
# Keep private notes out of the email renderer. They may be captured/saved, but must not be emitted by emailHtml.
email_blocks=re.findall(r'function emailHtml\(\)\{.*?(?=\nfunction |\n/\*)',html,re.S)
assert email_blocks
for block in email_blocks:
    assert 'emailPrivateNotes' not in block
    assert '.notes' not in block
scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
Path('/tmp/app.js').write_text('\n'.join(scripts),encoding='utf-8')
