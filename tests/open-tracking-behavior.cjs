const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('assets/crm-open-tracking.js','utf8').replace('  initWhenReady(0);',
  '  window.testApi={checkOpens,trackingRecords,injectPixel,sendTrackedCurrentDraft,trackingState,installDraftCreationHook};');
function setup(){
  const db={settings:{openTrackingNamespace:'a'.repeat(32)},drafts:[],submissions:[],models:[],draft:{},activeDraftId:''};
  const ctx={db,window:{isSecureContext:false,confirm:()=>true,alert:()=>{}},document:{querySelector:()=>null},navigator:{},
    console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,AbortController,Date,Set,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},
    persistWorkspaceSafe:()=>true,renderAll:()=>{},setStatus:()=>{},WORK_EMAIL:'sender@example.com',gmailToken:async()=> 'fake',
    fetch:async()=>({ok:true,status:200,json:async()=>({value:0})})};
  vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,db,api:ctx.window.testApi};
}
(async()=>{
  {
    const {db,ctx,api}=setup();
    const record={id:'p1',openTrackingId:'b'.repeat(28),openTrackingState:'armed',openTrackingCount:3};
    db.drafts=[record];db.draft={...record};db.activeDraftId='p1';db.submissions=[{...record,id:'s1',draftId:'p1'}];
    ctx.fetch=async()=>({ok:true,status:200,json:async()=>({value:5})});
    await api.checkOpens(true,true);
    assert.equal(db.submissions[0].openTrackingCount,5);assert.equal(db.drafts[0].openTrackingCount,5);assert.equal(db.draft.openTrackingCount,5);
    const first=record.openTrackingFirstDetectedAt,last=record.openTrackingLastCheckedAt;
    ctx.fetch=async()=>({ok:false,status:503});await api.checkOpens(true,true);
    assert.match(record.openTrackingError,/503/);assert.equal(record.openTrackingLastCheckedAt,last);assert.equal(record.openTrackingCount,5);
    assert.match(db.settings.openTrackingCheckSummary,/failed/);
    ctx.fetch=async()=>({ok:true,status:200,json:async()=>({unexpected:true})});await api.checkOpens(true,true);
    assert.match(record.openTrackingError,/invalid count/);
    ctx.fetch=async()=>({ok:true,status:200,json:async()=>({value:1})});await api.checkOpens(true,true);
    assert.equal(record.openTrackingCount,5);assert.equal(record.openTrackingFirstDetectedAt,first);assert.equal(record.openTrackingError,'');
    record.openTrackingArmedAt='2020-01-01';db.submissions[0].openTrackingArmedAt='2020-01-01';db.draft.openTrackingArmedAt='2020-01-01';
    assert.equal(api.trackingRecords(true).length,0);assert.equal(api.trackingRecords(true,true).length,1);
  }
  {
    const {api}=setup();
    const html='<html><body>Model photos<img src="cid:photo"></body></html>';
    const mime='To: person@example.com\r\nContent-Type: multipart/related; boundary="outer"\r\n\r\n--outer\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from(html).toString('base64')+'\r\n--outer\r\nContent-Type: image/jpeg\r\nContent-ID: <photo>\r\n\r\nATTACHMENT\r\n--outer--';
    const output=api.injectPixel(mime,'a'.repeat(28));
    assert.match(output,/Content-ID: <photo>\r\n\r\nATTACHMENT/);
    const encoded=output.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--outer')[0];
    assert.equal((Buffer.from(encoded,'base64').toString().match(/data-clm-open-track/g)||[]).length,1);
    const again=api.injectPixel(output,'b'.repeat(28));assert.doesNotMatch(again,/undefined/);
  }
  {
    const {ctx,db,api}=setup();
    const first={id:'first',gmailDraftId:'gmail-first',openTrackingId:'a'.repeat(28),openTrackingState:'ready',modelIds:['m1'],models:['First model']};
    const second={id:'second',gmailDraftId:'gmail-second',openTrackingId:'b'.repeat(28),openTrackingState:'ready'};
    db.drafts=[first,second];db.draft={...first};db.activeDraftId='first';db.models=[{id:'m1',name:'First model'}];
    const raw=Buffer.from('To: casting@example.com\r\nSubject: Package\r\nContent-Type: text/html\r\n\r\n<body>Hello</body>').toString('base64url');
    let release;const pending=new Promise(r=>release=r);let sends=0;
    ctx.fetch=async(url,opts={})=>{
      if(url.includes('/drafts/send')){sends++;return {ok:true,status:200,json:async()=>({id:'sent-first'})}}
      if(url.includes('/get/'))return {ok:true,status:404};
      if(opts.method==='PUT')return {ok:true,status:200,json:async()=>({id:'gmail-first'})};
      await pending;return {ok:true,status:200,json:async()=>({message:{raw}})};
    };
    const sending=api.sendTrackedCurrentDraft();
    await assert.rejects(api.sendTrackedCurrentDraft(),/already in progress/);
    db.activeDraftId='second';db.draft={...second};release();await sending;
    assert.equal(sends,1);assert.equal(first.gmailMessageId,'sent-first');assert.equal(second.gmailMessageId,undefined);
    assert.equal(db.draft.gmailDraftId,'gmail-second');assert.equal(db.submissions[0].draftId,'first');
    assert.equal(db.submissions[0].models[0],'First model');
    second.openTrackingState='send-uncertain';await assert.rejects(api.sendTrackedCurrentDraft(),/Check Sent Mail/);assert.equal(sends,1);
  }
  {
    const {ctx,db}=setup();
    const sync=fs.readFileSync('assets/crm-email-sync.js','utf8').replace('  initWhenReady(0);','  window.reconcileTest=reconcileSentMessage;');
    vm.runInContext(sync,ctx);
    const trackingId='c'.repeat(28);
    db.drafts=[{id:'pending',subject:'Model Package',recipientEmail:'casting@example.com',openTrackingId:trackingId,openTrackingState:'send-uncertain',gmailDraftId:'old'}];
    db.activeDraftId='pending';db.draft={...db.drafts[0]};
    const meta={id:'confirmed-message',internalDate:String(Date.now()),payload:{headers:[
      {name:'Subject',value:'Model Package'},{name:'To',value:'casting@example.com'},
      {name:'X-CLM-Tracking-ID',value:trackingId},{name:'X-CLM-Tracking-State',value:'armed'}]}};
    ctx.window.reconcileTest(meta);
    assert.equal(db.drafts[0].openTrackingState,'armed');assert.equal(db.draft.gmailDraftId,'');
    assert.equal(db.submissions[0].openTrackingId,trackingId);
    ctx.window.reconcileTest(meta);assert.equal(db.submissions.length,1);
  }
  console.log('Tracking behavior passed: errors, deduplication, history, MIME, navigation and duplicate-send guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
