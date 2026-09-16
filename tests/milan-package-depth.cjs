const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(js);
const c={structuredClone,console,Intl,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:()=>null}};vm.createContext(c);
vm.runInContext(js.slice(0,js.indexOf('initNav();setupFilters();hydrateDraft();renderAll();')),c);
const run=s=>JSON.parse(vm.runInContext(`JSON.stringify(${s})`,c));
const packages=run('[...MILAN_FIRST_DAY_DRAFTS,...MILAN_REST_DRAFTS]');
assert.equal(packages.length,61);assert.ok(packages.every(d=>d.modelIds.length>=4));
const changed=packages.filter(d=>d.packageDepthReview);assert.equal(changed.length,33);
assert.equal(changed.reduce((n,d)=>n+d.packageDepthReview.addedModels.length,0),43);
assert.ok(run('[...MILAN_FIRST_DAY_DRAFTS,...MILAN_REST_DRAFTS].every(d=>d.modelIds.every(id=>!isMilanUnavailable(id,seed.models)))'));
vm.runInContext(`
const old=structuredClone(seed);old.drafts=structuredClone([...MILAN_FIRST_DAY_DRAFTS,...MILAN_REST_DRAFTS]);
for(const d of old.drafts){if(d.packageDepthReview){const added=d.packageDepthReview.addedModels;d.modelIds=d.modelIds.filter(id=>!added.includes(seed.models.find(m=>m.id===id)?.name));d.models=d.models.filter(n=>!added.includes(n));delete d.packageDepthReview}d.notes='Keep notes';d.recipientEmail='private@example.test';d.photoSelections={[d.modelIds[0]]:'custom-photo'};d.html='Cached model HTML'}
const untouched=structuredClone(old.drafts.filter(d=>d.modelIds.length>=4));
old.activeDraftId='milan-ss27-day1-prada';old.draft=structuredClone(old.drafts.find(d=>d.id===old.activeDraftId));old.selected=[...old.draft.modelIds];
old.drafts.push({id:'unrelated',brandProject:'NYFW',modelIds:['new-york-women-agang'],models:['Agang'],html:'Keep unrelated HTML'});
old.submissions=[{id:'sent',models:['Seven']}];old.tasks=[{id:'t',task:'Keep'}];
const result=applyRecovered(old);
`,c);
const result=run('result'),old=run('old');
assert.equal(result.drafts.filter(d=>d.id.startsWith('milan-ss27-')&&d.modelIds.length<4).length,0);
for(const d of run('untouched'))assert.deepEqual(result.drafts.find(x=>x.id===d.id),run(`normalizeRecordModelNames(${JSON.stringify(d)})`));
for(const d of old.drafts){const next=result.drafts.find(x=>x.id===d.id);for(const key of ['notes','recipientEmail','photoSelections'])assert.deepEqual(next[key],d[key]);assert.ok(d.modelIds.every(id=>next.modelIds.includes(id)));assert.equal(new Set(next.modelIds).size,next.modelIds.length)}
assert.equal(result.selected.length,4);assert.equal(result.draft.modelIds.length,4);
assert.deepEqual(result.models,old.models);assert.deepEqual(result.tasks,old.tasks);assert.deepEqual(result.submissions.find(x=>x.id==='sent'),old.submissions[0]);
assert.deepEqual(run('applyRecovered(result)'),result);
vm.runInContext(`const manual=structuredClone(result);const edited=manual.drafts.find(d=>d.id==='milan-ss27-day1-prada');edited.modelIds=edited.modelIds.slice(0,2);edited.models=edited.models.slice(0,2);`,c);
assert.equal(run("applyRecovered(manual).drafts.find(d=>d.id==='milan-ss27-day1-prada').modelIds.length"),2);
vm.runInContext(`const conflicts=structuredClone(old);const daisy=conflicts.models.find(m=>m.name==='Daisy');daisy.availabilityStatus='Booked';daisy.statusFrom='2026-09-22';daisy.statusTo='2026-09-28';const filled=applyRecovered(conflicts);`,c);
assert.ok(run("filled.drafts.find(d=>d.id==='milan-ss27-day1-prada').modelIds.every(id=>id!=='london-women-daisy-ibi')"));
assert.equal(run("filled.drafts.find(d=>d.id==='milan-ss27-day1-prada').modelIds.length"),4);
console.log('PASS: 33 packages / 43 additions, saved and active draft expansion, larger packages preserved, no unavailable or duplicate additions, local booking conflicts respected, later manual edits retained.');
