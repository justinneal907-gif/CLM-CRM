const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g,(all,url)=>url.startsWith('assets/')?'<script>'+fs.readFileSync(url.split('?')[0],'utf8')+'</script>':'');
const pause=()=>new Promise(r=>setTimeout(r,20));
async function mount(storage){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type==='unhandled-exception')errors.push(e.message)});let service={status:503,body:{error:'Research setup required'}};
 const dom=new JSDOM(html,{url:'https://justinneal907-gif.github.io/CLM-CRM/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.AbortSignal=AbortSignal;w.fetch=async(u,o)=>{if(String(u).includes('/functions/v1/brand-intelligence'))return new Response(JSON.stringify(service.body),{status:service.status});if(String(u).startsWith('assets/'))return new Response(fs.readFileSync(String(u).split('?')[0]));return new Response('{}');};w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};if(storage)for(const[k,v]of Object.entries(storage))w.localStorage.setItem(k,v);}});
 await pause();return {dom,w:dom.window,errors,setService:s=>service=s};}
(async()=>{let t=await mount(),w=t.w;const run=s=>w.eval(s);run("document.getElementById('emailBrand').value='Arava Polak';document.getElementById('emailEvent').value='New York Bridal Week';captureDraft();renderBrandAdvisor();");
 const text=()=>w.document.getElementById('brandLookSuggestion').textContent;
 assert.match(text(),/Lueur Secrète/);assert.match(text(),/Recommended models/);
 const media=run('JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos]))');
 run("db.draft.previewHtml='<div><p>Existing user text</p></div>';document.getElementById('emailPreview').innerHTML=db.draft.previewHtml;");
 const button=w.document.querySelector('[data-bi-add]'),id=button.dataset.biAdd;button.click();await pause();assert.ok(run('selected').includes(id));assert.equal(run('JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos]))'),media);
 const pHtml=run("document.getElementById('emailPreview').innerHTML");assert.ok(pHtml.includes(run('db.models.find(m=>m.id===selected[0]).name')));
 await w.clmAnalyzeBrand();assert.match(text(),/Research setup required/);assert.match(text(),/Lueur Secrète/);assert.equal(run("document.getElementById('emailPreview').innerHTML"),pHtml);
 const updated=JSON.parse(fs.readFileSync('assets/data/brand-intelligence.json'))[1];updated.season='Updated test season';t.setService({status:200,body:updated});await w.clmAnalyzeBrand();assert.match(text(),/Updated test season/);assert.equal(Object.keys(JSON.parse(w.localStorage.getItem('clm.brand-intelligence.v1')).profiles).length,3);
 for(const name of ['Nardos','Galia Lahav']){w.document.getElementById('emailBrand').value=name;w.clmRenderBrandIntelligence();assert.match(text(),/Recommended models/);}
 assert.deepEqual(t.errors,[]);
 const saved={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);saved[k]=w.localStorage.getItem(k);}w.close();t=await mount(saved);w=t.w;w.document.getElementById('emailBrand').value='Arava Polak';w.clmRenderBrandIntelligence();assert.match(text(),/Updated test season/);assert.equal(run('JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos]))'),media);assert.deepEqual(t.errors,[]);w.close();
 console.log('Passed: full CRM DOM initialization, three brand panels, real add-to-package, original model media, failed and successful refresh, no duplicate records, reload persistence, no uncaught JS errors.');
})().catch(e=>{console.error(e);process.exit(1)});
