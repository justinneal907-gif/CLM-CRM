const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const s=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(s);
const c={window:{},structuredClone,console,Intl,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:()=>null}};
vm.createContext(c);vm.runInContext(s.slice(0,s.indexOf('\nbootstrapWorkspace();')),c);
const run=x=>JSON.parse(vm.runInContext(`JSON.stringify(${x})`,c));
const data=run('applyRecovered(structuredClone(seed))'),paris=data.drafts.filter(d=>d.id.startsWith('paris-ss27'));
assert.equal(paris.length,58);
for(const d of paris){assert.equal(d.modelIds.length,d.models.length,d.company+' must link every recommended model');assert(d.modelIds.every(id=>data.models.some(m=>m.id===id)));}
const expected=['new-york-women-maja-stockwell','new-york-women-agang','new-york-women-mary-timms','new-york-women-claudia-lucchini'];
assert.deepEqual(paris.find(d=>d.company==='Valentino').modelIds,expected);
vm.runInContext(`const old=parisPostDiorDrafts(seed.models).find(d=>d.company==='Valentino');old.modelIds=['new-york-women-maja-stockwell','new-york-women-agang'];old.html='Broken preview';const restored=applyRecovered({...structuredClone(seed),drafts:[old],draft:old,activeDraftId:old.id});`,c);
assert.deepEqual(run('restored.draft.modelIds'),expected);assert.deepEqual(run('restored.selected'),expected);assert.equal(run('restored.draft.html'),'');
const recovery=fs.readFileSync(path.join(__dirname,'../recovery/index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(recovery);
vm.runInContext(recovery.slice(recovery.indexOf('function mergeParis'),recovery.indexOf('function downloadBackup')),c);
const payload=JSON.parse(fs.readFileSync(path.join(__dirname,'../recovery/paris-drafts.json'),'utf8'));c.payload=payload;
vm.runInContext(`const personal={models:[],drafts:[{id:'private-draft',notes:'keep'}],contacts:[{id:'private-contact'}],bookings:[{id:'booking'}],submissions:[{id:'sent'}],tasks:[{id:'task'}],customPhotos:{x:'my-photo'}};const merged=mergeParis(personal,payload);`,c);
for(const key of ['contacts','bookings','submissions','tasks','customPhotos'])assert.deepEqual(run('merged.'+key),run('personal.'+key));assert.deepEqual(run('merged.drafts[0]'),run('personal.drafts[0]'));assert.deepEqual(run('mergeParis(merged,payload).drafts'),run('merged.drafts'));
console.log('PASS: 58 complete Paris packages; Valentino four model IDs; saved/active draft repair; recovery preserves private records and is repeatable.');
