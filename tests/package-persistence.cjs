const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const source=fs.readFileSync('index.html','utf8'),factory=new IDBFactory();
function page(){
 const dom=new JSDOM(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
 const ctx=dom.getInternalVMContext();Object.assign(ctx,{structuredClone,indexedDB:factory,console,Blob,TextDecoder,CLMCloud:{init:async()=>{},save:async()=>true}});
 vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
 const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
 const run=s=>vm.runInContext(s,ctx);run('window.__clmWorkspaceReady=true');
 run(`db={models:[{id:'m',name:'Model',location:'NYC',profile:'https://www.chezlesmannequins.com/women/model'}],contacts:[],submissions:[],drafts:[{id:'legacy',subject:'Legacy',date:'2026-10-16',previewHtml:'<p>Keep legacy text</p>',modelIds:[],models:[]}],draft:{subject:'New custom shoot',modelIds:['m']},photoLibrary:{m:[{url:'https://test/original.jpg',label:'Original filename.jpg'}]},settings:{}};selected=['m'];active='email';hydrateDraft();renderAll=()=>{};renderEmailSelection=()=>{};renderBrandAdvisor=()=>{};renderBriefSummary=()=>{};renderSubmissionWarnings=()=>{};renderDraftScope=()=>{};go=async()=>{};`);
 return {dom,ctx,run};
}
(async()=>{
 const p=page();
 p.run(`document.querySelector('#emailRecipient').value='client@example.com';const preview=document.querySelector('#emailPreview');preview.innerHTML='<p>Exact user text <a href="https://canva.link/custom">custom link</a></p><img src="https://test/original.jpg">';preview.dataset.manualRefreshInitialized='1';`);
 const gallery=p.run('JSON.stringify(db.photoLibrary)'),stale=p.run('structuredClone(db)');
 assert.equal(await p.run('saveDraft(false)'),true);
 const saved=p.run('structuredClone(db.drafts.find(d=>d.id===db.activeDraftId))');
 assert.ok(saved.lastEditedAt);assert.equal(saved.date,p.run('nyDate()'));assert.match(saved.previewHtml,/Exact user text/);
 assert.equal(p.run('db.drafts.length'),2);assert.equal(p.run('JSON.stringify(db.photoLibrary)'),gallery);
 // An old tab must not erase a newly saved package.
 p.ctx.stale=stale;await p.run('idbWriteWorkspace(stale)');
 const stored=await p.run('idbReadWorkspace()');assert.equal(stored.drafts.length,2);assert.equal(stored.drafts.find(d=>d.id===saved.id).previewHtml,saved.previewHtml);
 assert.equal(stored.drafts.find(d=>d.id==='legacy').lastEditedAt,undefined);
 // Exercise the actual asynchronous bootstrap while a runtime tries to save seed data.
 const boot=page();boot.run(`window.__clmWorkspaceReady=false;db=structuredClone(seed);ensureMilanArchiveLoaded=async()=>{};startGmailSessionKeeper=()=>{};restoreWorkGmailSession=async()=>{};window.CLMCloud={init:()=>new Promise(()=>{}),save:()=>new Promise(()=>{})};window.CLMMediaStore={init:()=>new Promise(resolve=>window.releaseBoot=resolve)};`);
 const booting=boot.run('bootstrapWorkspace()');assert.equal(await boot.run('persistWorkspaceSafe(true)'),false);
 boot.run('window.releaseBoot()');await Promise.race([booting,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Cloud stalled bootstrap')),2000))]);
 assert.equal(boot.run('window.__clmWorkspaceReady'),true);assert.equal(boot.run('document.querySelector(".app").inert'),false);
 assert.equal(boot.run('db.models.length'),1);assert.equal(boot.run('db.models[0].id'),'m');assert.equal(boot.run('db.drafts.length'),2);boot.dom.window.close();
 // A runtime extension firing before bootstrap finishes cannot write seed data.
 p.run('window.__clmWorkspaceReady=false');assert.equal(await p.run('persistWorkspaceSafe(true)'),false);assert.equal((await p.run('idbReadWorkspace()')).drafts.length,2);p.run('window.__clmWorkspaceReady=true');
 // A cold reload uses the independently persisted package journal.
 p.dom.window.close();const q=page();await q.run('(async()=>{db=await loadWorkspaceIndexedDB()})()');q.run('renderDrafts()');
 assert.match(q.run("document.querySelector('#savedDrafts').textContent"),/Recently saved packages/);
 assert.match(q.run("document.querySelector('#savedDrafts').textContent"),/Last edited/);
 assert.match(q.run("packageDateText(db.drafts.find(d=>d.id==='legacy'))"),/Edit time unavailable/);
 // A field edit archives a new draft automatically, including recipient/notes.
 q.run(`db.activeDraftId='';db.draft={subject:'Autosaved custom title',modelIds:['m']};selected=['m'];hydrateDraft();document.querySelector('#emailRecipient').value='new@example.com';document.querySelector('#emailPrivateNotes').value='Keep this exact private note';queueEmailDraftRender();`);
 assert.equal(q.run('db.drafts.length'),3);await q.run('persistEditedPackage()');
 const auto=q.run('structuredClone(db.draft)');assert.equal(auto.recipientEmail,'new@example.com');assert.equal(auto.notes,'Keep this exact private note');
 assert.equal((await q.run('idbReadWorkspace()')).drafts.find(d=>d.id===auto.id).notes,auto.notes);
 // Opening/navigation never stamps a new edit time.
 const timestamp=q.run('db.draft.lastEditedAt');await q.run('loadDraft(db.activeDraftId)');assert.equal(q.run('db.draft.lastEditedAt'),timestamp);
 // Disk failure cannot report success or create a Gmail draft.
 q.run(`persistWorkspaceSafe=async()=>false;freezePreviewImagesForReview=async()=>{};document.querySelector('#emailRecipient').value='new@example.com';`);
 assert.equal(await q.run('saveDraft(false)'),false);
 assert.match(q.run("document.querySelector('#packageSaveStatus').textContent"),/NOT saved/);
 await assert.rejects(q.run('createFormattedWorkGmailDraft()'),/could not be saved/);
 // Sent recovery merges only missing IDs and keeps all existing model/gallery data.
 q.run('persistWorkspaceSafe=async()=>true');
 const before=q.run('db.drafts.length'),legacy=q.run("JSON.stringify(db.drafts.find(d=>d.id==='legacy'))");
 q.ctx.recoveryFile={text:async()=>JSON.stringify({format:'clm-recovered-sent-packages-v1',drafts:[{id:'recovered-sent-test',gmailMessageId:'sent-test',subject:'Recovered custom title',previewHtml:'<p>Original sent text</p>',sentAt:'2026-10-16T17:00:00Z'}]})};
 await q.run('importRecoveredPackages(recoveryFile)');await q.run('importRecoveredPackages(recoveryFile)');assert.equal(q.run('db.drafts.length'),before+1);assert.equal(q.run("JSON.stringify(db.drafts.find(d=>d.id==='legacy'))"),legacy);assert.equal(q.run('JSON.stringify(db.photoLibrary)'),gallery);
 // Custom subjects recover exact CID image bytes; non-package personal mail is ignored.
 let sync=fs.readFileSync('assets/crm-email-sync.js','utf8');sync=sync.replace('window.clmSyncSentMail=()=>syncSentMailNow(true);','window.testSent={recoverMissingSentPackage,reconcileSentMessage,gmailListSent};window.clmSyncSentMail=()=>syncSentMailNow(true);');vm.runInContext(sync,q.ctx);
 q.ctx.sent={id:'custom-sent',internalDate:'1792185853000',payload:{headers:[{name:'Subject',value:'Rituel de Fille Shoot Submission'},{name:'To',value:'new@example.com'}],parts:[{mimeType:'text/html',body:{data:Buffer.from('<p>Exact sent text</p><a href="https://www.chezlesmannequins.com/women/model">Portfolio</a><img src="cid:photo-original">').toString('base64url')}},{mimeType:'image/png',filename:'original.png',headers:[{name:'Content-ID',value:'<photo-original>'}],body:{data:Buffer.from('original image bytes').toString('base64url')}}]}};
 await q.run("window.testSent.recoverMissingSentPackage(sent,'token')");assert.equal(q.run('window.testSent.reconcileSentMessage(sent)'),true);
 assert.match(q.run("db.drafts.find(d=>d.gmailMessageId==='custom-sent').previewHtml"),/data:image\/png;base64,/);
 assert.equal(q.run("db.drafts.find(d=>d.gmailMessageId==='custom-sent').sentImageManifest[0].originalFilename"),'original.png');
 const count=q.run('db.drafts.length');await q.run("window.testSent.recoverMissingSentPackage(sent,'token')");assert.equal(q.run('db.drafts.length'),count);
 // Explicit cloud acceptance must not reapply an older local journal version.
 const accepted=await q.run('idbReadWorkspace()');accepted._cloudAcceptedAt=Date.now()+10;accepted.drafts.find(d=>d.id===saved.id).previewHtml='<p>Accepted cloud text</p>';q.ctx.accepted=accepted;
 await q.run('idbWriteWorkspace(accepted)');assert.equal((await q.run('idbReadWorkspace()')).drafts.find(d=>d.id===saved.id).previewHtml,'<p>Accepted cloud text</p>');
 q.dom.window.close();console.log('PASS: real IndexedDB save/reload, stale-tab protection, autosave fields, timestamps, honest failure, blocked Gmail on failure, additive recovery, custom-subject sent photos and cloud-copy acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1});
