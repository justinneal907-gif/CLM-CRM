const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'outside-only'});
const ctx=dom.getInternalVMContext();ctx.structuredClone=structuredClone;ctx.console=console;
vm.runInContext(fs.readFileSync('assets/crm-bridal-materials.js','utf8'),ctx);
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(script.slice(0,script.indexOf('bootstrapWorkspace();')),ctx);
const run=s=>vm.runInContext(s,ctx),read=s=>JSON.parse(run(`JSON.stringify(${s})`));


run(`db={models:[{id:'a',name:'Callie'},{id:'b',name:'Maja'},{id:'c',name:'Agang'}],drafts:[],draft:{modelIds:['a','b'],previewHtml:'<div><p>Hi Team,</p><p>I wanted to send <b>Callie</b> and <i>Maja</i>. Their materials are below.</p><p>Again: Callie and Maja.</p><div data-clm-model-id="a"><b>Callie</b><img src="https://test/a.jpg"></div><div data-clm-model-id="b"><b>Maja</b><img src="https://test/b.jpg"></div><p>Thank you,</p></div>'},settings:{},photoLibrary:{}};selected=['a','b'];persistWorkspaceSafe=async()=>true;renderAll=()=>{};renderEmail=()=>{};renderEmailMatches=()=>{};`);
const text=()=>{const t=dom.window.document.createElement('template');t.innerHTML=read('db.draft.previewHtml');return t.content.textContent};
run(`db.models.push({id:'j',name:'Justin'});db.draft.previewHtml=db.draft.previewHtml.replace('<p>Thank you,</p>','<p>Hi Justin, please contact Maja for details.</p><p>Thank you,<br>Justin</p><p>Chez Les Mannequins</p>');`);
run("setSelectedModelPosition('b',1)");assert.match(text(),/send Maja and Callie/);assert.match(text(),/Again: Callie and Maja/);
run("addToEmail('c')");assert.match(text(),/send Maja, Callie, and Agang/);
run("removeFromEmail('a')");assert.match(text(),/send Maja and Agang/);
assert.match(read('db.draft.previewHtml'),/Thank you,<br>Justin/);assert.match(text(),/Hi Justin, please contact Maja for details/);
run("removeFromEmail('b');removeFromEmail('c');addToEmail('a')");assert.match(text(),/send Callie/);
run("db=JSON.parse(JSON.stringify(db));addToEmail('b')");assert.match(text(),/send Callie and Maja/);
// Even legacy bindings in the signature must stay untouched.
run(`db.draft.previewHtml='<div><p>I wanted to follow up and send <span data-clm-model-names="selected">Callie and Maja</span> as additional options.</p><div data-clm-model-id="a"><b>Callie</b></div><div data-clm-model-id="b"><b>Maja</b></div><p>Thank you,<br><span data-clm-model-names="selected">Justin</span></p><p>Please consider Justin</p></div>';document.querySelector('#emailPreview').dataset.manualRefreshInitialized='';`);
run("removeFromEmail('b')");assert.match(text(),/send Callie as additional options/);assert.match(read('db.draft.previewHtml'),/Thank you,<br><span data-clm-model-names="selected">Justin<\/span>/);assert.match(text(),/Please consider Justin/);
console.log('PASS: submission name lists follow add/remove/order, inline formatting and empty/reopened selections; Justin signature, greetings, other mentions, legacy signature spans and post-signature text remain unchanged.');
