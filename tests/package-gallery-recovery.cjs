const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
const ctx=dom.getInternalVMContext();ctx.structuredClone=structuredClone;ctx.console=console;
vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
const run=s=>vm.runInContext(s,ctx),read=s=>JSON.parse(run(`JSON.stringify(${s})`));


(async()=>{
run(`db={models:[{id:'m',name:'Model',photo:'https://test/primary.jpg',bridalMaterials:{photos:['https://test/bridal.jpg']}},{id:'other',name:'Other'}],drafts:[
{id:'old',modelIds:['m'],previewHtml:'<p>Keep wording</p><div data-clm-model-id="m"><b>Model</b><img src="https://test/preview-only.jpg"></div><div data-clm-model-id="other"><img src="https://test/other.jpg"></div>'},
{id:'older',modelIds:['m'],userOverrides:{photoSelections:{m:['https://test/selection-only.jpg','https://test/deleted.jpg']}}}],draft:{eventName:'Bridal Week',modelIds:['m']},photoLibrary:{},savedModelPackagePhotos:{'package:old':{m:['https://test/memory-only.jpg']}},deletedPhotoKeys:{m:[photoKey('https://test/deleted.jpg')]},settings:{}};selected=['m'];
window.originalDrafts=JSON.stringify(db.drafts);recoverPackageGalleryPhotos(db);
renderEmail=()=>{};renderEmailMatches=()=>{};renderAll=()=>{};setStatus=()=>{};persistWorkspaceSafe=async()=>true;`);
const expected=['https://test/preview-only.jpg','https://test/selection-only.jpg','https://test/memory-only.jpg','https://test/bridal.jpg','https://test/primary.jpg'];
assert.deepEqual(read('draftPhotosForModel(db.models[0])'),expected);
assert.equal(read('JSON.stringify(db.drafts)'),read('window.originalDrafts'));
run('recoverPackageGalleryPhotos(db)');assert.equal(read('db.photoLibrary.m.length'),3);
await run("setDraftPhotoUrl('m','https://test/new.jpg')");
assert.equal(read('draftPhotosForModel(db.models[0]).length'),6);
assert.ok(read('draftPhotosForModel(db.models[0])').includes('https://test/preview-only.jpg'));
run(`db.draft={eventName:'Bridal Week',modelIds:['m']};db.activeDraftId='';`);
const toggle=run("draftPhotoOptions(db.models[0]).findIndex(p=>p.url==='https://test/selection-only.jpg')");
await run(`togglePackagePhoto('m',${toggle})`);
assert.equal(read('draftPhotosForModel(db.models[0]).length'),5);
assert.ok(!read('draftPhotosForModel(db.models[0])').includes('https://test/selection-only.jpg'));
assert.ok(read('draftPhotosForModel(db.models[0])').includes('https://test/preview-only.jpg'));
run(`db=JSON.parse(JSON.stringify(db));recoverPackageGalleryPhotos(db)`);
assert.equal(read('draftPhotosForModel(db.models[0]).length'),5);
run(`db.draft={id:'nybfw_followup_20261009_heli_kalkstein_sophia_ambre_iyanu',eventName:'Bridal Week',modelIds:['m'],previewHtml:'<div><p>Keep Heli wording</p><div data-clm-model-id="m"><b>Model</b><img src="https://test/primary.jpg"></div></div>'};db.activeDraftId=db.draft.id;db.drafts.push(structuredClone(db.draft));restoreHeliPackageGallery20261009(db)`);
assert.match(read('db.draft.previewHtml'),/preview-only.jpg/);
assert.match(read('db.draft.previewHtml'),/Keep Heli wording/);
assert.ok(!read('db.draft.previewHtml').includes('other.jpg'));
assert.ok(!read('db.draft.previewHtml').includes('deleted.jpg'));
assert.equal(read('db.drafts[0].previewHtml'),JSON.parse(read('window.originalDrafts'))[0].previewHtml);
const before=read('JSON.stringify(db)');run('restoreHeliPackageGallery20261009(db)');assert.equal(read('JSON.stringify(db)'),before);

run(`db.recovery.allPreviousModelPhotos20261009=0;db.bridalMaterialsBackups20261004=[{record:{modelIds:['m'],previewHtml:'<div data-clm-model-id="m"><img src="https://test/backup-preview.jpg"></div>'}}];idbReadWorkspaceAtKey=async()=>({photoLibrary:{m:[{url:'https://test/snapshot.jpg'}]}});window.archiveReads=0;fetch=async()=>{window.archiveReads++;return {ok:true,json:async()=>({photoLibrary:{m:[{url:'https://test/archive.jpg'}]}})}};`);
await run('collectAllPreviousModelPhotos20261009(db)');
for(const url of ['https://test/backup-preview.jpg','https://test/snapshot.jpg','https://test/archive.jpg'])assert.ok(read('db.photoLibrary.m').some(p=>p.url===url));
assert.equal(read('window.archiveReads'),7);
await run('collectAllPreviousModelPhotos20261009(db)');assert.equal(read('window.archiveReads'),7);
assert.equal(read('db.photoLibrary.m.filter(p=>p.url==="https://test/archive.jpg").length'),1);
console.log('PASS: historical preview/selection/memory recovery; Bridal gallery union; add/toggle retain existing photos; reload; Heli repair; model identity; deletion and original preview preservation.');
dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
