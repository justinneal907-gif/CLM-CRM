const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.CLM_TEST_DOM_MODULE||'jsdom');
const {document}=new JSDOM('').window;
const source=fs.readFileSync('index.html','utf8');
const start=source.indexOf('function clmImageSlug('),end=source.indexOf('\nfunction buildGmailDraftRaw',start);
const ctx={document,crypto:require('node:crypto').webcrypto,gmailBase64Utf8:s=>Buffer.from(s).toString('base64')};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);

const image=(id,bytes)=>`<div data-clm-model-id="${id}"><b>${id}</b><img alt="${id}" src="data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}"></div>`;
const first=ctx.gmailInlineDataImages(image('erin','ERIN')+image('sophia','SOPHIA')+image('clara','CLARA'));
const second=ctx.gmailInlineDataImages(image('erin','ERIN')+image('clara','CLARA')+image('sophia','SOPHIA'));
const third=ctx.gmailInlineDataImages(image('sophia','NEW SOPHIA')+image('clara','CLARA')+image('erin','ERIN'));

function byModel(exported){return Object.fromEntries(exported.parts.map(p=>[p.modelId,p]));}
function check(exported,expected){
  const holder=document.createElement('div');holder.innerHTML=exported.html;
  for(const block of holder.querySelectorAll('[data-clm-model-id]')){
    const id=block.getAttribute('data-clm-model-id');
    const img=block.querySelector('img');
    const cid=img.getAttribute('src').slice(4);
    const part=exported.parts.find(p=>p.cid===cid);
    assert.ok(part);
    assert.equal(part.modelId,id);
    assert.equal(img.getAttribute('data-clm-image-id'),part.imageId);
    assert.equal(Buffer.from(part.payload,'base64').toString(),expected[id]);
    assert.ok(part.filename.startsWith('clm-img-'+id+'-'));
    assert.ok(!/model[-_ ]?photo[-_ ]?\d+/i.test(part.filename));
  }
}
check(first,{erin:'ERIN',sophia:'SOPHIA',clara:'CLARA'});
check(second,{erin:'ERIN',sophia:'SOPHIA',clara:'CLARA'});
check(third,{erin:'ERIN',sophia:'NEW SOPHIA',clara:'CLARA'});

// Reordering cannot change an image's individual identifier or filename.
const a=byModel(first),b=byModel(second),d=byModel(third);
for(const id of ['erin','clara']){
  assert.equal(a[id].imageId,b[id].imageId);
  assert.equal(a[id].filename,b[id].filename);
}
assert.equal(a.sophia.imageId,b.sophia.imageId);
assert.equal(a.sophia.filename,b.sophia.filename);

// Replacing the image must change its identifier.
assert.notEqual(a.sophia.imageId,d.sophia.imageId);
assert.notEqual(a.sophia.filename,d.sophia.filename);

// CIDs remain unique per export even when the same image is reused in another email.
const allCids=[...first.parts,...second.parts,...third.parts].map(p=>p.cid);
assert.equal(new Set(allCids).size,allCids.length);
assert.match(source,/X-CLM-Image-ID: '\+part.imageId/);
assert.match(source,/X-Attachment-Id: '\+part.cid/);
console.log('Passed: package image identity is model/content-derived, stable under reorder, changes on replacement, and never uses generic numbered filenames.');
