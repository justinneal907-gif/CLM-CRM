const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('async function createBatchPackageDrafts(){');
const end=source.indexOf('\nlet gmailDraftCreationInProgress=',start);
assert.notEqual(start,-1,'batch creation function exists');
assert.notEqual(end,-1,'batch creation function end exists');
const batchSource=source.slice(start,end);
const builderStart=source.indexOf('function buildGmailDraftRaw(');
const builderEnd=source.indexOf('\nasync function gmailDraftRequest(',builderStart);
const formatterStart=source.indexOf("async function createFormattedWorkGmailDraft(recipientEmailOverride=''){");
const formatterEnd=source.indexOf('\nlet gmailDraftCreationInProgress=',formatterStart);
assert.notEqual(builderEnd,-1,'Gmail message builder end exists');
assert.notEqual(formatterEnd,-1,'Gmail draft formatter end exists');

(async()=>{
  const sentTo=[];
  const button={disabled:false,textContent:'Create personalized Gmail drafts'};
  const preview={innerHTML:'',dataset:{}};
  let id=0;
  const ctx={
    batchDraftCreationInProgress:false,
    batchRecipientRows:()=>ctx.db.draft.packageRecipients,
    db:{
      draft:{id:'source',recipientEmail:'legacy@example.com',packageRecipients:[
        {email:'jane@example.com',name:'Jane Doe'},
        {email:'alex@example.com',name:'Alex Lee'}
      ]},
      drafts:[{id:'source'}],
      activeDraftId:'source',
      models:[{id:'model-1'}]
    },
    selected:['model-1'],
    seed:{draft:{}},
    captureDraft(){},
    saveDraft:async()=>true,
    currentEmailPreviewHtml:()=>'<p>Package copy</p>',
    personalizePackageGreeting:html=>html,
    uid:()=>`recipient-copy-${++id}`,
    nyDate:()=> '2026-11-18',
    structuredClone,
    hydrateDraft(){},
    renderEmail(){},
    draftPreviewHtml:html=>html,
    $:selector=>selector==='#createBatchDraftsBtn'?button:selector==='#emailPreview'?preview:null,
    createFormattedWorkGmailDraft:async email=>sentTo.push(email),
    loadDraft:async()=>{},
    persistWorkspaceSafe:async()=>true,
    renderDrafts(){},
    renderBatchRecipients(){},
    setBatchRecipientStatus(){},
    console
  };
  vm.createContext(ctx);
  vm.runInContext(batchSource,ctx);
  const result=await ctx.createBatchPackageDrafts();
  assert.deepEqual(sentTo,['jane@example.com','alex@example.com']);
  assert.equal(result.created,2);
  assert.equal(result.failed,0);
  assert.equal(sentTo.includes('legacy@example.com'),false);

  const mimeMessages=[];
  const inputs={
    '#emailRecipient':{value:'legacy@example.com'},
    '#emailSubject':{value:'Test package'},
    '#emailPurpose':{value:'submission'}
  };
  const formatterCtx={
    window:{},selected:['model-1'],
    db:{draft:{id:'copy-1',previewHtml:'<p>Package</p>',recipientEmail:'legacy@example.com'},drafts:[{id:'copy-1'}],activeDraftId:'copy-1'},
    captureDraft(){},$:selector=>inputs[selector]||null,
    freezePreviewImagesForReview:async()=>{},currentEmailPreviewHtml:()=>'<p>Package</p>',
    storeDraftPreview(){},saveDraft:async()=>true,resolveStoredPhotosForExport:async html=>html,
    gmailInlineDataImages:html=>({html,parts:[]}),gmailPlainText:html=>html,gmailMimeHeader:value=>value,
    WORK_EMAIL:'sender@example.com',AGENT_CC:'agent@example.com',
    gmailWrapBase64:value=>value,gmailBase64Utf8:value=>Buffer.from(value,'utf8').toString('base64'),
    gmailBase64UrlUtf8:value=>Buffer.from(value,'utf8').toString('base64url'),
    gmailDraftRequest:async(_url,options)=>{mimeMessages.push(await options.body.text());return {ok:true,status:200,json:async()=>({id:`draft-${mimeMessages.length}`,message:{id:`message-${mimeMessages.length}`}})}},
    gmailToken:async()=> 'mock-token',verifiedGmailPackages:new Map(),verifyStoredGmailPackage:async()=>{},
    persistWorkspaceSafe:async()=>true,Blob,AbortController,setTimeout,clearTimeout,console
  };
  vm.createContext(formatterCtx);
  vm.runInContext(`let lastGmailPackage=null;${source.slice(builderStart,builderEnd)}\n${source.slice(formatterStart,formatterEnd)}`,formatterCtx);
  await formatterCtx.createFormattedWorkGmailDraft('jane@example.com');
  formatterCtx.db.drafts.push({id:'copy-2'});formatterCtx.db.activeDraftId='copy-2';
  formatterCtx.db.draft={id:'copy-2',previewHtml:'<p>Package</p>',recipientEmail:'legacy@example.com'};
  await formatterCtx.createFormattedWorkGmailDraft('alex@example.com');
  assert.deepEqual(mimeMessages.map(message=>message.match(/^To: (.+)$/m)?.[1]),['jane@example.com','alex@example.com']);

  const dom=new JSDOM('<!doctype html><div id="emailPreview"></div>');
  const fullPreview=dom.window.document.querySelector('#emailPreview');
  fullPreview.innerHTML='<p>Hi Old Contact,</p><p>Package copy</p>';
  const fullButton={disabled:false,textContent:'Create personalized Gmail drafts'};
  const fields={'#emailRecipient':{value:'legacy@example.com'},'#emailSubject':{value:'Test package'},'#emailPurpose':{value:'submission'}};
  const fullMessages=[];
  let copyId=0;
  const fullCtx={
    window:{},document:dom.window.document,NodeFilter:dom.window.NodeFilter,Blob,AbortController,setTimeout,clearTimeout,structuredClone,
    batchDraftCreationInProgress:false,selected:['model-1'],db:{draft:{id:'source',recipientEmail:'legacy@example.com',subject:'Test package',previewHtml:fullPreview.innerHTML,packageRecipients:[{email:'jane@example.com',name:'Jane Doe'},{email:'alex@example.com',name:'Alex Lee'}]},drafts:[{id:'source'}],activeDraftId:'source',models:[{id:'model-1'}]},
    seed:{draft:{}},captureDraft(){},batchRecipientRows:()=>fullCtx.db.draft.packageRecipients,
    currentEmailPreviewHtml:()=>fullPreview.innerHTML,freezePreviewImagesForReview:async()=>{},storeDraftPreview(){},saveDraft:async()=>true,
    resolveStoredPhotosForExport:async html=>html,draftPreviewHtml:html=>html,hydrateDraft(){},renderEmail(){},
    $:selector=>selector==='#emailPreview'?fullPreview:selector==='#createBatchDraftsBtn'?fullButton:fields[selector]||null,
    uid:()=>`full-copy-${++copyId}`,nyDate:()=> '2026-11-18',persistWorkspaceSafe:async()=>true,renderDrafts(){},renderBatchRecipients(){},loadDraft:async()=>{},setBatchRecipientStatus(){},
    gmailInlineDataImages:html=>({html,parts:[]}),gmailPlainText:html=>html,gmailMimeHeader:value=>value,gmailWrapBase64:value=>value,
    gmailBase64Utf8:value=>Buffer.from(value,'utf8').toString('base64'),gmailBase64UrlUtf8:value=>Buffer.from(value,'utf8').toString('base64url'),
    WORK_EMAIL:'sender@example.com',AGENT_CC:'agent@example.com',gmailToken:async()=> 'mock-token',verifiedGmailPackages:new Map(),verifyStoredGmailPackage:async()=>{},
    gmailDraftRequest:async(_url,options)=>{fullMessages.push(await options.body.text());return {ok:true,status:200,json:async()=>({id:`full-draft-${fullMessages.length}`,message:{id:`full-message-${fullMessages.length}`}})}},
    console
  };
  vm.createContext(fullCtx);
  vm.runInContext(`let lastGmailPackage=null;${source.slice(builderStart,builderEnd)}\n${source.slice(source.indexOf('function personalizePackageGreeting('),source.indexOf('\nlet batchDraftCreationInProgress=',source.indexOf('function personalizePackageGreeting(')))}\n${batchSource}\n${source.slice(formatterStart,formatterEnd)}`,fullCtx);
  const fullResult=await fullCtx.createBatchPackageDrafts();
  assert.equal(fullResult.created,2);
  assert.equal(fullResult.failed,0);
  assert.deepEqual(fullMessages.map(message=>message.match(/^To: (.+)$/m)?.[1]),['jane@example.com','alex@example.com']);
  const decodedBodies=fullMessages.map(message=>[...message.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/g)].map(match=>Buffer.from(match[1].replace(/\s/g,''),'base64').toString('utf8')).join('\n'));
  assert.match(decodedBodies[0],/Hi Jane,/);
  assert.doesNotMatch(decodedBodies[0],/Hi Jane Doe,/);
  assert.match(decodedBodies[1],/Hi Alex,/);
  assert.doesNotMatch(decodedBodies[1],/Hi Alex Lee,/);
  assert.doesNotMatch(fullMessages.join('\n'),/To: legacy@example\.com/);
  dom.window.close();
  console.log('Batch draft integration passed: each queued email appears in its own Gmail MIME To header, the legacy email is excluded, and greetings use first names.');
})().catch(error=>{console.error(error);process.exitCode=1});
