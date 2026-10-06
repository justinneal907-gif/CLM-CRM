const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith('http://127.0.0.1:8765')||u.startsWith('data:'))return route.continue();return route.fulfill({status:200,body:'',contentType:'text/plain'});});
 await page.goto('http://127.0.0.1:8765/');
 await page.waitForFunction(()=>typeof window.clmRenderBrandIntelligence==='function');
 await page.evaluate(async()=>{await go('email');startBlankPackage();document.getElementById('emailBrand').value='Arava Polak';document.getElementById('emailEvent').value='New York Bridal Week';captureDraft();renderBrandAdvisor();});
 await page.waitForFunction(()=>document.getElementById('brandLookSuggestion').textContent.includes('Lueur Secrète'));
 const initial=await page.evaluate(()=>({media:JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos])),draft:JSON.stringify(db.draft),selected:[...selected],html:document.getElementById('emailPreview').innerHTML}));
 assert.match(await page.locator('#brandLookSuggestion').innerText(),/Recommended models/);
 await page.evaluate(()=>{db.draft.previewHtml='<div><p>Existing user text</p></div>';document.getElementById('emailPreview').innerHTML=db.draft.previewHtml;});
 const id=await page.locator('[data-bi-add]').first().getAttribute('data-bi-add');
 await page.locator('[data-bi-add]').first().click();
 const added=await page.evaluate(()=>({media:JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos])),selected:[...selected],name:db.models.find(m=>m.id===selected[0])?.name,html:document.getElementById('emailPreview').innerHTML}));
 assert.deepEqual(added.selected,[id]);assert.equal(added.media,initial.media);
 // Adding follows the real package API; do not manufacture or replace email body text.
 assert.ok(added.html.includes(added.name));
 const count=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('clm.brand-intelligence.v1')).profiles).length);assert.equal(count,3);
 // Provider unavailable retains the last good research and package identity.
 await page.route('https://coipdgmfuervnuqnfiud.supabase.co/functions/v1/brand-intelligence',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Research setup required'})}));
 await page.locator('#brandWebSearchBtn').click();await page.waitForFunction(()=>document.getElementById('brandLookSuggestion').textContent.includes('Research setup required'));
 assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('clm.brand-intelligence.v1')).profiles).length),3);
 await page.reload();await page.waitForFunction(()=>typeof window.clmRenderBrandIntelligence==='function');
 await page.evaluate(async()=>{await go('email');document.getElementById('emailBrand').value='Arava Polak';renderBrandAdvisor();});
 await page.waitForFunction(()=>document.getElementById('brandLookSuggestion').textContent.includes('Lueur Secrète'));
 assert.equal(await page.evaluate(()=>JSON.stringify(db.models.map(m=>[m.id,m.photo,m.photoUrl,m.photos]))),initial.media);
 // Successful refresh updates the existing key and remains distinct from other brands.
 const updated=JSON.parse(fs.readFileSync('assets/data/brand-intelligence.json'))[1];updated.season='Reviewed season test';
 await page.route('https://coipdgmfuervnuqnfiud.supabase.co/functions/v1/brand-intelligence',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(updated)}));
 await page.locator('#brandWebSearchBtn').click();await page.waitForFunction(()=>document.getElementById('brandLookSuggestion').textContent.includes('Reviewed season test'));
 assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('clm.brand-intelligence.v1')).profiles).length),3);
 // Exercise the other two actual source profiles through the panel.
 for(const name of ['Nardos','Galia Lahav']){await page.evaluate(name=>{document.getElementById('emailBrand').value=name;renderBrandAdvisor();},name);assert.match(await page.locator('#brandLookSuggestion').innerText(),/Recommended models/);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('Passed: desktop CRM loads without JS exceptions; three source profiles; add-to-package uses actual model ID; model media unchanged; persisted reload; failed refresh retained data; successful refresh upserts without duplicates.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
