const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
function fn(name){const re=new RegExp('^(?:async )?function '+name+'\\(','m');const m=re.exec(source);if(!m)throw Error(name);const rest=source.slice(m.index);const end=/\n(?:async )?function /.exec(rest);return end?rest.slice(0,end.index):rest;}
const preview={innerHTML:'',dataset:{manualRefreshInitialized:'1'},querySelectorAll:()=>[],focus(){}};
const controls={'#emailPreview':preview,'#emailRecipient':{value:'client@example.com'},'#emailSubject':{value:'New York Bridal Week | Brand'},'#emailPurpose':{value:'followup'}};
const ctx={console,structuredClone,Blob,AbortController,setTimeout,clearTimeout,window:{},seed:{draft:{}},db:{draft:{},drafts:[],models:[]},selected:[],emailDraftRenderTimer:0,emailDraftPersistTimer:0,emailPreviewEditTimer:0,
 $:s=>controls[s]||null,persistWorkspaceSafe:()=>true,captureDraft(){},setStatus(){},renderEmailSelection(){},renderBrandAdvisor(){},renderBriefSummary(){},renderSubmissionWarnings(){},renderDraftScope(){},updateEmailPurposeUi(){},setEmailPreviewRefreshPending(){},bindDraftPreviewGifs(){},draftPreviewHtml:h=>h,
 selectedModels:()=>[],nyDate:()=> '2026-10-02',uid:()=> 'draft-new',resetDraftUtilityControls(){},go(){},normalizeName:s=>String(s||'').toLowerCase(),
 document:{createElement:()=>({innerHTML:'',content:{querySelectorAll:()=>[]}})},
 recoverWorkspaceDefaults:data=>({...data,drafts:[{id:'injected',previewHtml:'SEED'}],draft:{previewHtml:'SEED'}}),
 activeDraftRecord:()=>ctx.db.drafts.find(d=>d.id===ctx.db.activeDraftId)||null,
 generateInitialEmailHtml:()=>{throw Error('Existing preview must never regenerate');},
 gmailToken:async()=> 'mock-token'};
vm.createContext(ctx);
for(const name of ['migrateDraftPreviewDocuments','applyRecovered','activeSavedDraftRecord','markPreviewNeedsGmailUpdate','storeDraftPreview','sanitizeEditableEmailHtml','emailHtml','currentEmailPreviewHtml','refreshEmailPreview','saveDraft','loadDraft','renderEmail','renderEmailPreviewOnly'])vm.runInContext(fn(name),ctx);
// Body editor and destructive rebuild paths are absent.
for(const token of ['emailCustomBody','resetBodyTextOverride','resetEmailPreviewEdits','ignoreFullPreviewOverride','syncManualPackageModels','Body text override'])assert.ok(!source.includes(token),token);
// Migrate existing body and manually edited full preview without deleting content.
const legacy={draft:{customBody:'Already added text'},drafts:[{id:'edited',manualEmailHtml:'<p>My typed edit</p>',customBody:'Stale body',userOverrides:{fullHtmlLocked:true,fullHtml:'<p>Old</p>',fields:{customBody:'Stale'}}}]};
const converted=ctx.migrateDraftPreviewDocuments(legacy);assert.equal(converted.draft.initialMessage,'Already added text');assert.equal(converted.drafts[0].previewHtml,'<p>My typed edit</p>');assert.ok(!('customBody' in converted.drafts[0]));assert.ok(!('manualEmailHtml' in converted.drafts[0]));assert.ok(!('fullHtml' in converted.drafts[0].userOverrides));
ctx.migrateDraftPreviewDocuments(converted);assert.equal(converted.drafts[0].previewHtml,'<p>My typed edit</p>');
// Recovered/default packages cannot layer onto persisted packages, including empty/deleted lists.
let recovered=ctx.applyRecovered({drafts:[{id:'mine',previewHtml:'<p>Keep</p>',modelIds:[]}],draft:{previewHtml:''},selected:[]});assert.equal(recovered.drafts.length,1);assert.equal(recovered.drafts[0].previewHtml,'<p>Keep</p>');assert.equal(recovered.draft.previewHtml,'');assert.equal(ctx.applyRecovered({drafts:[],draft:{}}).drafts.length,0);
// Save, refresh, render, reopen and a workspace reload preserve exact text and links.
const html='<div>Hi Brand Team,</div><p>I typed <b>this myself</b>.</p><p><a href="https://canva.link/my-link">My link</a></p><p>Text after the models.</p>';
ctx.db={draft:{subject:'Brand'},drafts:[],models:[]};preview.innerHTML=html;
ctx.saveDraft(false);assert.equal(ctx.db.drafts[0].previewHtml,html);ctx.refreshEmailPreview();ctx.renderEmail();ctx.renderEmailPreviewOnly();assert.equal(preview.innerHTML,html);
ctx.loadDraft('draft-new');ctx.renderEmail();assert.equal(preview.innerHTML,html);
ctx.db=ctx.applyRecovered(structuredClone(ctx.db));ctx.renderEmail();assert.equal(preview.innerHTML,html);
preview.innerHTML='';ctx.storeDraftPreview('',false);ctx.refreshEmailPreview();ctx.renderEmail();assert.equal(preview.innerHTML,'');assert.equal(ctx.emailHtml(),'');
// Real Gmail creation and updating both use the visible preview, with no template/model regeneration.
vm.runInContext(fn('gmailDraftRequest')+fn('createFormattedWorkGmailDraft'),ctx);
let calls=[],mimeHtml=[];
ctx.buildGmailDraftRaw=(to,subject,body)=>{mimeHtml.push(body);return new Blob([body],{type:'message/rfc822'});};
ctx.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({id:'gmail-1',message:{id:'message-1'}})};};
(async()=>{
 preview.innerHTML=html;ctx.storeDraftPreview(html,false);
 await ctx.createFormattedWorkGmailDraft();assert.equal(mimeHtml.at(-1),html);assert.equal(calls.at(-1).options.method,'POST');
 ctx.db.draft.gmailDraftId='gmail-1';ctx.db.drafts[0].gmailDraftId='gmail-1';preview.innerHTML=html+'<p>Second edit</p>';ctx.storeDraftPreview(preview.innerHTML);
 await ctx.createFormattedWorkGmailDraft();assert.equal(mimeHtml.at(-1),preview.innerHTML);assert.equal(calls.at(-1).options.method,'PUT');assert.equal(ctx.db.draft.previewNeedsGmailUpdate,false);
 // An edit during upload is retained and cannot be marked ready to send.
 ctx.fetch=async()=>{preview.innerHTML+='<p>Edit during upload</p>';ctx.storeDraftPreview(preview.innerHTML);return {ok:true,status:200,json:async()=>({id:'gmail-1',message:{id:'message-2'}})};};
 await ctx.createFormattedWorkGmailDraft();assert.equal(ctx.db.draft.previewHtml,preview.innerHTML);assert.equal(ctx.db.draft.previewNeedsGmailUpdate,true);ctx.renderEmail();assert.match(preview.innerHTML,/Edit during upload/);
 assert.equal((preview.innerHTML.match(/Second edit/g)||[]).length,1);
 console.log('Passed: migration, exact preview save/refresh/reopen/reload, seed isolation, blank preview, Gmail POST/PUT, and edits during upload.');
})().catch(e=>{console.error(e);process.exitCode=1});
