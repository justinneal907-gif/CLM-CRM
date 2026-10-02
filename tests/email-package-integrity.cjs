const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.CLM_TEST_DOM_MODULE||'jsdom');
const {document}=new JSDOM('<html><body><div id="emailPreview"></div></body></html>').window;
const source=fs.readFileSync('index.html','utf8');
function fn(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);const rest=source.slice(m.index);const end=/\n(?:async )?function /.exec(rest);return end?rest.slice(0,end.index):rest;}
const preview=document.getElementById('emailPreview');preview.dataset.manualRefreshInitialized='1';
const b64=s=>Buffer.from(s).toString('base64url');let returned;
const ctx={console,document,window:{},Blob,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,atob,btoa,WORK_EMAIL:'work@example.com',AGENT_CC:'agent@example.com',db:{activeDraftId:'crm1'},$:()=>preview,
 gmailToken:async()=> 'token',gmailDraftRequest:async()=>({ok:true,json:async()=>returned}),
 gmailMimeHeader:s=>s,gmailBase64Utf8:s=>Buffer.from(s).toString('base64'),gmailBase64UrlUtf8:b64,gmailWrapBase64:s=>s.match(/.{1,76}/g)?.join('\r\n')||'',gmailPlainText:s=>s,
 storeDraftPreview:s=>{ctx.saved=s},persistWorkspaceSafe(){},FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload()})}}};
vm.createContext(ctx);vm.runInContext('let lastGmailPackage=null;const verifiedGmailPackages=new Map();',ctx);
for(const n of ['freezePreviewImagesForReview','normalizedPackageHtml','verifyStoredGmailPackage','gmailInlineDataImages','buildGmailDraftRaw','sanitizeEditableEmailHtml','draftPreviewHtml'])vm.runInContext(fn(n),ctx);
ctx.currentEmailPreviewHtml=()=>ctx.sanitizeEditableEmailHtml(preview.innerHTML);
const one='data:image/png;base64,'+Buffer.from('reviewed photo A').toString('base64');
const two='data:image/gif;base64,'+Buffer.from('reviewed GIF B').toString('base64');
function stored(){return vm.runInContext(`(()=>{const e=lastGmailPackage;verifiedGmailPackages.set('g1',e);return {message:{id:'m1',payload:{headers:[{name:'To',value:e.to},{name:'Subject',value:e.subject}],parts:[{mimeType:'text/html',body:{data:btoa(unescape(encodeURIComponent(e.html))).replace(/\\+/g,'-').replace(/\\//g,'_')}},...e.parts.map(p=>({mimeType:p.mime,headers:[{name:'Content-ID',value:'<'+p.cid+'>'}],body:{data:p.payload}}))]}}}})()`,ctx)}
(async()=>{
 // The displayed image wins even when a stale hidden reference points at another image.
 const visible='<p>My edit.</p><img src="'+one+'" data-media-ref="clm-media:wrong" data-gif-src="'+two+'">';
 const cleaned=ctx.sanitizeEditableEmailHtml(visible);assert.ok(cleaned.includes(one));assert.ok(!cleaned.includes(two));assert.ok(!cleaned.includes('data-media-ref'));
 preview.innerHTML='<p>Hi Team, my exact edit.</p><img alt="Aliana" src="'+one+'"><img alt="GIF" src="'+two+'">';
 await ctx.freezePreviewImagesForReview();
 const raw=await ctx.buildGmailDraftRaw('client@example.com','Subject',preview.innerHTML,'',true).text();fs.writeFileSync('/tmp/clm-package-integrity.eml',raw);
 assert.ok(raw.includes('Content-Transfer-Encoding: base64'));assert.ok(!raw.includes('Content-Transfer-Encoding: 8bit'));
 returned=stored();await ctx.verifyStoredGmailPackage('g1');
 let good=structuredClone(returned);
 // This is the reported failure: a different photo's bytes under the same image identifier.
 returned.message.payload.parts[1].body.data=Buffer.from('basketball photo substituted').toString('base64');
 await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/photo bytes differ/);
 returned=structuredClone(good);returned.message.payload.parts.pop();await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/missing or extra/);
 returned=structuredClone(good);returned.message.payload.parts[2].headers=returned.message.payload.parts[1].headers;await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/Duplicate/);
 returned=structuredClone(good);returned.message.payload.parts[0].body.data=b64('<p>Different email</p>');await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/HTML differs/);
 returned=structuredClone(good);returned.message.payload.headers[0].value='wrong@example.com';await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/recipient differs/);
 returned=structuredClone(good);returned.message.payload.headers[1].value='Wrong subject';await assert.rejects(ctx.verifyStoredGmailPackage('g1'),/subject differs/);
 returned=structuredClone(good);const e=vm.runInContext('lastGmailPackage.html',ctx);returned.message.payload.parts[0].body.data=b64(e+'<img src="https://track.example/pixel" data-clm-open-track="1">');await ctx.verifyStoredGmailPackage('g1',true);
 preview.innerHTML='<p>Keep my text.</p><img src="cid:old-draft">';await assert.rejects(ctx.freezePreviewImagesForReview(),/another Gmail/);
 preview.innerHTML='<img src="https://mail.google.com/mail/u/0?attid=0.7">';await assert.rejects(ctx.freezePreviewImagesForReview(),/another Gmail/);
 preview.innerHTML='<p>My text</p><img src="https://image.example/model.png">';ctx.fetch=async()=>({ok:true,blob:async()=>new Blob(['fixed image'],{type:'image/png'})});await assert.rejects(ctx.freezePreviewImagesForReview(),/Review every photograph/);assert.ok(preview.innerHTML.includes('data:image/png;base64,'));assert.equal(preview.innerHTML,ctx.saved);await ctx.freezePreviewImagesForReview();
 preview.innerHTML='<p>My text</p><img src="https://image.example/model.png">';ctx.fetch=async()=>{preview.innerHTML+='<p>Edit while freezing</p>';return {ok:true,blob:async()=>new Blob(['fixed'],{type:'image/png'})}};await assert.rejects(ctx.freezePreviewImagesForReview(),/preview changed/);assert.ok(preview.innerHTML.includes('Edit while freezing'));
 console.log('Passed: real DOM visible-source authority, MIME image association, Gmail byte/HTML/recipient/subject verification, pixel verification, stale Gmail image rejection, fixed-image review, concurrent edits.');
})().catch(e=>{console.error(e);process.exitCode=1});
