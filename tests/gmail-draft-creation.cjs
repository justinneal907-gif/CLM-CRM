const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const api=source.slice(source.indexOf('async function gmailDraftRequest('),source.indexOf('let gmailDraftCreationInProgress='));
const ui=source.slice(source.indexOf('let gmailDraftCreationInProgress='),source.indexOf('\nfunction renderEmail()',source.indexOf('let gmailDraftCreationInProgress=')));
(async()=>{
 const ctx={selected:['model'],db:{draft:{},drafts:[],activeDraftId:''},captureDraft(){},$:s=>({value:s==='#emailRecipient'?'test@example.com':'Test package'}),emailHtml:()=>'<b>Package</b>',buildGmailDraftRaw:()=> 'mock-raw',gmailToken:async()=> 'mock-token',AbortController,setTimeout,clearTimeout,console};
 vm.createContext(ctx);vm.runInContext(api,ctx);
 let calls=[];ctx.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({id:'draft1',message:{id:'msg1',threadId:'thread1'}})}};
 await ctx.createFormattedWorkGmailDraft();assert.equal(calls[0].options.method,'POST');
 ctx.db.draft.gmailDraftId='existing';calls=[];await ctx.createFormattedWorkGmailDraft();assert.equal(calls[0].options.method,'PUT');assert.match(calls[0].url,/existing$/);
 calls=[];ctx.fetch=async(url,options)=>{calls.push(options.method);return calls.length===1?{ok:false,status:404}:{ok:true,status:200,json:async()=>({id:'replacement',message:{id:'new'}})}};
 await ctx.createFormattedWorkGmailDraft();assert.deepEqual(calls,['PUT','POST']);
 ctx.fetch=async()=>({ok:true,status:200,json:async()=>({})});await assert.rejects(ctx.createFormattedWorkGmailDraft(),/no draft confirmation/);
 ctx.fetch=async()=>({ok:false,status:403,json:async()=>({error:{message:'Insufficient Gmail permissions'}})});await assert.rejects(ctx.createFormattedWorkGmailDraft(),/Insufficient Gmail permissions/);
 // UI test: duplicate clicks, exact draft link, and visible errors despite blocked popups.
 const button={textContent:'Create formatted Gmail draft',disabled:false};let feedback=[];
 Object.assign(ctx,{$:s=>s==='#openWorkGmailBtn'?button:null,window:{open:()=>null},gmailOAuthClientId:()=> 'client',WORK_EMAIL:'work@example.com',renderGmailApiStatus(){},setStatus(){}});
 vm.runInContext(ui,ctx);ctx.showGmailDraftFeedback=(...args)=>feedback.push(args);
 let release,count=0;ctx.createFormattedWorkGmailDraft=()=>{count++;return new Promise(r=>release=r)};
 const pending=ctx.openInWorkGmail();await ctx.openInWorkGmail();assert.equal(count,1);assert.equal(button.disabled,true);
 release({id:'d',message:{id:'m',threadId:'exact-thread'}});await pending;assert.equal(button.disabled,false);assert.match(feedback.at(-1)[1],/#drafts\/exact-thread$/);
 ctx.createFormattedWorkGmailDraft=async()=>{throw new Error('Permission denied')};ctx.console={error(){}};await ctx.openInWorkGmail();assert.match(feedback.at(-1)[0],/Permission denied/);assert.equal(feedback.at(-1)[2],true);assert.equal(button.disabled,false);
 console.log('Gmail draft creation passed: create, update, stale link, malformed response, permissions, duplicate clicks, direct link and visible errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
