/* CLM display thumbnails · 2026-10-19
   In-CRM thumbnails used to load every photo at full resolution (often
   1300x1600 to 2500px), so a package with ten models decoded well over a
   gigabyte of pixels and Chrome killed the tab. This only changes the URL an
   <img> inside the CRM displays. Stored photo URLs, drafts and the email
   preview HTML sent to Gmail are never touched. */
(function(){
  'use strict';
  const SQUARESPACE_WIDTHS=[100,300,500,750,1000,1500,2500];
  const PLACEHOLDER='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const MAX_CACHED=500,MAX_ACTIVE=2;
  const ready=new Map();      // source|width -> small blob URL, or the source itself when shrinking failed
  const waiting=new Map();    // source|width -> placeholder src
  const queue=[];let active=0,seq=0;

  function pixelWidth(cssWidth){return Math.ceil(cssWidth*Math.min(2,window.devicePixelRatio||1))}
  function squarespaceUrl(src,cssWidth){
    try{
      const u=new URL(src);
      if(!/(^|\.)squarespace-cdn\.com$/i.test(u.hostname))return '';
      const want=pixelWidth(cssWidth);
      const w=SQUARESPACE_WIDTHS.find(x=>x>=want)||2500;
      u.searchParams.set('format',w+'w');
      return u.toString();
    }catch{return ''}
  }
  function remember(key,value){
    ready.delete(key);ready.set(key,value);
    while(ready.size>MAX_CACHED){
      const [oldKey,oldUrl]=ready.entries().next().value;
      ready.delete(oldKey);
      if(oldUrl.startsWith('blob:')&&!oldKey.startsWith(oldUrl))URL.revokeObjectURL(oldUrl);
    }
  }
  function swapPlaceholder(placeholder,url){
    for(const img of document.querySelectorAll('img[src="'+placeholder.replace(/"/g,'\\"')+'"]'))img.src=url;
  }
  async function shrink(src,cssWidth){
    const response=await fetch(src,{mode:'cors',credentials:'omit'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const blob=await response.blob();
    const bitmap=await createImageBitmap(blob);
    const target=pixelWidth(cssWidth);
    if(bitmap.width<=target*1.25){bitmap.close();return ''}
    const height=Math.round(bitmap.height*target/bitmap.width);
    const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(target,height):Object.assign(document.createElement('canvas'),{width:target,height});
    const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,target,height);bitmap.close();
    const out=canvas.convertToBlob?await canvas.convertToBlob({type:'image/jpeg',quality:0.85}):await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.85));
    return out?URL.createObjectURL(out):'';
  }
  function pump(){
    while(active<MAX_ACTIVE&&queue.length){
      const job=queue.shift();active++;
      shrink(job.src,job.cssWidth).catch(()=>'').then(url=>{
        const finalUrl=url||job.src;
        // A failed blob: source may be a media URL that was just recycled; retry on the next render.
        if(url||!job.src.startsWith('blob:'))remember(job.key,finalUrl);
        waiting.delete(job.key);
        swapPlaceholder(job.placeholder,finalUrl);
      }).finally(()=>{active--;pump()});
    }
  }
  function url(src,cssWidth=150){
    src=String(src||'');
    if(!src||src.startsWith('clm-media:'))return src;
    const resized=squarespaceUrl(src,cssWidth);if(resized)return resized;
    if(!/^(https?:|blob:|data:image\/)/i.test(src)||typeof createImageBitmap!=='function')return src;
    if(src.startsWith('data:')&&src.length<60000)return src;
    const key=src+'|'+cssWidth;
    if(ready.has(key)){const hit=ready.get(key);ready.delete(key);ready.set(key,hit);return hit}
    if(waiting.has(key))return waiting.get(key);
    const placeholder=PLACEHOLDER+'#clm-thumb-'+(++seq);
    waiting.set(key,placeholder);
    queue.push({key,src,cssWidth,placeholder});
    setTimeout(pump,0);
    return placeholder;
  }
  window.CLMThumbnails={url};
})();
