const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/crm-open-tracking.js','utf8');
const start=source.indexOf('  let previewSendBusy=false;'),end=source.indexOf('  function installDraftCreationHook()',start);
let preview='<p>The text I typed.</p>',events=[],sent=0;
const record={gmailDraftId:'g1',openTrackingId:'t1',openTrackingState:'ready'};
const ctx={console,window:{confirm:()=>true,alert(){}},sendBusy:false,db:{settings:{}},setTimeout:()=>0,
 draftTarget:()=>({id:'crm1',record}),currentDraft:()=>record,currentEmailPreviewHtml:()=>preview,
 createFormattedWorkGmailDraft:async()=>{events.push('upload');record.previewNeedsGmailUpdate=false;},
 verifyStoredGmailPackage:async(id,pixel)=>events.push(pixel?'verify-final':'verify'),renderTrackerStatus(){},setStatus(){},loadGmailDraftRaw:async()=>{events.push('load');return preview},base64UrlToUtf8:s=>s,utf8ToBase64Url:s=>s,
 topHeader:(mime,name)=>name==='To'?'client@example.com':'Subject',decodeMimeHeader:s=>s,
 randomHex:()=> 'tracking2',setTopHeader:s=>s,injectPixel:s=>s,
 patchTarget:(target,patch)=>Object.assign(record,patch),counterValue:async()=>0,updateGmailDraft:async(id,raw)=>{events.push('update');assert.equal(raw,preview)},
 sendGmailDraft:async()=>{events.push('send');sent++;return {id:'sent1'}},nowIso:()=> '2026-10-02T22:00:00Z',nyDate:()=> '2026-10-02',recordTrackedSubmission(){},TRACK_VERSION:1,persistWorkspaceSafe(){},renderAll(){}};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
(async()=>{
 await ctx.sendTrackedCurrentDraft();assert.deepEqual(events,['upload','verify','load','update','verify-final','send']);assert.equal(sent,1);
 Object.assign(record,{gmailDraftId:'g1',openTrackingId:'t1',openTrackingState:'ready'});events=[];
 ctx.createFormattedWorkGmailDraft=async()=>{preview+='<p>Changed while uploading.</p>';record.previewNeedsGmailUpdate=true};
 await assert.rejects(ctx.sendTrackedCurrentDraft(),/preview changed/i);assert.equal(sent,1);
 record.previewNeedsGmailUpdate=false;ctx.createFormattedWorkGmailDraft=async()=>{};
 ctx.updateGmailDraft=async()=>{preview+='<p>Changed while preparing send.</p>'};
 await assert.rejects(ctx.sendTrackedCurrentDraft(),/preview changed/i);assert.equal(sent,1);
 record.previewNeedsGmailUpdate=false;ctx.updateGmailDraft=async()=>{};ctx.idbWriteQueue={then(resolve){preview+='<p>Edit during persistence</p>';resolve()}};await assert.rejects(ctx.sendTrackedCurrentDraft(),/final send/);assert.equal(sent,1);delete ctx.idbWriteQueue;
 record.previewNeedsGmailUpdate=false;ctx.verifyStoredGmailPackage=async()=>{throw Error('Photo verification failed')};await assert.rejects(ctx.sendTrackedCurrentDraft(),/verification failed/);assert.equal(sent,1);
 console.log('Passed: tracked send uploads preview first and blocks sending if preview changes during upload or preparation.');
})().catch(e=>{console.error(e);process.exitCode=1});
