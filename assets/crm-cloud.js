/* Private, versioned Supabase persistence. Browser storage remains a durable offline copy. */
(function(){
  'use strict';
  const OWNER='7752d038-f954-4223-8e19-d7485fb30710', BUCKET='clm-crm-private';
  const client=window.supabase.createClient('https://coipdgmfuervnuqnfiud.supabase.co','sb_publishable_-3GGsWtASGt6dyTet6TWjg_CoZf7Xqs');
  const skip=new Set(['workspaceSavedAt','dailyActionQueue','activeDraftId','selected','draft','_cloudAcceptedAt']);
  let version=null, baseline={}, queue=Promise.resolve(), hooks, connected=false, conflict=false;
  function parts(data){
    const out={};for(const [key,value] of Object.entries(data))if(!skip.has(key)&&key!=='drafts'&&key!=='photoLibrary')out[key]=value;
    for(const d of data.drafts||[])out['draft:'+d.id]=d;
    for(const [id,items] of Object.entries(data.photoLibrary||{}))out['gallery:'+id]=items;
    return out;
  }
  const canonical=value=>JSON.stringify(value,function(key,item){return item&&typeof item==='object'&&!Array.isArray(item)?Object.keys(item).sort().reduce((out,k)=>(out[k]=item[k],out),{}):item});
  function message(text,error=false){const el=document.getElementById('crmCloudStatus');if(el){el.textContent=text;el.style.color=error?'#a62424':'';}window.dispatchEvent(new CustomEvent('clm:cloud-status',{detail:{text,error}}));}
  function check(result){if(result.error)throw result.error;return result.data;}
  async function signedIn(){const user=check(await client.auth.getUser())?.user;if(user?.id!==OWNER)throw new Error('Sign in with your work account to save to Supabase.');return user;}
  async function read(keys){
    await signedIn();
    for(let attempt=0;attempt<3;attempt++){
      const before=check(await client.from('crm_cloud_state').select('version,updated_at').eq('owner_id',OWNER).single());
      const rows=[];const groups=keys?Array.from({length:Math.ceil(keys.length/30)},(_,i)=>keys.slice(i*30,i*30+30)):[null];
      for(const group of groups)for(let offset=0;;offset+=100){let query=client.from('crm_cloud_parts').select('part_key,data').eq('owner_id',OWNER);if(group)query=query.in('part_key',group);const page=check(await query.order('part_key').range(offset,offset+99));rows.push(...page);if(page.length<100)break;}
      const after=check(await client.from('crm_cloud_state').select('version,updated_at').eq('owner_id',OWNER).single());
      if(before.version===after.version)return {version:after.version,parts:Object.fromEntries(rows.map(r=>[r.part_key,r.data]))};
    }
    throw new Error('Cloud is changing. Retry shortly; your browser copy is safe.');
  }
  function backup(snapshot,key){return new Promise((resolve,reject)=>{
    const request=indexedDB.open('clm-cloud-safety',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('copies');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result,tx=db.transaction('copies','readwrite');tx.objectStore('copies').put(snapshot,key||Date.now()+'-'+crypto.randomUUID());tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}};
  });}
  async function digest(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');}
  function refs(data){const found=new Set();const visit=v=>{if(typeof v==='string'){for(const m of v.matchAll(/clm-media:([A-Za-z0-9_-]+)/g))found.add('clm-media:'+m[1]);}else if(v&&typeof v==='object')Object.values(v).forEach(visit)};visit(data);return [...found];}
  async function uploadMedia(data,previous={}){
    const manifest={...previous};
    for(const ref of refs(data)){
      const record=await window.CLMMediaStore.getRecord(ref);
      if(!record?.blob)throw new Error('A photo is missing from this browser. Cloud save stopped; existing cloud photos are safe.');
      const hash=await digest(record.blob),path=OWNER+'/'+ref.slice(10)+'/'+hash+'/'+encodeURIComponent(record.name||'Uploaded image');
      if(manifest[ref]?.sha256===hash)continue;
      const existing=await client.storage.from(BUCKET).download(path);
      if(existing.error){
        check(await client.storage.from(BUCKET).upload(path,record.blob,{upsert:false,contentType:record.type,metadata:{originalName:record.name,sha256:hash}}));
        const verified=check(await client.storage.from(BUCKET).download(path));
        if(await digest(verified)!==hash)throw new Error('Photo verification failed. Save stopped.');
      }else if(await digest(existing.data)!==hash)throw new Error('Cloud photo does not match. Save stopped.');
      manifest[ref]={path,sha256:hash,name:record.name};
    }return manifest;
  }
  async function hydrateMedia(data){
    for(const ref of refs(data)){
      const mapped=data.cloudMediaManifest?.[ref];
      const existing=await window.CLMMediaStore.getRecord(ref);
      if(existing?.blob){if(mapped&&await digest(existing.blob)!==mapped.sha256)throw new Error('This browser has a different version of a cloud photo. Both copies are retained; contact support before replacing it.');continue;}
      if(mapped){const blob=check(await client.storage.from(BUCKET).download(mapped.path));if(await digest(blob)!==mapped.sha256)throw new Error('Cloud photo verification failed.');await window.CLMMediaStore.putBlob(blob,{id:ref.slice(10),name:mapped.name,optimize:false});continue;}
      const folder=OWNER+'/'+ref.slice(10), hashes=check(await client.storage.from(BUCKET).list(folder));
      let restored=false;
      for(const entry of hashes){
        const files=check(await client.storage.from(BUCKET).list(folder+'/'+entry.name));
        for(const file of files){
          const blob=check(await client.storage.from(BUCKET).download(folder+'/'+entry.name+'/'+file.name));
          if(await digest(blob)!==entry.name)throw new Error('Cloud photo verification failed.');
          await window.CLMMediaStore.putBlob(blob,{id:ref.slice(10),name:decodeURIComponent(file.name),optimize:false});restored=true;break;
        }if(restored)break;
      }
      if(!restored)throw new Error('A cloud photo has not uploaded yet. Keep the original browser copy open.');
    }
  }
  async function commit(snapshot,expected,old){
    await signedIn();const media=await uploadMedia(snapshot,old.cloudMediaManifest||{});
    const next={...parts(snapshot),cloudMediaManifest:media},patch={};for(const [key,value] of Object.entries(next))if(canonical(value)!==canonical(old[key]))patch[key]=value;
    if(!Object.keys(patch).length){const state=check(await client.from('crm_cloud_state').select('version').eq('owner_id',OWNER).single());if(state.version!==expected)throw new Error('CRM_CONFLICT: Another browser saved changes. Your copy is retained.');baseline=old;return expected;}
    const saved=check(await client.rpc('crm_commit',{p_expected:expected,p_parts:patch}));
    const remote=await read(Object.keys(patch));
    if(remote.version!==saved||Object.keys(patch).some(key=>canonical(remote.parts[key])!==canonical(patch[key])))throw new Error('Cloud changed during verification. Your browser copy is retained.');
    baseline={...old,...remote.parts};return saved;
  }
  async function save(snapshot){
    const copy=structuredClone(snapshot);
    const operation=queue.then(async()=>{
      if(!connected||conflict){message(conflict?'Save conflict — browser copy retained. Review cloud copies below.':'Saved in this browser only — sign in and connect cloud saving.',true);return false;}
      try{message('Saving to Supabase…');version=await commit(copy,version,baseline);await backup({version,parts:baseline},'confirmed');message('Saved and verified in Supabase · '+new Date().toLocaleTimeString());return true;}
      catch(error){if(String(error.message).includes('CRM_CONFLICT')){conflict=true;connected=false;}message('Cloud NOT saved: '+error.message+' Browser copy retained.',true);return false;}
    });queue=operation.catch(()=>false);return operation;
  }
  async function connect(mode){
    try{
      await queue;const snapshot=structuredClone(hooks.get()),remote=await read();
      const remotePackages=Object.keys(remote.parts).filter(k=>k.startsWith('draft:')).length;
      document.getElementById('crmCloudReview').textContent='Cloud: '+remotePackages+' packages. This browser: '+(snapshot.drafts||[]).length+' packages. Both copies are preserved before changing copies.';
      if(!mode){message('Signed in. Choose which copy to open below; no data has been replaced.');return;}
      await backup(snapshot);
      if(mode==='browser'){
        // Preserve cloud-only records. Never infer deletions from a missing browser row.
        const local=parts(snapshot);for(const [key,value] of Object.entries(remote.parts))if(!(key in local))local[key]=value;
        const combined=assemble(local,snapshot);version=await commit(combined,remote.version,remote.parts);await hooks.replace(combined);
      }else{
        const next=assemble(remote.parts,snapshot);next._cloudAcceptedAt=Date.now();
        // Do not carry a stale editable draft over the cloud package being opened.
        const active=next.drafts.find(d=>d.id===snapshot.activeDraftId);
        if(active){next.draft=structuredClone(active);next.selected=[...(active.modelIds||[])];}
        await hydrateMedia(next);await hooks.replace(next);version=remote.version;baseline=remote.parts;
      }
      await backup({version,parts:baseline},'confirmed');connected=true;conflict=false;message('Connected · '+remotePackages+' cloud packages · future saves go to Supabase');
    }catch(error){connected=false;message('Cloud connection stopped: '+error.message+' Your browser copy is safe.',true);}
  }
  function assemble(p,local){const out={...local,drafts:[],photoLibrary:{}};for(const [key,value] of Object.entries(p)){if(key.startsWith('draft:'))out.drafts.push(value);else if(key.startsWith('gallery:'))out.photoLibrary[key.slice(8)]=value;else out[key]=value;}return out;}
  async function init(callbacks){
    hooks=callbacks;
    const panel=document.createElement('section');panel.style.cssText='margin:12px;padding:14px;border:2px solid #927b53;border-radius:12px;background:#fff;color:#222';
    panel.innerHTML='<strong>Private cloud saving</strong><p id="crmCloudStatus" role="status">Saved in this browser only. Connect Supabase below.</p><details><summary>Connect or review cloud copies</summary><form id="crmCloudLogin"><p>Work account: justin.neal.chezlesmannequins@gmail.com</p><label>Password <input id="crmCloudPassword" type="password" autocomplete="current-password" required></label> <button type="submit">Sign in</button></form><p id="crmCloudReview"></p><button type="button" id="crmCloudInspect">Check cloud</button> <button type="button" id="crmCloudLoad">Open cloud copy</button> <button type="button" id="crmCloudKeep">Save this browser copy to cloud</button><p>Opening a copy keeps a safety backup of this browser. Saving this browser copy retains earlier cloud versions and cloud-only packages.</p></details>';
    document.body.prepend(panel);
    document.getElementById('crmCloudLogin').onsubmit=async event=>{event.preventDefault();try{check(await client.auth.signInWithPassword({email:'justin.neal.chezlesmannequins@gmail.com',password:document.getElementById('crmCloudPassword').value}));document.getElementById('crmCloudPassword').value='';await connect();}catch(error){message('Sign-in failed: '+error.message,true)}};
    document.getElementById('crmCloudInspect').onclick=()=>connect();document.getElementById('crmCloudLoad').onclick=()=>connect('cloud');document.getElementById('crmCloudKeep').onclick=()=>connect('browser');
    // Auto-resume only the exact cloud revision this browser last confirmed.
    const session=await client.auth.getSession();if(session.data?.session?.user?.id===OWNER){
      const remembered=await loadBaseline();if(remembered){try{const remote=await read();if(remote.version===remembered.version){version=remote.version;baseline=remembered.parts;connected=true;message('Cloud connected · checking pending browser changes');return;}}catch{}}
      await connect();
    }
  }
  async function loadBaseline(){return new Promise(resolve=>{const request=indexedDB.open('clm-cloud-safety',1);request.onupgradeneeded=()=>request.result.createObjectStore('copies');request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result,tx=db.transaction('copies','readonly'),get=tx.objectStore('copies').get('confirmed');get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>resolve(null);tx.oncomplete=()=>db.close()}})}
    // Baselines live in IndexedDB alongside safety copies, never in small localStorage quotas.
  window.CLMCloud={init,save,parts,assemble,canonical,connect,isConnected:()=>connected};
})();
