const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.CLM_TEST_DOM_MODULE||'jsdom');
const {document}=new JSDOM('').window;
const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('function gmailInlineDataImages('),end=source.indexOf('\nfunction ',start);
const ctx={document,crypto:require('node:crypto').webcrypto,gmailBase64Utf8:s=>Buffer.from(s).toString('base64')};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const image=(id,bytes)=>`<div data-clm-model-id="${id}"><b>${id}</b><img alt="${id} photo 1" src="data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}"></div>`;
const first=ctx.gmailInlineDataImages(image('erin','ERIN')+image('sophia','SOPHIA')+image('clara','CLARA'));
const second=ctx.gmailInlineDataImages(image('erin','ERIN')+image('clara','CLARA')+image('sophia','SOPHIA'));
const third=ctx.gmailInlineDataImages(image('sophia','NEW SOPHIA')+image('clara','CLARA')+image('erin','ERIN'));
function check(exported,expected){const holder=document.createElement('div');holder.innerHTML=exported.html;for(const block of holder.querySelectorAll('[data-clm-model-id]')){const id=block.getAttribute('data-clm-model-id'),cid=block.querySelector('img').getAttribute('src').slice(4),part=exported.parts.find(p=>p.cid===cid);assert.ok(part);assert.equal(part.modelId,id);assert.equal(Buffer.from(part.payload,'base64').toString(),expected[id]);assert.ok(part.filename.includes(id));assert.ok(!/^model-photo-\d/.test(part.filename));}}
check(first,{erin:'ERIN',sophia:'SOPHIA',clara:'CLARA'});check(second,{erin:'ERIN',sophia:'SOPHIA',clara:'CLARA'});check(third,{erin:'ERIN',sophia:'NEW SOPHIA',clara:'CLARA'});
const all=[...first.parts,...second.parts,...third.parts];assert.equal(new Set(all.map(p=>p.filename)).size,9);assert.equal(new Set(all.map(p=>p.cid)).size,9);
assert.match(source,/X-Attachment-Id: '\+part.cid/);
console.log('Passed: model-to-photo bytes after reorder/replacement; no attachment filename or CID reused across exports.');
