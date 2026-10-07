const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
function fn(name){const re=new RegExp('^(?:async )?function '+name+'\\(','m'),m=re.exec(source);if(!m)throw Error(name);const rest=source.slice(m.index),end=/\n(?:async )?function /.exec(rest);return end?rest.slice(0,end.index):rest;}
const preview={innerHTML:'',dataset:{manualRefreshInitialized:''}};
const ctx={console,structuredClone,seed:{draft:{previewHtml:''}},selected:[],db:{activeDraftId:'',drafts:[],models:[]},$:(s)=>s==='#emailPreview'?preview:null,resetDraftUtilityControls(){},persistWorkspaceSafe(){},setStatus(){},normalizeName:s=>String(s||'').toLowerCase(),go(){preview.innerHTML=ctx.emailHtml();},
 activeDraftRecord(){return ctx.db.drafts.find(d=>d.id===ctx.db.activeDraftId)||null;},
 storeDraftPreview(html){ctx.db.draft.previewHtml=html;const active=ctx.activeDraftRecord();if(active)active.previewHtml=html;return html;},
 generateInitialEmailHtml(){return '<div data-clm-model-id="model-a"><b>Model A</b></div><div data-clm-model-id="model-b"><b>Model B</b></div><div>WhatsApp: +1(907)317-3791</div>';}};
vm.createContext(ctx);
for(const name of ['addWhatsAppContactToDrafts20261005','isSignatureOnlyModelDraftPreview','repairSignatureOnlyModelDraftPreviews20261006','repairMiamiSentCopy20261007','activeDraftRecord','emailHtml','loadDraft'])vm.runInContext(fn(name),ctx);

const draft={id:'miami_fashion_week_2026_test',modelIds:['model-a','model-b'],models:['Model A','Model B'],previewHtml:'',blankBodyCopy:true};
ctx.addWhatsAppContactToDrafts20261005({drafts:[draft],recovery:{}});
assert.equal(draft.previewHtml,'','WhatsApp migration must not create content in an empty preview.');
draft.previewHtml='<div>Justin</div><div><i>WhatsApp:</i></div><div><i>+1(907)317-3791</i></div><br><div><b>Chez Les Mannequins · Creative Agency</b></div><div><i>Model Representation | Artist Management | Casting | Production | Advertising</i></div>';
assert.equal(ctx.isSignatureOnlyModelDraftPreview(draft),true);
ctx.repairSignatureOnlyModelDraftPreviews20261006({drafts:[draft],recovery:{}});
assert.equal(Object.hasOwn(draft,'previewHtml'),false,'Signature-only saved preview must be regenerated.');
ctx.db={activeDraftId:'',drafts:[draft],models:[{id:'model-a',name:'Model A'},{id:'model-b',name:'Model B'}]};
ctx.loadDraft(draft.id);
assert.match(preview.innerHTML,/data-clm-model-id="model-a"/);
assert.match(preview.innerHTML,/data-clm-model-id="model-b"/);
assert.equal(ctx.db.draft.blankBodyCopy,true,'Keep the intentionally blank email copy setting.');
assert.equal(draft.previewNeedsGmailUpdate,undefined);

const blankDraft={id:'miami_fashion_week_2026_blank',purpose:'submission',modelIds:['model-a','model-b'],models:['Model A','Model B'],previewHtml:'',blankBodyCopy:true,initialMessage:''};
ctx.db={activeDraftId:'',drafts:[blankDraft],models:[{id:'model-a',name:'Model A'},{id:'model-b',name:'Model B'}]};
preview.innerHTML='';preview.dataset.manualRefreshInitialized='';
ctx.loadDraft(blankDraft.id);
assert.match(preview.innerHTML,/data-clm-model-id="model-a"/,'A blank saved Miami preview must be regenerated with its selected models.');
assert.match(preview.innerHTML,/data-clm-model-id="model-b"/,'A blank saved Miami preview must not suppress the second selected model.');
assert.notEqual(blankDraft.previewHtml,'','The regenerated Miami copy must be stored back on the saved draft.');

const modelOnlyHtml='<div style="font-family:Arial,sans-serif;font-size:13px;color:#000"><div>Below are our recommendations for Example Brand.</div><br><div data-clm-model-id="model-a"><b>Model A</b><img src="a.jpg"></div><div data-clm-model-id="model-b"><b>Model B</b><img src="b.jpg"></div><div>Again, you can see more models HERE.</div><div>Best,</div><div>Justin</div><div><i>WhatsApp:</i></div><div><i>+1(907)317-3791</i></div></div>';
const modelOnly={id:'miami_fashion_week_2026_existing',purpose:'submission',brandProject:'Example Brand',recipientEmail:'client@example.com',modelIds:['model-a','model-b'],models:['Model A','Model B'],photoSelections:{'model-a':['a.jpg'],'model-b':['b.jpg']},previewHtml:modelOnlyHtml,initialMessage:''};
const before={recipientEmail:modelOnly.recipientEmail,modelIds:structuredClone(modelOnly.modelIds),photoSelections:structuredClone(modelOnly.photoSelections)};
ctx.repairMiamiSentCopy20261007({draft:modelOnly,drafts:[modelOnly],models:[{id:'model-a',name:'Model A'},{id:'model-b',name:'Model B'}]});
assert.match(modelOnly.previewHtml,/Hi Example Brand Team,/);
assert.match(modelOnly.previewHtml,/I wanted to send Model A and Model B to Example Brand for Miami Fashion week\. Their materials are below\./);
assert.match(modelOnly.previewHtml,/Click <a href="https:\/\/canva\.link\/phxa5c71325j0qv" target="_blank">HERE<\/a>&nbsp;to see the rest of our models\./);
assert.match(modelOnly.previewHtml,/Again, you can find the rest of our models/);
assert.doesNotMatch(modelOnly.previewHtml,/Below are our recommendations/);
assert.doesNotMatch(modelOnly.previewHtml,/Again, you can see more models/);
assert.match(modelOnly.previewHtml,/Let me know if you would like to see any of them for a casting or fitting\./);
assert.match(modelOnly.previewHtml,/<div>Thank you,<\/div>/);
assert.match(modelOnly.previewHtml,/\+1\(907\)317 3791/);
assert.match(modelOnly.previewHtml,/data-clm-model-id="model-a"/);
assert.match(modelOnly.previewHtml,/src="a\.jpg"/);
assert.equal(modelOnly.recipientEmail,before.recipientEmail);
assert.deepEqual(modelOnly.modelIds,before.modelIds);
assert.deepEqual(modelOnly.photoSelections,before.photoSelections);

console.log('Passed: Miami drafts regenerate blank/signature-only previews and add the sent-email copy to existing model/photo previews without changing their package data.');
