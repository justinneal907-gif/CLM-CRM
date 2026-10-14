const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/data/agency-photos-20261014.json'),'utf8'));
const c={structuredClone,console,Intl,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:()=>null},window:{},fetch:async()=>({ok:true,json:async()=>manifest})};
vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'assets/data/core-roster.js'),'utf8'),c);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),c);
vm.runInContext(fs.readFileSync(path.join(root,'assets/crm-agency-photos.js'),'utf8'),c);
assert.equal(manifest.models.length,58);let count=0;
for(const m of manifest.models)for(const p of m.photos){const rel=decodeURIComponent(new URL(p.url).pathname.replace('/CLM-CRM/',''));const file=fs.readFileSync(path.join(root,rel));assert.equal(crypto.createHash('sha256').update(file).digest('hex'),p.sha256);count++}
assert.equal(count,1153);
(async()=>{
vm.runInContext('db=applyRecovered(structuredClone(seed));db.photoLibrary=db.photoLibrary||{};db.draft.photoSelections=db.draft.photoSelections||{};',c);
const first=manifest.models[0],photo=first.photos[0];
c.fixture={first,photo};
vm.runInContext(`db.photoLibrary[fixture.first.modelId]=[{url:'https://example.com/preserved.jpg',label:'User upload'}];db.deletedPhotoKeys={...db.deletedPhotoKeys,[fixture.first.modelId]:[photoKey(fixture.photo.sourceUrl)]};db.draft.photoSelections[fixture.first.modelId]='https://example.com/selected.jpg';`,c);
const before=vm.runInContext('JSON.stringify([db.draft,db.drafts,db.customPhotos,db.deletedPhotoKeys,db.hiddenGalleryPhotoKeys])',c);
await vm.runInContext('window.CLMImportAgencyPhotos(db)',c);
assert.equal(vm.runInContext('JSON.stringify([db.draft,db.drafts,db.customPhotos,db.deletedPhotoKeys,db.hiddenGalleryPhotoKeys])',c),before);
assert.ok(vm.runInContext('db.photoLibrary[fixture.first.modelId].some(p=>p.url==="https://example.com/preserved.jpg")',c));
assert.ok(vm.runInContext('!db.photoLibrary[fixture.first.modelId].some(p=>p.url===fixture.photo.url)',c));
for(const m of manifest.models){c.entry=m;assert.ok(vm.runInContext('db.models.some(m=>m.id===entry.modelId)&&db.photoLibrary[entry.modelId].length>0',c),m.modelId)}
const saved=vm.runInContext('JSON.stringify(db)',c);await vm.runInContext('window.CLMImportAgencyPhotos(db)',c);assert.equal(vm.runInContext('JSON.stringify(db)',c),saved);
console.log('PASS: 1,153 hosted file hashes, 58 model identities, additive gallery import, deleted photos excluded, saved packages untouched, repeated load unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});

