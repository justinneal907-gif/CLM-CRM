const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.CLM_TEST_DOM_MODULE||'jsdom');
const source=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
const ctx=dom.getInternalVMContext();ctx.structuredClone=structuredClone;ctx.console=console;
vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
const run=s=>vm.runInContext(s,ctx);
const old='https://canva.link/vhk73x4zncw11o7',custom='https://www.canva.com/design/CUSTOM/view?utm_content=CUSTOM&utm_source=share';
ctx.old=old;ctx.custom=custom;
run(`db={models:[],submissions:[],contacts:[],settings:{},drafts:[{id:'saved',packageLink:old,brandCanvaPublicViewLink:old,gmailDraftId:'gmail'}],activeDraftId:'saved',draft:{id:'saved',packageLink:old,brandCanvaPublicViewLink:old}};selected=[];
const original='<div>My greeting</div><p><a href="'+old+'"><b><i>HERE</i></b></a> are more models.</p><div data-clm-model-id="m"><a href="https://canva.link/model-book">Portfolio</a><img src="https://test/photo.jpg"></div><p><a href="https://canva.link/reference">My reference</a></p><div>Thank you,<br>Justin</div>';
db.draft.previewHtml=original;db.draft.followupCtaHtml='<p><a href="'+old+'">HERE</a></p>';
db.drafts[0].previewHtml=original;db.drafts[0].followupCtaHtml=db.draft.followupCtaHtml;
const preview=document.getElementById('emailPreview');preview.innerHTML=original;preview.dataset.manualRefreshInitialized='1';
document.getElementById('emailLink').value=custom;
markUserFieldOverrideFromElement('emailLink',document.getElementById('emailLink'));`);
function links(){return [...ctx.document.querySelectorAll('#emailPreview a')].map(a=>a.getAttribute('href'));}
assert.deepEqual(links(),[custom,'https://canva.link/model-book','https://canva.link/reference']);
assert.equal(run('db.drafts[0].packageLink'),custom);
assert.equal(run('db.draft.userOverrides.fields.packageLink'),custom);
assert.equal(run('db.drafts[0].previewNeedsGmailUpdate'),true);
assert.ok(run('db.draft.previewHtml').includes('photo.jpg'));
assert.ok(run('db.draft.followupCtaHtml').includes(custom.replaceAll('&','&amp;')));
const snapshot=run('JSON.stringify(db)');run('removeCanvaLinksFromWorkspace(db)');assert.equal(run('JSON.stringify(db)'),snapshot);
assert.equal(run('stripCanvaLinksText(custom)'),custom,'Copy/save sanitization must preserve Canva URLs.');
assert.ok(run('sanitizeEditableEmailHtml(currentEmailPreviewHtml())').includes('CUSTOM'),'Copied HTML preserves the package destination.');
run('hydrateDraft();refreshEmailPreview();');
assert.equal(links()[0],custom,'Hydrate and refresh keep the entered URL.');
run(`document.getElementById('emailLink').value='';markUserFieldOverrideFromElement('emailLink',document.getElementById('emailLink'));`);
assert.deepEqual(links(),[null,'https://canva.link/model-book','https://canva.link/reference']);
run(`document.getElementById('emailLink').value=custom;markUserFieldOverrideFromElement('emailLink',document.getElementById('emailLink'));`);
assert.equal(links()[0],custom,'Clearing then re-entering must restore the same package anchor.');
run(`const bridal={id:'nybfw_followup_20261002_heli_kalkstein_sophia_iyanu_erin',packageLink:custom,brandCanvaPublicViewLink:old,userOverrides:{fields:{packageLink:custom}}};applyBrandSpecificBridalCanvaLinks20261005({draft:bridal,drafts:[]});`);
assert.equal(run('bridal.packageLink'),custom,'Historical Bridal recovery honors the user field override.');
// New previews must use the field, including the special Bridal and Miami formats.
for(const variant of ['general','bridal','miami']){
  ctx.variant=variant;
  run(`db.drafts=[];db.activeDraftId='';db.draft={id:variant==='miami'?'miami_fashion_week_2026_test':'test',outreachFormat:variant==='bridal'?'bridal-unseen-20261007':'',purpose:'submission'};selected=[];
  document.getElementById('emailPurpose').value='submission';document.getElementById('emailLink').value=custom;document.getElementById('emailBrand').value='Test';`);
  const generated=run('generateInitialEmailHtml()');
  assert.ok(generated.includes('CUSTOM'),variant);
  assert.ok(!generated.includes(old),variant);
  run(`document.getElementById('emailLink').value='';`);
  assert.ok(!run('generateInitialEmailHtml()').includes('canva.'),variant+' clear');
}
console.log('PASS: package field updates saved and visible CTA links; reload/copy preserve URLs; model/reference links, photos and signature stay intact; clear/re-entry and all generated formats work.');
