const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
function fn(name){const re=new RegExp('^(?:async )?function '+name+'\\(','m'),m=re.exec(source);if(!m)throw Error(name);const rest=source.slice(m.index),end=/\n(?:async )?function /.exec(rest);return end?rest.slice(0,end.index):rest;}
const preview={innerHTML:'',dataset:{manualRefreshInitialized:''}};
const ctx={console,structuredClone,seed:{draft:{previewHtml:''}},selected:[],db:{activeDraftId:'',drafts:[],models:[]},$:(s)=>s==='#emailPreview'?preview:null,resetDraftUtilityControls(){},persistWorkspaceSafe(){},setStatus(){},normalizeName:s=>String(s||'').toLowerCase(),go(){preview.innerHTML=ctx.emailHtml();},
 activeDraftRecord(){return ctx.db.drafts.find(d=>d.id===ctx.db.activeDraftId)||null;},
 storeDraftPreview(html){ctx.db.draft.previewHtml=html;const active=ctx.activeDraftRecord();if(active)active.previewHtml=html;return html;},
 generateInitialEmailHtml(){return '<div data-clm-model-id="model-a"><b>Model A</b></div><div data-clm-model-id="model-b"><b>Model B</b></div><div>WhatsApp: +1(907)317-3791</div>';}};
vm.createContext(ctx);
for(const name of ['addWhatsAppContactToDrafts20261005','isSignatureOnlyModelDraftPreview','repairSignatureOnlyModelDraftPreviews20261006','activeDraftRecord','emailHtml','loadDraft'])vm.runInContext(fn(name),ctx);

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
console.log('Passed: Miami drafts regenerate their selected model blocks instead of treating migrated WhatsApp-only footers as complete previews.');
