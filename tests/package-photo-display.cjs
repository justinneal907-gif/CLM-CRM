/* A photo stored in the CRM photo store must appear in the email preview and
   must be saved as its stored reference, never as a loading placeholder or an
   object URL that dies with the tab. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const PORT=process.env.CLM_TEST_PORT||'8765';
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'load'});
  await page.waitForFunction('window.__clmWorkspaceReady===true',{timeout:180000});
  await page.evaluate(async()=>{await go('email')});
  await page.waitForTimeout(1200);

  const result=await page.evaluate(async()=>{
    const out={};
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=2000;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#246';ctx.fillRect(0,0,1600,2000);
    ctx.fillStyle='#fc0';ctx.fillRect(100,100,900,900);
    const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.9));
    const ref=await window.CLMMediaStore.putBlob(blob,{label:'big.jpg',optimize:false});
    const model=db.models[0];
    const saved='<div><div data-clm-model-id="'+model.id+'"><img src="'+ref+'" width="440" alt="photo"></div></div>';
    db.draft={id:'photo-display-test',modelIds:[model.id],previewHtml:saved,purpose:'submission'};
    db.drafts=[...(db.drafts||[]).filter(d=>d.id!=='photo-display-test'),structuredClone(db.draft)];
    db.activeDraftId='photo-display-test';selected=[model.id];db.selected=[model.id];
    const preview=document.getElementById('emailPreview');
    preview.innerHTML=draftPreviewHtml(saved);preview.dataset.manualRefreshInitialized='1';
    // the photo must arrive on screen without anyone touching the page
    for(let i=0;i<30;i++){
      const img=preview.querySelector('img');
      if(img&&!window.CLMThumbnails.isPending(img.getAttribute('src')||''))break;
      await new Promise(r=>setTimeout(r,250));
    }
    await new Promise(r=>setTimeout(r,400));
    const img=preview.querySelector('img');
    out.onScreen=img?img.getAttribute('src'):'(no image)';
    out.displayedWidth=img?img.naturalWidth:0;
    out.saved=[...String(currentEmailPreviewHtml()).matchAll(/<img[^>]*src="([^"]*)"/g)].map(m=>m[1]);
    out.ref=ref;
    // an edit that drops the parked reference must still save the photo
    img.removeAttribute('data-clm-preview-full-src');
    out.recovered=[...String(currentEmailPreviewHtml()).matchAll(/<img[^>]*src="([^"]*)"/g)].map(m=>m[1]);
    return out;
  });

  assert.ok(/^blob:/.test(result.onScreen),'a stored photo must be displayed, got '+result.onScreen);
  assert.ok(result.displayedWidth>0&&result.displayedWidth<1600,'the preview must show a downscaled copy, got '+result.displayedWidth+'px');
  assert.deepEqual(result.saved,[result.ref],'the saved email must keep the stored photo reference');
  assert.deepEqual(result.recovered,[result.ref],'a preview edit must not replace the photo with a screen-only URL');
  assert.deepEqual(errors,[],'page errors: '+errors.join(' | '));
  await browser.close();
  console.log('PASS: stored package photos display downscaled, save as references, and survive losing the parked reference.');
})().catch(e=>{console.error(e);process.exitCode=1});
