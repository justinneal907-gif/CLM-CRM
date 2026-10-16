const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');
const owner='7752d038-f954-4223-8e19-d7485fb30710';
const cloud={version:1,parts:{models:[{id:'m',name:'Model'}],'draft:existing':{id:'existing',previewHtml:'Exact original text'},'gallery:m':[]},files:new Map(),history:[],offline:false,user:owner};
const success=data=>({data,error:null});
function query(table){let start=0,end=999,keys=null;const q={select(){return q},eq(){return q},in(key,values){keys=values;return q},order(){return q},range(a,b){start=a;end=b;return q},single(){return q},then(resolve){if(cloud.offline)return Promise.resolve({data:null,error:new Error('Network unavailable')}).then(resolve);return Promise.resolve(success(table==='crm_cloud_state'?{version:cloud.version}:Object.entries(cloud.parts).filter(([key])=>!keys||keys.includes(key)).sort(([a],[b])=>a.localeCompare(b)).slice(start,end+1).map(([part_key,data])=>({part_key, data:structuredClone(data)})))).then(resolve)}};return q;}
function page(factory=new IDBFactory()){
 const dom=new JSDOM('<body></body>',{url:'https://example.test',runScripts:'outside-only'}),ctx=dom.getInternalVMContext();
 Object.assign(ctx,{structuredClone,indexedDB:factory,Blob,console});Object.defineProperty(ctx,'crypto',{value:webcrypto});
 const localFiles=new Map();ctx.CLMMediaStore={getRecord:async ref=>localFiles.get(ref),putBlob:async(blob,meta)=>{localFiles.set('clm-media:'+meta.id,{blob,name:meta.name});return 'clm-media:'+meta.id}};
 ctx.supabase={createClient:()=>({auth:{getUser:async()=>success({user:{id:cloud.user}}),getSession:async()=>success({session:cloud.user?{user:{id:cloud.user}}:null}),signInWithPassword:async()=>success({})},from:query,rpc:async(name,args)=>{
   if(cloud.offline)return {error:new Error('Network unavailable')};
   if(args.p_expected!==cloud.version)return {error:new Error('CRM_CONFLICT')};
   cloud.history.push(structuredClone(cloud.parts));Object.assign(cloud.parts,structuredClone(args.p_parts));return success(++cloud.version);
 },storage:{from:()=>({download:async path=>cloud.files.has(path)?success(cloud.files.get(path)):{error:new Error('Not found')},upload:async(path,blob)=>{if(cloud.files.has(path))return {error:new Error('Already exists')};cloud.files.set(path,blob);return success({path})},list:async()=>success([])})}})};
 vm.runInContext(fs.readFileSync('assets/crm-cloud.js','utf8'),ctx);
 let workspace={models:[{id:'m',name:'Model'}],drafts:[{id:'existing',previewHtml:'Exact original text'}],photoLibrary:{m:[]},draft:{notes:'Working draft retained'}};
 return {dom,ctx,files:localFiles,factory,get:()=>workspace,set:value=>workspace=value,async init(){await ctx.CLMCloud.init({get:()=>workspace,replace:async value=>{workspace=structuredClone(value)}})}};
}
(async()=>{
 const first=page();await first.init();assert.equal(await first.ctx.CLMCloud.save(first.get()),false,'Sign-in alone must not overwrite cloud');
 await first.ctx.CLMCloud.connect('cloud');assert.equal(first.get().draft.notes,'Working draft retained');
 first.get().drafts[0].previewHtml='<p>Exact edited text — accents é</p>';
 const blob=new Blob(['original photo bytes'],{type:'image/png'});first.files.set('clm-media:photo-id',{blob,name:'Original filename.png',type:'image/png'});
 first.get().photoLibrary.m.push({url:'clm-media:photo-id',label:'Original filename.png'});
 assert.equal(await first.ctx.CLMCloud.save(first.get()),true);
 assert.equal(cloud.parts['draft:existing'].previewHtml,first.get().drafts[0].previewHtml);assert.equal(cloud.files.size,1);assert.match([...cloud.files.keys()][0],/Original%20filename.png$/);
 assert.equal(await [...cloud.files.values()][0].text(),'original photo bytes');assert.equal(cloud.history[0]['draft:existing'].previewHtml,'Exact original text');
 // Cold browser hydrates private photo bytes and exact saved package text.
 const second=page();await second.init();await second.ctx.CLMCloud.connect('cloud');assert.equal(second.get().drafts[0].previewHtml,first.get().drafts[0].previewHtml);assert.equal(await second.files.get('clm-media:photo-id').blob.text(),'original photo bytes');
 // Same browser resumes confirmed cloud revision after refresh without clicking again.
 const refresh=page(first.factory);await refresh.init();assert.equal(refresh.ctx.CLMCloud.isConnected(),true);
 // Offline writes remain unconfirmed and can be retried with the original local text.
 cloud.offline=true;second.get().drafts[0].previewHtml='Offline edit retained';assert.equal(await second.ctx.CLMCloud.save(second.get()),false);assert.equal(second.get().drafts[0].previewHtml,'Offline edit retained');cloud.offline=false;assert.equal(await second.ctx.CLMCloud.save(second.get()),true);
 // A stale browser cannot overwrite a later save, including its photos.
 const before=structuredClone(cloud.parts);first.get().drafts[0].previewHtml='Stale attempt';assert.equal(await first.ctx.CLMCloud.save(first.get()),false);assert.deepEqual(cloud.parts,before);assert.match(first.dom.window.document.querySelector('#crmCloudStatus').textContent,/Cloud NOT saved/);
 // A missing local photo stops the save before publishing a broken reference.
 await refresh.ctx.CLMCloud.connect('cloud');refresh.get().photoLibrary.m.push({url:'clm-media:missing'});assert.equal(await refresh.ctx.CLMCloud.save(refresh.get()),false);assert.deepEqual(cloud.parts,before);
 // An unrelated signed-in user cannot save through the client.
 cloud.user='other';assert.equal(await second.ctx.CLMCloud.save(second.get()),false);
 for(const p of [first,second,refresh])p.dom.window.close();
 console.log('PASS: verified cloud text, private original photo bytes, cold restore, refresh reconnect, offline retry, stale conflict, missing photo protection, work-account restriction and version history.');
})().catch(error=>{console.error(error);process.exitCode=1});
