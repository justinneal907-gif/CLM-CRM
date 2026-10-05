/* Recovered from Justin's October 4 sent packages. No Gmail writes.
   Repair once; afterward the saved preview remains authoritative. */
const BRIDAL_MATERIALS_20261004={
  'new-york-women-callie-steg':{
    name:'Callie',label:'Callie in Bridal Wear',
    url:'https://drive.google.com/file/d/1WIQPS6fpnu5Pad-OVSLKDVDy5fLwvqMp/view?usp=drive_link',
    photo:'https://justinneal907-gif.github.io/CLM-CRM/assets/models/callie-recovered-bridal-20261004.jpg',
    seedPhoto:'https://images.squarespace-cdn.com/content/v1/604e73e30633472cafdd8d6c/f062c9b9-5ac7-4304-a07d-15dfec50d878/Screen+Shot+2026-08-15+at+9.29.52+PM.png'
  },
  'new-york-women-agang':{
    name:'Agang',label:'Agang in Bridal Wear',
    url:'https://drive.google.com/file/d/1qy27pHM8ScnzaX-0pPHn5p8lxqhJBGpc/view?usp=drive_link',
    photo:'https://images.squarespace-cdn.com/content/v1/604e73e30633472cafdd8d6c/aff9d40c-388a-4ad1-8246-9ff9546a2196/B48F0DF8-1838-4BB4-B0EB-27459CCFD603.JPG'
  }
};
function isBridalMaterialsDraft(d){return /bridal|nybfw/i.test([d?.id,d?.eventName,d?.subject,d?.packageName,d?.brandProject].join(' '))}
function bridalMaterialsExtra(model,draft){
  if(!isBridalMaterialsDraft(draft)||!model?.bridalMaterials)return null;
  const preset=model.bridalMaterials;
  const option=(model.textOptions||[]).find(o=>o.id===preset.textOptionId);
  return option?{enabled:true,text:option.text,textOptionId:option.id,mediaEnabled:false,mediaUrl:'',mediaLabel:''}:null;
}
function bridalMaterialPhotoKey(value){
  const raw=typeof value==='string'?value:value?.url||value?.src||'';
  try{const u=new URL(raw);u.searchParams.delete('format');return decodeURIComponent(u.href)}catch{return raw}
}
function bridalMaterialBlock(root,id,model,models=[]){
  const tagged=[...root.querySelectorAll('[data-clm-model-id]')].filter(el=>el.getAttribute('data-clm-model-id')===id);
  if(tagged.length===1)return tagged[0].querySelector('[data-clm-model-id]')?null:tagged[0];
  if(tagged.length>1)return null;
  // Legacy previews have no ID. Require an exact model-name heading, never position.
  const names=new Set([model.name,model.originalName,BRIDAL_MATERIALS_20261004[id]?.name].filter(Boolean).map(normalizeName));
  const headings=[...root.querySelectorAll('b,strong')].filter(el=>names.has(normalizeName(el.textContent)));
  if(headings.length!==1)return null;
  const block=headings[0].closest('div')?.parentElement;
  if(!block||block.querySelectorAll('img').length>8)return null;
  // A candidate containing another named model block is not a safe match.
  if(block.querySelector('[data-clm-model-id]'))return null;
  const otherNames=new Set(models.filter(m=>m.id!==id).flatMap(m=>[m.name,m.originalName]).filter(Boolean).map(normalizeName));
  if([...block.querySelectorAll('b,strong')].some(el=>otherNames.has(normalizeName(el.textContent))))return null;
  block.setAttribute('data-clm-model-id',id);return block;
}
function recoverBridalMaterials20261004(data){
  if(data.recovery?.bridalMaterialsRecovered20261004===1)return data;
  if(!Object.keys(BRIDAL_MATERIALS_20261004).every(id=>(data.models||[]).some(m=>m.id===id)))return data;
  const owns=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
  const list=value=>(Array.isArray(value)?value:[value]).map(x=>typeof x==='string'?x:x?.url||x?.src||'').filter(Boolean);
  data.photoLibrary=data.photoLibrary||{};
  const addPhoto=(id,url,label)=>{
    if(!url||/^(blob:|cid:|file:)/i.test(url))return;
    const photos=data.photoLibrary[id]||(data.photoLibrary[id]=[]),key=bridalMaterialPhotoKey(url);
    if(!photos.some(p=>bridalMaterialPhotoKey(p)===key))photos.push({url,label});
  };
  // Recover only photos with an existing, explicit model ID association.
  const archives=[...(data.packageSelectionBackups20261003||[]),...(data.bridalClosingLinkBackups20261004||[])];
  for(const record of [data.draft,...(data.drafts||[]),...archives].filter(Boolean)){
    for(const field of [record.photoSelections,record.packagePhotos,record.userOverrides?.photoSelections]){
      for(const [id,photos] of Object.entries(field||{}))for(const photo of list(photos))addPhoto(id,photo,'Recovered saved package photo');
    }
    const t=document.createElement('template');t.innerHTML=record.previewHtml||'';
    for(const block of t.content.querySelectorAll('[data-clm-model-id]')){
      const id=block.getAttribute('data-clm-model-id');
      if(!(data.models||[]).some(m=>m.id===id))continue;
      for(const img of block.querySelectorAll('img'))if(img.closest('[data-clm-model-id]')===block)addPhoto(id,img.getAttribute('src'),'Recovered preview photo');
    }
  }
  for(const [id,material] of Object.entries(BRIDAL_MATERIALS_20261004)){
    const model=data.models.find(m=>m.id===id);
    const options=model.textOptions||(model.textOptions=[]);
    let option=options.find(o=>String(o.text||'').includes(material.url.split('?')[0]));
    if(!option){option={id:'recovered-bridal-20261004',label:'Bridal Week',text:'['+material.label+']('+material.url+')'};options.push(option)}
    if(!model.bridalMaterials)model.bridalMaterials={textOptionId:option.id,photos:[material.photo]};
    addPhoto(id,material.photo,'Bridal Week • recovered from sent package');
  }
  const backups=[],changedIds=new Set();
  const repair=(record,key)=>{
    if(!record||!isBridalMaterialsDraft(record))return;
    const before=structuredClone(record);
    const t=document.createElement('template');t.innerHTML=record.previewHtml||'';
    let htmlChanged=false;
    for(const [id,material] of Object.entries(BRIDAL_MATERIALS_20261004)){
      if(!(record.modelIds||[]).includes(id))continue;
      const model=data.models.find(m=>m.id===id),block=bridalMaterialBlock(t.content,id,model,data.models);
      // A manually removed model block stays removed.
      if(typeof record.previewHtml==='string'&&!block)continue;
      const explicit=record.userOverrides?.modelExtras?.[id];
      const extra=explicit||record.modelExtras?.[id];
      const linked=block&&[...block.querySelectorAll('a')].some(a=>
        (a.getAttribute('href')||'').includes(material.url.split('/d/')[1].split('/')[0])||
        a.textContent.trim().toLowerCase()===material.label.toLowerCase());
      // Preserve explicit disabled/custom text. Otherwise restore the recovered option.
      const hasCustomExtra=explicit||extra?.text?.trim();
      if(!hasCustomExtra){
        record.modelExtras=record.modelExtras||{};
        record.modelExtras[id]=bridalMaterialsExtra(model,record);
      }
      const option=(model.textOptions||[]).find(o=>o.id===extra?.textOptionId);
      const mediaId=material.url.split('/d/')[1].split('/')[0];
      const savedLinkEnabled=(extra?.enabled&&String(option?.text||extra.text||'').includes(mediaId))||(extra?.mediaEnabled&&String(extra.mediaUrl||'').includes(mediaId));
      if(!linked&&(!hasCustomExtra||savedLinkEnabled)&&block){
        const row=document.createElement('div');row.setAttribute('data-clm-model-extra',id);row.style.margin='6px 0 0';
        const span=document.createElement('span');span.className='saved-model-text';span.style.cssText='color:#b00020;font-weight:800';
        const a=document.createElement('a');a.href=material.url;a.textContent=material.label;a.style.cssText='color:inherit;font-weight:inherit';
        span.appendChild(a);row.appendChild(span);
        const photo=[...block.children].find(el=>el.querySelector('img'));
        if(photo)photo.before(row);else block.appendChild(row);htmlChanged=true;
      }
      const explicitPhotos=record.userOverrides?.photoSelections;
      const saved=owns(explicitPhotos,id)?list(explicitPhotos[id]):list(record.photoSelections?.[id]||record.packagePhotos?.[id]);
      const seedKeys=new Set([material.seedPhoto,model.photo,model.photoUrl].filter(Boolean).map(bridalMaterialPhotoKey));
      const savedCustom=saved.some(url=>!seedKeys.has(bridalMaterialPhotoKey(url)));
      // Explicit empty selections and custom photos are intentional; keep them.
      const desired=owns(explicitPhotos,id)?saved:savedCustom?saved:model.bridalMaterials.photos;
      const images=block?[...block.querySelectorAll('img')]:[];
      const untouched=images.length>0&&images.every(img=>seedKeys.has(bridalMaterialPhotoKey(img.getAttribute('src'))));
      const missing=images.length===0&&(!owns(explicitPhotos,id)||saved.length>0);
      if(block&&record.includePhotos!==false&&(untouched||missing)&&desired?.length){
        const current=images.map(img=>bridalMaterialPhotoKey(img.getAttribute('src')));
        if(JSON.stringify(current)!==JSON.stringify(desired.map(bridalMaterialPhotoKey))){
          images.forEach(img=>img.remove());
          for(const src of desired){const row=document.createElement('div'),img=document.createElement('img');row.style.marginTop='8px';img.src=src;img.width=440;img.style.cssText='max-width:100%;height:auto;display:block';img.alt=material.name+' photo';row.appendChild(img);block.appendChild(row)}
          htmlChanged=true;
        }
        record.photoSelections={...(record.photoSelections||{}),[id]:[...desired]};
        record.packagePhotos={...(record.packagePhotos||{}),[id]:[...desired]};
      }
    }
    if(htmlChanged){record.previewHtml=t.innerHTML;record.html='';if(record.gmailDraftId)record.previewNeedsGmailUpdate=true}
    if(JSON.stringify(before)!==JSON.stringify(record)){backups.push({key,record:before});changedIds.add(record.id||key)}
  };
  for(const record of data.drafts||[])repair(record,record.id);
  repair(data.draft,'working');
  data.bridalMaterialsBackups20261004=backups;
  data.bridalMaterialsRecoverySummary={packages:changedIds.size,recoveredAt:new Date().toISOString()};
  data.recovery={...(data.recovery||{}),bridalMaterialsRecovered20261004:1};
  return data;
}

// Directly pasted/edited photos belong to the visible model block. Keep the
// package's photo picker and reusable gallery in step with that exact preview.
function rememberEditedPreviewPhotos(html){
  const t=document.createElement('template');t.innerHTML=html;
  for(const id of db.draft?.modelIds||[]){
    const model=db.models.find(m=>m.id===id);if(!model)continue;
    const block=bridalMaterialBlock(t.content,id,model,db.models);if(!block)continue;
    const sources=[...block.querySelectorAll('img')].map(img=>img.getAttribute('src')||'');
    if(sources.some(src=>!src||/^(blob:|cid:|file:)/i.test(src)))continue;
    setDraftPhotosForModel(id,sources);
    for(const src of sources)addPackagePhoto(id,src,'Saved from edited preview');
  }
}

/* Correct Erin using the image explicitly attached beneath her name in the
   October 4 Rita Vinieris email. Only Erin's model ID is affected. */
const ERIN_CORRECT_PHOTO_20261004='https://justinneal907-gif.github.io/CLM-CRM/assets/models/erin-correct-20261004.png';
function correctErinMaterials20261004(data){
  if(data.recovery?.erinPhotoCorrected20261004===1)return data;
  const id='new-york-women-erin-connors',model=(data.models||[]).find(m=>m.id===id);if(!model)return data;
  const wrong=source=>{
    const src=typeof source==='string'?source:source?.url||source?.src||'';
    return /erin-bridal-20261003\.jpg|f062c9b9-5ac7-4304-a07d-15dfec50d878|callie-recovered-bridal-20261004/.test(src)||window.CLMMediaStore?.contentKey?.(src)==='sha256:2044ea74a16a3bf29639960f22f2331a3c3d56617cc560605cd4a03e11f70d1e';
  };
  data.erinProfileBackup20261004={model:structuredClone(model),customPhoto:data.customPhotos?.[id]||'',photos:structuredClone(data.photoLibrary?.[id]||[])};
  model.name='Erin';model.photo=model.photoUrl=ERIN_CORRECT_PHOTO_20261004;model.photoFilename='erin-correct-20261004.png';
  model.profile=model.profileUrl='';delete model.profileLabel;delete model.instagram;delete model.instagramUrl;
  for(const field of ['photos','photoLibrary','portfolioPhotos','images'])if(Array.isArray(model[field]))model[field]=model[field].filter(p=>!wrong(p));
  data.customPhotos={...(data.customPhotos||{}),[id]:ERIN_CORRECT_PHOTO_20261004};
  data.photoLibrary=data.photoLibrary||{};
  data.photoLibrary[id]=(data.photoLibrary[id]||[]).filter(p=>!wrong(p));
  if(!data.photoLibrary[id].some(p=>bridalMaterialPhotoKey(p)===ERIN_CORRECT_PHOTO_20261004))data.photoLibrary[id].unshift({url:ERIN_CORRECT_PHOTO_20261004,label:'Erin • photo from sent email'});
  const replace=value=>Array.isArray(value)?[...new Set(value.map(p=>wrong(p)?ERIN_CORRECT_PHOTO_20261004:p))]:wrong(value)?ERIN_CORRECT_PHOTO_20261004:value;
  data.erinDraftBackups20261004=[];
  for(const record of [data.draft,...(data.drafts||[])].filter(Boolean)){
    const before=structuredClone(record);
    if(Array.isArray(record.models))record.models=record.models.map(name=>name==='Erin Connors'?'Erin':name);
    for(const map of [record.modelLinks,record.userOverrides?.modelLinks])if(map&&id in map)map[id]='';
    for(const map of [record.photoSelections,record.packagePhotos,record.userOverrides?.photoSelections])if(map?.[id])map[id]=replace(map[id]);
    for(const field of ['previewHtml','html']){
      if(typeof record[field]!=='string'||!record[field])continue;
      const t=document.createElement('template');t.innerHTML=record[field];
      const block=bridalMaterialBlock(t.content,id,model,data.models);if(!block)continue;
      let changed=false;
      for(const link of block.querySelectorAll('a'))if(/^(Portfolio|Instagram)$/i.test(link.textContent.trim())||/instagram\.com/i.test(link.getAttribute('href')||'')){if(link.querySelector('img'))link.replaceWith(...link.childNodes);else link.remove();changed=true}
      for(const label of block.querySelectorAll('b,strong'))if(label.textContent.trim()==='Erin Connors'){label.textContent='Erin';changed=true}
      for(const img of block.querySelectorAll('img')){
        if(wrong(img.getAttribute('src'))){img.setAttribute('src',ERIN_CORRECT_PHOTO_20261004);changed=true}
        if(/Erin Connors/.test(img.alt)){img.alt=img.alt.replace(/Erin Connors/g,'Erin');changed=true}
      }
      if(changed){record[field]=t.innerHTML;if(record.gmailDraftId)record.previewNeedsGmailUpdate=true}
    }
    if(JSON.stringify(before)!==JSON.stringify(record))data.erinDraftBackups20261004.push(before);
  }
  data.recovery={...(data.recovery||{}),erinPhotoCorrected20261004:1};
  return data;
}


// Reusable photo choices are scoped to one package only. A model photo chosen
// in one Bridal Week draft must never bleed into another Bridal Week draft.
function packagePhotoScope(d){
  const id=String(d?.id||'').trim();
  if(id)return 'package:'+id;
  const name=String(d?.packageName||d?.subject||d?.brandProject||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  if(name)return 'package-name:'+name;
  return 'working-draft';
}
function savedModelPackagePhotos(data,id,d){return data.savedModelPackagePhotos?.[packagePhotoScope(d)]?.[id]||null}
function rememberModelPackagePhotos(id,photos){
  const scope=packagePhotoScope(db.draft);
  db.savedModelPackagePhotos=db.savedModelPackagePhotos||{};
  const map=db.savedModelPackagePhotos[scope]||(db.savedModelPackagePhotos[scope]={});
  map[id]=[...photos];
}
function repairSavedPackagePhotos20261005(data){
  for(const record of [data.draft,...(data.drafts||[])].filter(Boolean))if(!Object.prototype.hasOwnProperty.call(record,'previewHtml'))record.reuseSavedModelPhotos=true;
  if(data.recovery?.savedPackagePhotos20261005===3)return data;
  data.savedModelPackagePhotos=data.savedModelPackagePhotos||{};
  const records=[...(data.drafts||[]),data.draft].filter(Boolean);
  const list=v=>(Array.isArray(v)?v:[v]).filter(x=>typeof x==='string'&&x&&!/^(blob:|cid:|file:)/i.test(x));
  // Recover exact model associations from saved user selections and previews.
  for(const record of records){
    const scope=packagePhotoScope(record),map=data.savedModelPackagePhotos[scope]||(data.savedModelPackagePhotos[scope]={});
    for(const id of record.modelIds||[]){
      const explicit=record.userOverrides?.photoSelections;
      if(explicit&&Object.prototype.hasOwnProperty.call(explicit,id)){map[id]=list(explicit[id]);continue}
      const model=data.models.find(m=>m.id===id);if(!model)continue;
      const t=document.createElement('template');t.innerHTML=record.previewHtml||'';
      const block=bridalMaterialBlock(t.content,id,model,data.models);
      const photos=block?list([...block.querySelectorAll('img')].map(img=>img.getAttribute('src'))):list(record.photoSelections?.[id]||record.packagePhotos?.[id]);
      const defaults=new Set([model.photo,model.photoUrl,data.customPhotos?.[id]].filter(Boolean).map(bridalMaterialPhotoKey));
      if(photos.length&&(photos.length>1||photos.some(p=>!defaults.has(bridalMaterialPhotoKey(p)))))map[id]=photos;
    }
  }
  data.savedPackagePhotosBackups20261005=[];
  for(const record of records){
    const before=structuredClone(record),t=document.createElement('template');t.innerHTML=record.previewHtml||'';
    let changed=false;
    for(const id of record.modelIds||[]){
      const model=data.models.find(m=>m.id===id);if(!model)continue;
      const block=bridalMaterialBlock(t.content,id,model,data.models);
      const explicit=record.userOverrides?.photoSelections;
      const owns=explicit&&Object.prototype.hasOwnProperty.call(explicit,id);
      const images=block?[...block.querySelectorAll('img')]:[];
      const current=list(images.map(img=>img.getAttribute('src')));
      const defaults=new Set([model.photo,model.photoUrl,data.customPhotos?.[id]].filter(Boolean).map(bridalMaterialPhotoKey));
      const reusable=savedModelPackagePhotos(data,id,record);
      // Repair seed-only packages; preserve custom, empty and explicit choices.
      const desired=owns?list(explicit[id]):reusable&&current.length&&current.every(p=>defaults.has(bridalMaterialPhotoKey(p)))?reusable:current;
      if(block&&record.includePhotos!==false&&JSON.stringify(current)!==JSON.stringify(desired)){
        images.forEach(img=>img.remove());
        for(const src of desired){const row=document.createElement('div'),img=document.createElement('img');row.style.marginTop='8px';img.src=src;img.alt=model.name+' photo';img.width=440;img.style.cssText='display:block;max-width:100%;height:auto';row.appendChild(img);block.appendChild(row)}
        changed=true;
      }
      if(block){record.photoSelections={...(record.photoSelections||{}),[id]:[...desired]};record.packagePhotos={...(record.packagePhotos||{}),[id]:[...desired]}}
    }
    if(changed){record.previewHtml=t.innerHTML;record.html='';record.previewNeedsGmailUpdate=true}
    if(JSON.stringify(before)!==JSON.stringify(record))data.savedPackagePhotosBackups20261005.push(before);
    // A new generated preview uses the saved model choices instead of seed photos.
    if(!Object.prototype.hasOwnProperty.call(record,'previewHtml'))record.reuseSavedModelPhotos=true;
  }
  data.recovery={...(data.recovery||{}),savedPackagePhotos20261005:3};return data;
}
