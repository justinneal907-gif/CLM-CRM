const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
const ctx=dom.getInternalVMContext();Object.assign(ctx,{structuredClone,console});
vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
const run=s=>vm.runInContext(s,ctx),read=s=>JSON.parse(run(`JSON.stringify(${s})`));
(async()=>{
run(`db={models:[{id:'m',name:'Callie',location:'New York',division:'Women',photo:'https://test/primary.jpg'}],contacts:[],submissions:[],drafts:[{id:'other',photoSelections:{m:['https://test/other-package.jpg']}}],draft:{modelIds:[],previewHtml:'<div><p>Keep my opening</p><p>Thank you,</p></div>'},selected:[],photoLibrary:{m:Array.from({length:52},(_,i)=>({url:'https://test/photo-'+i+'.jpg'}))},settings:{}};selected=[];persistWorkspaceSafe=async()=>true;renderAll=()=>{};renderEmailMatches=()=>{};document.querySelector('#includePhotos').checked=true;`);
const gallery=read('db.photoLibrary'),other=read('db.drafts');
// Missing selections, including the old live-gallery mode, do not select the gallery.
assert.deepEqual(read('draftPhotosForModel(db.models[0])'),[]);
run("db.draft.generatedPhotoMode='live-gallery'");assert.deepEqual(read('draftPhotosForModel(db.models[0])'),[]);
run("addToEmail('m');renderEmailSelection()");
assert.deepEqual(read('draftPhotosForModel(db.models[0])'),[]);
assert.equal(dom.window.document.querySelectorAll('.draft-photo-choice').length,52);
assert.equal(dom.window.document.querySelectorAll('.draft-photo-choice.active').length,0);
assert.match(dom.window.document.querySelector('#selectedModels').textContent,/0 photos/);
assert.ok(!read('db.draft.previewHtml').includes('<img'));
assert.match(read('db.draft.previewHtml'),/Keep my opening/);
await run("togglePackagePhoto('m',0)");
assert.deepEqual(read('draftPhotosForModel(db.models[0])'),['https://test/photo-0.jpg']);
run('db=JSON.parse(JSON.stringify(db))');assert.deepEqual(read('draftPhotosForModel(db.models[0])'),['https://test/photo-0.jpg']);
run("addToEmail('m')");assert.equal(read('draftPhotosForModel(db.models[0]).length'),1);
await run("resetDraftPhoto('m')");assert.deepEqual(read('draftPhotosForModel(db.models[0])'),[]);
run('db=JSON.parse(JSON.stringify(db))');assert.deepEqual(read('draftPhotosForModel(db.models[0])'),[]);
assert.deepEqual(read('db.photoLibrary'),gallery);assert.deepEqual(read('db.drafts'),other);
// Preserve explicit saved selections in all supported legacy/current formats.
for(const field of ['photoSelections','packagePhotos']){run(`db.draft={${field}:{m:['https://test/saved.jpg']}}`);assert.deepEqual(read('draftPhotosForModel(db.models[0])'),['https://test/saved.jpg'])}
run("db.draft={userOverrides:{photoSelections:{m:['https://test/chosen.jpg']}}}");assert.deepEqual(read('draftPhotosForModel(db.models[0])'),['https://test/chosen.jpg']);
console.log('PASS: 52 gallery photos stay unselected, actual add/render/toggle/clear/reload, missing live-gallery selections, saved choices preserved, gallery and other packages unchanged.');
dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
