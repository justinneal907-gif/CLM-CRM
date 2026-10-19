/* Private, versioned Supabase persistence. Browser storage remains a durable offline copy. */
(function(){
  'use strict';
  const OWNER='7752d038-f954-4223-8e19-d7485fb30710', BUCKET='clm-crm-private';
  function bounded(promise,label,ms=20000){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out. Your browser copy is retained; you can keep editing and retry.')),ms)})]).finally(()=>clearTimeout(timer));}
  const activeRequests=new Set();
  function deadline(task,label,ms=45000){let cancelled=false,timer;const failure=()=>new Error(label+' timed out. Browser copy retained; check cloud before retrying.');const guard=()=>{if(cancelled)throw failure()};return Promise.race([task(guard),new Promise((_,reject)=>{timer=setTimeout(()=>{cancelled=true;for(const controller of activeRequests)controller.abort();reject(failure())},ms)})]).finally(()=>clearTimeout(timer));}
  async function cloudFetch(input,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    activeRequests.add(controller);
    const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted)controller.abort();
    try{return await fetch(input,{...options,signal:controller.signal});}
    finally{activeRequests.delete(controller);clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
  }
  const client=window.supabase.createClient('https://coipdgmfuervnuqnfiud.supabase.co','sb_publishable_-3GGsWtASGt6dyTet6TWjg_CoZf7Xqs',{global:{fetch:cloudFetch}});
  const skip=new Set(['workspaceSavedAt','dailyActionQueue','activeDraftId','selected','draft','_cloudAcceptedAt']);
  let version=null, baseline={}, queue=Promise.resolve(), hooks, connected=false, conflict=false, connecting=false, connectionError='';
  let pendingSnapshot=null,saveWaiters=[],draining=false;
  const verifiedMedia={};let mediaCacheQueue=Promise.resolve();
  function parts(data){
    const out={};for(const [key,value] of Object.entries(data))if(!skip.has(key)&&key!=='drafts'&&key!=='photoLibrary')out[key]=value;
    for(const d of data.drafts||[])out['draft:'+d.id]=d;
    for(const [id,items] of Object.entries(data.photoLibrary||{}))out['gallery:'+id]=items;
    return out;
  }
  const canonical=value=>JSON.stringify(value,function(key,item){return item&&typeof item==='object'&&!Array.isArray(item)?Object.keys(item).sort().reduce((out,k)=>(out[k]=item[k],out),{}):item});
  function mergeBrowser(local,remote){
    const out={...remote,...local};
    for(const key of ['models','contacts','submissions','bookings','tasks'])if(Array.isArray(remote[key])&&Array.isArray(local[key])){
      const records=new Map(remote[key].map((item,i)=>[item.id||'cloud:'+i,item]));
      for(const [i,item] of local[key].entries()){const id=item.id||'browser:'+i;records.set(id,{...(records.get(id)||{}),...item})}out[key]=[...records.values()];
    }
    for(const key of Object.keys(remote))if(key.startsWith('gallery:')&&Array.isArray(local[key])){
      const items=new Map();for(const item of [...remote[key],...local[key]])items.set(canonical(item),item);out[key]=[...items.values()];
    }
    for(const key of ['customPhotos','settings','localGalleryOverrides','hiddenGalleryPhotoKeys','deletedPhotoKeys','packageRestoreTimes','packageDeletionTimes','modelInteractions'])if(remote[key]&&local[key]&&typeof remote[key]==='object'&&!Array.isArray(remote[key]))out[key]={...remote[key],...local[key]};
    return out;
  }
  function message(text,error=false){const el=document.getElementById('crmCloudStatus');if(el){el.textContent=text;el.style.color=error?'#a62424':'';}window.dispatchEvent(new CustomEvent('clm:cloud-status',{detail:{text,error}}));}
  function browserChanged(snapshot){const live=hooks.get();return (live.workspaceSavedAt||0)!==(snapshot.workspaceSavedAt||0)||canonical(parts(live))!==canonical(parts(snapshot))||canonical(live.draft)!==canonical(snapshot.draft)||live.activeDraftId!==snapshot.activeDraftId;}
  function check(result){if(result.error)throw result.error;return result.data;}
  async function signedIn(){const user=check(await bounded(client.auth.getUser(),'Account check',12000))?.user;if(user?.id!==OWNER)throw new Error('Sign in with your work account to save to Supabase.');return user;}
  async function read(keys,guard=()=>{}){
    await signedIn();guard();
    for(let attempt=0;attempt<3;attempt++){
      const before=check(await client.from('crm_cloud_state').select('version,updated_at').eq('owner_id',OWNER).single());
      guard();
      const rows=[];const groups=keys?Array.from({length:Math.ceil(keys.length/30)},(_,i)=>keys.slice(i*30,i*30+30)):[null];
      for(const group of groups)for(let offset=0;;offset+=10){guard();let query=client.from('crm_cloud_parts').select('part_key,data').eq('owner_id',OWNER);if(group)query=query.in('part_key',group);const page=check(await query.order('part_key').range(offset,offset+9));guard();rows.push(...page);if(page.length<10)break;}
      const after=check(await client.from('crm_cloud_state').select('version,updated_at').eq('owner_id',OWNER).single());
      guard();if(before.version===after.version)return {version:after.version,parts:Object.fromEntries(rows.map(r=>[r.part_key,r.data]))};
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
  async function uploadMedia(data,previous={},guard=()=>{}){
    const manifest={...verifiedMedia,...previous},references=refs(data);let cursor=0,completed=0,stopped=false;
    async function worker(){while(cursor<references.length){
      if(stopped)return;const ref=references[cursor++];
      guard();
      const record=await window.CLMMediaStore.getRecord(ref);
      if(!record?.blob)throw new Error('A photo is missing from this browser. Cloud save stopped; existing cloud photos are safe.');
      const hash=await digest(record.blob),path=OWNER+'/'+ref.slice(10)+'/'+hash+'/'+encodeURIComponent(record.name||'Uploaded image');
      if(manifest[ref]?.sha256===hash){completed++;continue;}
      message('Syncing photo '+(completed+1)+' of '+references.length+' in the background — you can keep editing.');
      const existing=await client.storage.from(BUCKET).download(path);
      guard();
      if(existing.error){
        check(await client.storage.from(BUCKET).upload(path,record.blob,{upsert:false,contentType:record.type,metadata:{originalName:record.name,sha256:hash}}));
        guard();
        const verified=check(await client.storage.from(BUCKET).download(path));
        guard();
        if(await digest(verified)!==hash)throw new Error('Photo verification failed. Save stopped.');
      }else if(await digest(existing.data)!==hash)throw new Error('Cloud photo does not match. Save stopped.');
      manifest[ref]={path,sha256:hash,name:record.name};
      verifiedMedia[ref]=manifest[ref];
      mediaCacheQueue=mediaCacheQueue.catch(()=>{}).then(()=>backup({...verifiedMedia},'verified-media-v1'));
      await bounded(mediaCacheQueue,'Verified photo progress',12000);completed++;
    }}
    try{await Promise.all(Array.from({length:Math.min(3,references.length)},()=>worker()));}catch(error){stopped=true;throw error;}
    guard();return manifest;
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
  async function commit(snapshot,expected,old,guard=()=>{}){
    await signedIn();guard();const media=await uploadMedia(snapshot,old.cloudMediaManifest||{},guard);guard();
    const next={...parts(snapshot),cloudMediaManifest:media},patch={};for(const [key,value] of Object.entries(next))if(canonical(value)!==canonical(old[key]))patch[key]=value;
    if(!Object.keys(patch).length){const state=check(await client.from('crm_cloud_state').select('version').eq('owner_id',OWNER).single());guard();if(state.version!==expected)throw new Error('CRM_CONFLICT: Another browser saved changes. Your copy is retained.');baseline=old;return expected;}
    const saved=check(await client.rpc('crm_commit',{p_expected:expected,p_parts:patch}));
    guard();const remote=await read(Object.keys(patch),guard);guard();
    if(remote.version!==saved||Object.keys(patch).some(key=>canonical(remote.parts[key])!==canonical(patch[key])))throw new Error('Cloud changed during verification. Your browser copy is retained.');
    baseline={...old,...remote.parts};return saved;
  }
  async function saveOnce(copy){
      if(!connected||conflict){if(!connecting&&!connectionError)message(conflict?'Save conflict — browser copy retained. Review cloud copies below.':'Saved in this browser only — connect cloud saving above.',true);return false;}
      try{message('Saving to Supabase in the background — you can keep editing.');version=await deadline(guard=>commit(copy,version,baseline,guard),'Cloud save');await bounded(backup({version,parts:baseline},'confirmed'),'Local sync confirmation',12000);if(!pendingSnapshot){message('Saved and verified in Supabase · '+new Date().toLocaleTimeString());hooks.confirmed?.();}return true;}
      catch(error){if(String(error.message).includes('CRM_CONFLICT')){conflict=true;connected=false;}if(/timed out|abort/i.test(error.message)){connected=false;connectionError='Cloud confirmation interrupted. Check cloud to reconnect; browser copy retained.';}message('Cloud NOT saved: '+error.message+' Browser copy retained.',true);return false;}
  }
  function save(snapshot){
    // One active save plus one latest snapshot. Do not build an unbounded queue.
    // Do not duplicate the entire photo-heavy workspace when cloud saving is inactive.
    // The browser's own persistence still runs independently.
    if(!connected||conflict)return Promise.resolve(false);
    pendingSnapshot=structuredClone(snapshot);
    const result=new Promise(resolve=>saveWaiters.push(resolve));
    if(!draining){
      draining=true;queue=Promise.resolve().then(async()=>{
        let saved=false;
        try{while(pendingSnapshot){const copy=pendingSnapshot;pendingSnapshot=null;saved=await saveOnce(copy);if(!saved){pendingSnapshot=null;break;}}}
        catch(error){message('Cloud NOT saved: '+error.message+' Browser copy retained.',true);}
        finally{draining=false;const waiting=saveWaiters;saveWaiters=[];for(const resolve of waiting)resolve(saved);}
        return saved;
      });
    }
    return result;
  }
  async function connect(mode){
    if(connecting)return;
    connecting=true;connectionError='';
    try{
      message(mode?'Checking cloud and preserving both copies…':'Checking work-account connection…');
      await queue;const snapshot=structuredClone(hooks.get()),remote=await bounded(read(),'Cloud connection',45000);
      const remotePackages=Object.keys(remote.parts).filter(k=>k.startsWith('draft:')).length;
      document.getElementById('crmCloudReview').textContent='Cloud: '+remotePackages+' packages. This browser: '+(snapshot.drafts||[]).length+' packages. Both copies are preserved before changing copies.';
      if(!mode){message('Signed in. Choose which copy to open below; no data has been replaced.');return;}
      await bounded(backup(snapshot),'Browser safety backup',12000);
      if(mode==='browser'){
        // Preserve cloud-only records. Never infer deletions from a missing browser row.
        message('Uploading and verifying private photos, then saving packages…');
        const local=mergeBrowser(parts(snapshot),remote.parts);
        const combined=assemble(local,snapshot);await bounded(hydrateMedia(combined),'Photo recovery',45000);version=await deadline(guard=>commit(combined,remote.version,remote.parts,guard),'Cloud connection save');
        // Editing continues during network I/O. Never replace edits made since
        // this connection snapshot was captured.
        if(!browserChanged(snapshot))await hooks.replace(combined);
      }else{
        // The cloud version wins for matching records. Browser-only records
        // and gallery entries remain accessible instead of disappearing.
        const next=assemble(mergeBrowser(remote.parts,parts(snapshot)),snapshot);next._cloudAcceptedAt=Date.now();
        // Do not carry a stale editable draft over the cloud package being opened.
        const active=next.drafts.find(d=>d.id===snapshot.activeDraftId);
        if(active){next.draft=structuredClone(active);next.selected=[...(active.modelIds||[])];}
        await bounded(hydrateMedia(next),'Photo recovery',45000);
        if(browserChanged(snapshot))throw new Error('You edited while the cloud copy was loading. Current edits are retained; use Save this browser copy to cloud.');
        await hooks.replace(next);version=remote.version;baseline=remote.parts;
      }
      await bounded(backup({version,parts:baseline},'confirmed'),'Local sync confirmation',12000);connected=true;conflict=false;
      await save(hooks.get());
    }catch(error){connected=false;connectionError='Cloud connection stopped: '+error.message+' Your browser copy is safe.';message(connectionError,true);}
    finally{connecting=false;}
  }
  async function safetyCopies(){return new Promise((resolve,reject)=>{const request=indexedDB.open('clm-cloud-safety',1);request.onupgradeneeded=()=>request.result.createObjectStore('copies');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('copies','readonly'),get=tx.objectStore('copies').getAll();get.onsuccess=()=>resolve((get.result||[]).filter(row=>Array.isArray(row.drafts)));get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close()}})}
  async function recoverMissing(){
    try{
      await queue;const original=structuredClone(hooks.get());await backup(original);
      let merged=parts(original);const before=(original.drafts||[]).length;
      for(const copy of await safetyCopies()){
        const old=parts(copy);
        for(const key of Object.keys(old))if(key.startsWith('draft:')&&original.packageDeletionTimes?.[key.slice(6)])delete old[key];
        merged=mergeBrowser(merged,old);
      }
      const next=assemble(merged,original);await hooks.replace(next);
      const added=next.drafts.length-before;
      message('Recovered '+added+' missing packages from browser safety copies. '+(connected?'Saving to Supabase…':'Browser copy preserved; choose Save this browser copy to cloud.'));
      if(connected)await save(next);
      return added;
    }catch(error){connectionError='Recovery stopped: '+error.message;message(connectionError,true);return false;}
  }
  function assemble(p,local){const out={...local,drafts:[],photoLibrary:{}};for(const [key,value] of Object.entries(p)){if(key.startsWith('draft:'))out.drafts.push(value);else if(key.startsWith('gallery:'))out.photoLibrary[key.slice(8)]=value;else out[key]=value;}return out;}
  async function init(callbacks){
    hooks=callbacks;
    const panel=document.createElement('section');panel.style.cssText='margin:12px;padding:14px;border:2px solid #927b53;border-radius:12px;background:#fff;color:#222';
    panel.innerHTML='<strong>Private cloud saving</strong><p id="crmCloudStatus" role="status">Saved in this browser only. Connect Supabase below.</p><details><summary>Connect or review cloud copies</summary><form id="crmCloudLogin"><p>Work account: justin.neal.chezlesmannequins@gmail.com</p><label>Password <input id="crmCloudPassword" type="password" autocomplete="current-password" required></label> <button type="submit">Sign in</button></form><p id="crmCloudReview"></p><button type="button" id="crmCloudInspect">Check cloud</button> <button type="button" id="crmCloudLoad">Open cloud copy</button> <button type="button" id="crmCloudKeep">Save this browser copy to cloud</button><p>Opening a copy keeps a safety backup of this browser. Saving this browser copy retains earlier cloud versions and cloud-only packages.</p></details>';
    document.body.prepend(panel);
    const recovery=document.createElement('button');recovery.type='button';recovery.id='crmCloudRecover';recovery.textContent='Recover missing browser packages';panel.querySelector('details').append(recovery);recovery.onclick=()=>recoverMissing();
    document.getElementById('crmCloudLogin').onsubmit=async event=>{event.preventDefault();try{message('Signing in to your work account…');check(await client.auth.signInWithPassword({email:'justin.neal.chezlesmannequins@gmail.com',password:document.getElementById('crmCloudPassword').value}));document.getElementById('crmCloudPassword').value='';await connect();}catch(error){connectionError='Sign-in failed: '+error.message;message(connectionError,true)}};
    document.getElementById('crmCloudInspect').onclick=()=>connect();document.getElementById('crmCloudLoad').onclick=()=>connect('cloud');document.getElementById('crmCloudKeep').onclick=()=>connect('browser');
    Object.assign(verifiedMedia,await bounded(loadBaseline('verified-media-v1'),'Verified photo progress',12000).catch(()=>null)||{});
    // Auto-resume only the exact cloud revision this browser last confirmed.
    const session=await bounded(client.auth.getSession(),'Sign-in session',12000);if(session.data?.session?.user?.id===OWNER){
      const remembered=await bounded(loadBaseline(),'Saved cloud revision',12000);if(remembered){try{const remote=check(await client.from('crm_cloud_state').select('version').eq('owner_id',OWNER).single());if(remote.version===remembered.version){version=remote.version;baseline=remembered.parts;connected=true;message('Cloud connected · pending changes sync in the background');return;}}catch{}}
      await connect();
    }
  }
  async function loadBaseline(key='confirmed'){return new Promise(resolve=>{const request=indexedDB.open('clm-cloud-safety',1);request.onupgradeneeded=()=>request.result.createObjectStore('copies');request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result,tx=db.transaction('copies','readonly'),get=tx.objectStore('copies').get(key);get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>resolve(null);tx.oncomplete=()=>db.close()}})}
    // Baselines live in IndexedDB alongside safety copies, never in small localStorage quotas.
  window.CLMCloud={init,save,parts,assemble,canonical,mergeBrowser,connect,recoverMissing,isConnected:()=>connected};
})();
