const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {JSDOM}=require('jsdom');const document=new JSDOM('').window.document;
const ctx={document,structuredClone,normalizeName:s=>String(s||'').toLowerCase(),window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
const model={id:'m',name:'Test',photo:'https://test/seed.jpg'};
const block=photos=>'<p>Keep my wording</p><div data-clm-model-id="m"><b>Test</b>'+photos.map(src=>`<img src="${src}">`).join('')+'</div>';
const data={models:[model],drafts:[{id:'custom',eventName:'Bridal Week',modelIds:['m'],previewHtml:block(['https://test/added1.jpg','https://test/added2.jpg']),userOverrides:{photoSelections:{m:['https://test/added1.jpg','https://test/added2.jpg']}}},{id:'seed',eventName:'Bridal Week',modelIds:['m'],previewHtml:block([model.photo])},{id:'empty',eventName:'Bridal Week',modelIds:['m'],previewHtml:block([]),userOverrides:{photoSelections:{m:[]}}},{id:'future',eventName:'Bridal Week',modelIds:['m']}],draft:{}};
// Empty choices stay local but become the latest reusable choice; use the custom
// package last to represent the user's latest photo selection.
data.drafts.push(data.drafts.shift());ctx.db=data;
ctx.repairSavedPackagePhotos20261005(data);
const repaired=data.drafts.find(d=>d.id==='seed');assert.match(repaired.previewHtml,/added1/);assert.match(repaired.previewHtml,/added2/);assert.match(repaired.previewHtml,/Keep my wording/);
assert.equal(data.drafts.find(d=>d.id==='empty').photoSelections.m.length,0);
assert.equal(data.drafts.find(d=>d.id==='future').reuseSavedModelPhotos,true);
const roundtrip=JSON.parse(JSON.stringify(data));assert.equal(roundtrip.drafts.find(d=>d.id==='seed').packagePhotos.m.length,2);
const before=JSON.stringify(roundtrip);ctx.repairSavedPackagePhotos20261005(roundtrip);assert.equal(JSON.stringify(roundtrip),before);
ctx.db.draft={eventName:'Bridal Week'};ctx.rememberModelPackagePhotos('m',['https://test/new.jpg']);assert.equal(ctx.savedModelPackagePhotos(ctx.db,'m',ctx.db.draft)[0],'https://test/new.jpg');
assert.equal(ctx.savedModelPackagePhotos(ctx.db,'m',{eventName:'Paris Fashion Week'}),null);
console.log('Passed: existing repair, multiple photos, exact text, explicit removal, future defaults, reload, idempotence and event isolation.');
