const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8'),factory=new IDBFactory();
function page(){
 const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
 const ctx=dom.getInternalVMContext();Object.assign(ctx,{structuredClone,console,indexedDB:factory,Blob});
 Object.defineProperty(ctx,'crypto',{value:require('node:crypto').webcrypto});
 ctx.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:'+blob.type+';base64,'+Buffer.from(bytes).toString('base64');this.onload()}).catch(err=>{this.error=err;this.onerror()})}};
 vm.runInContext(fs.readFileSync('assets/crm-media-store.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run(`db={models:[{id:'m',name:'Model',location:'NYC'},{id:'n',name:'Other',location:'NYC'}],contacts:[],drafts:[],draft:{modelIds:[]},photoLibrary:{m:[{url:'https://test/old.jpg',label:'Existing'}]},settings:{}};selected=[];active='gallery';setStatus=()=>{};renderAll=()=>{};renderModelGallery();`);
 return {dom,ctx,run};
}
(async()=>{
 const first=page();await first.run('window.CLMMediaStore.init()');
 first.run("db.models[0].profileUrl='https://www.chezlesmannequins.com/women/model';renderModelGallery()");
 await first.run("saveMainGalleryAdditions('m',[{url:'https://test/prior.jpg'}]);persistWorkspaceSafe(true)");
 const stale=await first.run('idbReadWorkspace()');
 const photo=new Blob(['replacement'],{type:'image/png'});photo.name='Original File.png';first.ctx.input={files:[photo],value:'file'};
 await first.run('replaceGalleryFiles(input)');
 assert.equal(first.run('db.photoLibrary.m.length'),1);assert.equal(first.run('db.photoLibrary.m[0].label'),'Original File.png');
 first.ctx.stale=stale;await first.run('idbWriteWorkspace(stale)');first.dom.window.close();
 const second=page();await second.run('window.CLMMediaStore.init()');await second.run('(async()=>{db=await loadWorkspaceIndexedDB()})()');
 assert.equal(second.run('db.photoLibrary.m.length'),1);assert.equal(second.run('draftPhotoOptions(db.models[0]).length'),1);
 second.run('editPreviewModels=()=>{};persistDraftPresentation=()=>{};save=()=>{};renderEmailMatches=()=>{};addToEmail("m")');
 assert.equal(second.run('draftPhotosForModel(db.models[0]).length'),0);
 assert.equal(second.run('hasAgencyWebsitePortfolio(db.models[1])'),false);
 await second.run("commitGalleryPhotos('n',[{url:'https://test/other.jpg'}])");assert.equal(second.run('db.photoLibrary.n.length'),1);
 second.dom.window.close();console.log('PASS: replacement persistence, original filename, empty new-model selection, and nonwebsite uploads.');
})().catch(err=>{console.error(err);process.exitCode=1});
