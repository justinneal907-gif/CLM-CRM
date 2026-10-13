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
run("setSelectedModelPosition('b',1);addToEmail('c');removeFromEmail('a')");
assert.match(text(),/send Callie and Maja/);assert.match(text(),/Again: Callie and Maja/);
assert.deepEqual(read('selected'),['b','c']);
assert.ok(!read('db.draft.previewHtml').includes('test/a.jpg'));
// Previously bound names are now ordinary editable text too.
run(`db.draft.previewHtml='<div><p>I wanted to send <span data-clm-model-names="selected">Maja and Agang</span>.</p><div data-clm-model-id="b"><b>Maja</b></div><div data-clm-model-id="c"><b>Agang</b></div></div>';document.querySelector('#emailPreview').dataset.manualRefreshInitialized='';`);
run("setSelectedModelPosition('c',1);removeFromEmail('b')");
assert.match(text(),/send Maja and Agang/);
console.log('PASS: add/remove/reorder update model sections while body names stay untouched, including previously saved bindings.');
