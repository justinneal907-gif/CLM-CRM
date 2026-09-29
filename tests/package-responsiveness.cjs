const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const values=new Map();let requests=0,starts=0;
 const ctx={window:{},Date,Math,Number,JSON,DOMException,setTimeout,clearTimeout,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetch:async()=>{requests++;return {status:200}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/crm-gmail-throttle.js','utf8'),ctx);
 const governor=ctx.window.CLMGmailThrottle;
 governor.setCooldown(60000);
 await assert.rejects(governor.fetch('test',{}, {failFastCooldown:true,onRequest:()=>starts++}),/No draft request was sent/);
 assert.equal(requests,0);assert.equal(starts,0);
 values.clear();await governor.fetch('test',{}, {onRequest:()=>starts++});assert.equal(requests,1);assert.equal(starts,1);
 const source=fs.readFileSync('index.html','utf8');
 const thumb=source.match(/function packageThumbnailUrl\(value\)\{[^\n]+/)[0];
 Object.assign(ctx,{isAnimatedGifSource:v=>v==='animation',DRAFT_GIF_PAUSED_PREVIEW:'paused',photoDisplayUrl:v=>'display:'+v});vm.runInContext(thumb,ctx);
 assert.equal(ctx.packageThumbnailUrl('animation'),'paused');assert.equal(ctx.packageThumbnailUrl('photo'),'display:photo');
 const start=source.lastIndexOf('function saveDraft('),end=source.indexOf('function loadDraft(',start);let renders=0,saves=0;
 Object.assign(ctx,{captureDraft(){},db:{draft:{},drafts:[]},selected:['m'],selectedModels:()=>[{name:'Model'}],nyDate:()=>'',uid:()=> 'd',persistWorkspaceSafe:()=>{saves++;return true},renderAll:()=>renders++,setStatus(){}});
 vm.runInContext(source.slice(start,end),ctx);ctx.saveDraft(false);assert.equal(saves,1);assert.equal(renders,0);ctx.saveDraft();assert.equal(renders,1);
 console.log('Package responsiveness: cooldown fails promptly, network timer hook runs at dispatch, GIF thumbnails pause, quiet saves preserve records.');
})().catch(e=>{console.error(e);process.exitCode=1});
