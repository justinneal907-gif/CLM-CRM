/* CLM media store v2: keeps uploaded image bytes out of the main CRM workspace object. */
(function(){
  'use strict';
  const DB_NAME='jn-agency-crm', DB_VERSION=2, STORE='media', PREFIX='clm-media:';
  const objectUrls=new Map(), metadata=new Map(), contentKeys=new Map();

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB unavailable'));
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('workspace'))db.createObjectStore('workspace');
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Could not open media database'));
      req.onblocked=()=>reject(new Error('Media database upgrade blocked by another CRM tab'));
    });
  }
  function tx(mode,fn){
    return openDb().then(db=>new Promise((resolve,reject)=>{
      const tr=db.transaction(STORE,mode), store=tr.objectStore(STORE);
      let value;
      try{value=fn(store)}catch(err){db.close();reject(err);return}
      tr.oncomplete=()=>{db.close();resolve(value)};
      tr.onerror=()=>{db.close();reject(tr.error||new Error('Media transaction failed'))};
      tr.onabort=()=>{db.close();reject(tr.error||new Error('Media transaction aborted'))};
    }));
  }
  function idFromRef(value){const s=String(value||'');return s.startsWith(PREFIX)?s.slice(PREFIX.length):''}
  function makeRef(id){return PREFIX+id}
  function makeId(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
  async function contentHash(blob){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
  function contentKey(value){const raw=String(value||''),id=idFromRef(raw),hash=id?contentKeys.get(id):'';return hash?'sha256:'+hash:raw}
  async function remember(id,record){
    if(record.contentHash)contentKeys.set(id,record.contentHash);
    metadata.set(id,{type:record.type||record.blob?.type||'',name:record.name||'',size:record.size||record.blob?.size||0,sourceUrl:record.sourceUrl||'',contentHash:record.contentHash||''});
    if(record.blob instanceof Blob){
      objectUrls.set(id,await blobToDataUrl(record.blob));
    }
  }
  function dataUrlToBlob(dataUrl){
    const parts=String(dataUrl||'').split(','), head=parts.shift()||'';
    const mime=(head.match(/^data:([^;,]+)/i)||[])[1]||'application/octet-stream';
    const binary=/;base64/i.test(head)?atob(parts.join(',')):decodeURIComponent(parts.join(','));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:mime});
  }
  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
  async function optimizeBlob(blob,name='image'){
    const type=String(blob?.type||'').toLowerCase();
    if(!type.startsWith('image/')||type==='image/gif'||blob.size<280000)return blob;
    try{
      const bitmap=await createImageBitmap(blob);
      const max=1800, scale=Math.min(1,max/bitmap.width,max/bitmap.height);
      if(scale===1&&blob.size<550000){bitmap.close?.();return blob}
      const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,w,h);bitmap.close?.();
      const out=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.84));
      return out&&out.size<blob.size?out:blob;
    }catch(err){console.info('Image optimization skipped for',name,err);return blob}
  }
  async function putBlob(blob,meta={}){
    const optimized=meta.optimize===false?blob:await optimizeBlob(blob,meta.name);
    const id=meta.id||makeId();
    const hash=await contentHash(optimized);
    const record={contentHash:hash,blob:optimized,name:meta.name||'Uploaded image',type:optimized.type||blob.type||'',size:optimized.size,createdAt:Date.now(),sourceUrl:meta.sourceUrl||''};
    await tx('readwrite',store=>store.put(record,id));
    await remember(id,record);
    return makeRef(id);
  }
  async function getRecord(ref){
    const id=idFromRef(ref);if(!id)return null;
    return openDb().then(db=>new Promise((resolve,reject)=>{
      const tr=db.transaction(STORE,'readonly'), req=tr.objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
      tr.oncomplete=()=>db.close();tr.onerror=()=>{db.close();reject(tr.error)};
    }));
  }
  async function init(){
    try{
      const rows=[];
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tr=db.transaction(STORE,'readonly'), store=tr.objectStore(STORE), req=store.openCursor();
        req.onsuccess=()=>{const cur=req.result;if(!cur)return;rows.push([String(cur.key),cur.value||{}]);cur.continue()};
        req.onerror=()=>reject(req.error);tr.oncomplete=()=>{db.close();resolve()};tr.onerror=()=>{db.close();reject(tr.error)};
      });
      for(const [id,record] of rows){
        if(record.blob instanceof Blob&&!record.contentHash){record.contentHash=await contentHash(record.blob);await tx('readwrite',store=>store.put(record,id))}
        await remember(id,record);
      }
    }catch(err){console.info('CLM media store unavailable',err)}
  }
  function displayUrl(value){
    const raw=String(value||'');
    const id=idFromRef(raw);
    if(id)return objectUrls.get(id)||'';
    return raw;
  }
  function isGif(value){
    const raw=String(value||'');
    const id=idFromRef(raw);
    if(id)return /image\/gif/i.test(metadata.get(id)?.type||'');
    return /^data:image\/gif/i.test(raw)||/\.gif(?:[?#]|$)/i.test(raw);
  }
  async function storeFile(file){if(!file)return'';return putBlob(file,{name:file.name||'Uploaded image'})}
  async function toDataUrl(value){
    const raw=String(value||''),id=idFromRef(raw);if(!id)return raw;
    const record=await getRecord(raw);return record?.blob?blobToDataUrl(record.blob):'';
  }
  async function migrateWorkspace(data){
    let changed=false;
    const convert=async value=>{
      if(typeof value!=='string'||!/^data:image\//i.test(value))return value;
      const blob=dataUrlToBlob(value), ref=await putBlob(blob,{name:'Migrated CRM image'});
      changed=true;return ref;
    };
    for(const m of data.models||[]){
      for(const key of ['photo','photoUrl'])if(m[key])m[key]=await convert(m[key]);
      for(const key of ['photos','photoLibrary','portfolioPhotos','images'])if(Array.isArray(m[key])){
        for(let i=0;i<m[key].length;i++){
          const item=m[key][i];
          if(typeof item==='string')m[key][i]=await convert(item);
          else if(item&&typeof item==='object'){
            if(item.url)item.url=await convert(item.url);
            if(item.src)item.src=await convert(item.src);
          }
        }
      }
    }
    for(const [id,value] of Object.entries(data.customPhotos||{}))data.customPhotos[id]=await convert(value);
    for(const [id,list] of Object.entries(data.photoLibrary||{}))if(Array.isArray(list)){
      for(const item of list){
        if(typeof item==='string'){const ix=list.indexOf(item);list[ix]=await convert(item)}
        else if(item?.url)item.url=await convert(item.url);
      }
    }
    for(const d of [data.draft,...(data.drafts||[])].filter(Boolean)){
      for(const [id,value] of Object.entries(d.photoSelections||{})){
        if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=await convert(value[i])}
        else d.photoSelections[id]=await convert(value);
      }
      for(const list of Object.values(d.packagePhotos||{}))if(Array.isArray(list))for(let i=0;i<list.length;i++)list[i]=await convert(list[i]);
    }
    return {data,changed};
  }
  function findRefByHashes(hashes){
    const wanted=new Set((hashes||[]).map(x=>String(x||'').replace(/^sha256:/i,'').toLowerCase()).filter(Boolean));
    if(!wanted.size)return'';
    for(const [id,meta] of metadata.entries()){
      const hash=String(meta?.contentHash||'').toLowerCase();
      if(hash&&wanted.has(hash))return makeRef(id);
    }
    return'';
  }
  function mediaMeta(value){
    const id=idFromRef(value);return id?{...(metadata.get(id)||{})}:null;
  }
  async function remove(value){
    const id=idFromRef(value);if(!id)return;
    objectUrls.delete(id);metadata.delete(id);contentKeys.delete(id);
    await tx('readwrite',store=>store.delete(id));
  }
  window.CLMMediaStore={init,storeFile,putBlob,displayUrl,toDataUrl,migrateWorkspace,isGif,contentKey,findRefByHashes,mediaMeta,isMediaRef:v=>!!idFromRef(v),remove};
})();

