const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8'),factory=new IDBFactory();
function page(){
 const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
 const ctx=dom.getInternalVMContext();Object.assign(ctx,{structuredClone,console,indexedDB:factory,Blob,CLMCloud:{init:async()=>{},save:async()=>true}});
 Object.defineProperty(ctx,'crypto',{value:require('node:crypto').webcrypto});
 ctx.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:'+blob.type+';base64,'+Buffer.from(bytes).toString('base64');this.onload()}).catch(err=>{this.error=err;this.onerror()})}};
 vm.runInContext(fs.readFileSync('assets/crm-media-store.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
 const run=s=>vm.runInContext(s,ctx);run('window.__clmWorkspaceReady=true');
 run(`db={models:[{id:'m',name:'Model',location:'NYC'},{id:'n',name:'Other',location:'NYC'}],contacts:[],drafts:[],draft:{modelIds:[]},photoLibrary:{m:[{url:'https://test/old.jpg',label:'Existing'}]},settings:{}};selected=[];active='gallery';setStatus=()=>{};renderAll=()=>{};renderModelGallery();`);
 return {dom,ctx,run};
}
(async()=>{
 const first=page();await first.run('window.CLMMediaStore.init()');
 await first.run('persistWorkspaceSafe(true)');const stale=await first.run('idbReadWorkspace()');
 first.run(`document.querySelector('#galleryUrl').value='https://test/new.jpg'`);
 await first.run('addGalleryUrl()');assert.equal(first.run("document.querySelector('#galleryStatus').textContent"),'Photo saved.');
 const photo=new Blob(['uploaded image bytes'],{type:'image/png'});photo.name='uploaded.png';first.ctx.testInput={files:[photo],value:'file'};
 await first.run('addGalleryFiles(testInput)');assert.equal(first.run("document.querySelector('#galleryStatus').textContent"),'1 photos saved.');
 const ref=first.run('db.photoLibrary.m.find(p=>p.label===\'uploaded.png\').url');assert.match(ref,/^clm-media:/);
 // Reproduce the destructive condition: another tab writes a stale workspace.
 first.ctx.stale=stale;await first.run('idbWriteWorkspace(stale)');
 first.dom.window.close();
 const second=page();await second.run('window.CLMMediaStore.init()');
 await second.run('(async()=>{db=await loadWorkspaceIndexedDB();renderModelGallery()})()');
 assert.equal(second.run('db.photoLibrary.m.length'),3);
 assert.equal(second.run(`window.CLMMediaStore.displayUrl(${JSON.stringify(ref)})`),'data:image/png;base64,'+Buffer.from('uploaded image bytes').toString('base64'));
 assert.match(second.run("document.querySelector('#galleryGrid').textContent"),/uploaded.png/);
 assert.ok(second.run("document.querySelector('#galleryGrid').innerHTML").includes('data:image/png;base64,'));
 await Promise.all([second.run("saveMainGalleryAdditions('m',[{url:'https://test/concurrent-a.jpg'}])"),second.run("saveMainGalleryAdditions('m',[{url:'https://test/concurrent-b.jpg'}])")]);
 await second.run('restoreSavedGalleryAdditions(db)');assert.equal(second.run('db.photoLibrary.m.length'),5);
 await second.run("saveMainGalleryAdditions('m',[{url:'https://test/new.jpg'}]);restoreSavedGalleryAdditions(db)");assert.equal(second.run('db.photoLibrary.m.length'),5);
 // Failure must never report success or clear the retry input.
 second.run("saveMainGalleryAdditions=async()=>{throw Error('Simulated disk failure')};document.querySelector('#galleryUrl').value='https://test/fail.jpg'");
 await second.run('addGalleryUrl()');assert.match(second.run("document.querySelector('#galleryStatus').textContent"),/could not be saved/);assert.equal(second.run("document.querySelector('#galleryUrl').value"),'https://test/fail.jpg');assert.equal(second.run('db.photoLibrary.m.length'),5);
 second.dom.window.close();console.log('PASS: direct gallery URL and uploaded bytes survive cold reload and stale workspace overwrite; concurrent additions, deduplication, existing photos and honest save failure.');
})().catch(err=>{console.error(err);process.exitCode=1});
