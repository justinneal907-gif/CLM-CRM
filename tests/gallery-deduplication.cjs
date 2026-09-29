const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
(async()=>{
 const source=fs.readFileSync('assets/crm-media-store.js','utf8');
 const rows=[['a',{blob:new Blob(['photo'])}],['b',{blob:new Blob(['photo'])}],['c',{blob:new Blob(['different'])}]];let writes=0;
 const ctx={Blob,crypto:webcrypto,Map,Uint8Array,Array,console,localStorage:{getItem:()=>null},remoteCache:new Map(),contentRefs:new Map(),aliases:new Map(),metadata:new Map(),objectUrls:new Map(),REMOTE_KEY:'cache',STORE:'media',makeRef:id=>'clm-media:'+id,idFromRef:ref=>ref.slice(10),makeId:()=> 'new',optimizeBlob:async b=>b,remember:(id,r)=>{ctx.metadata.set(id,{});ctx.objectUrls.set(id,'blob:'+id)},tx:async(mode,fn)=>fn({put(){writes++}}),openDb:async()=>({close(){},transaction(){const tr={objectStore:()=>({openCursor(){const req={};let i=0;function next(){queueMicrotask(()=>{const row=rows[i++];req.result=row?{key:row[0],value:row[1],continue:next}:null;req.onsuccess();if(!row)tr.oncomplete()})}next();return req}})};return tr}})};
 vm.createContext(ctx);
 for(const [start,end] of [['  function canonicalRef','  const inflightRemote'],['  async function putBlob','  async function getRecord'],['  async function init','  function displayUrl']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
 await ctx.init();assert.equal(ctx.canonicalRef('clm-media:b'),'clm-media:a');assert.equal(ctx.canonicalRef('clm-media:c'),'clm-media:c');
 assert.equal(await ctx.putBlob(new Blob(['photo'])),'clm-media:a');assert.equal(writes,3);
 const html=fs.readFileSync('index.html','utf8');
 Object.assign(ctx,{window:{CLMMediaStore:{canonicalRef:ctx.canonicalRef}},photoURL:v=>typeof v==='string'?v:v?.url||'',upgradedPhotoURL:v=>v,isDeletedPhoto:()=>false,db:{photoLibrary:{m:[{url:'clm-media:a'},{url:'clm-media:b'},{url:'clm-media:c'}]},drafts:[]}});
 vm.runInContext(html.slice(html.indexOf('function photoKey('),html.indexOf('function isDeletedPhoto(')),ctx);
 const start=html.lastIndexOf('function draftPhotoOptions(');vm.runInContext(html.slice(start,html.indexOf('function getPhoto(',start)),ctx);
 assert.equal(ctx.draftPhotoOptions({id:'m',photo:'clm-media:b'}).length,2);
 console.log('Identical stored photos collapse to one gallery entry; distinct photos remain; repeated uploads reuse existing media.');
})().catch(e=>{console.error(e);process.exitCode=1});
