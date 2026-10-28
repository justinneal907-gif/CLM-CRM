/* CLM CRM private cloud saving.
 *
 * The browser copy in IndexedDB stays the working copy. This module mirrors it
 * to the agency's private Supabase project so every browser that signs in sees
 * the same packages.
 *
 * Safety rules:
 *  - Syncing only ever adds or updates. A package missing from one side is
 *    never treated as deleted; only an explicit deletion marker removes one.
 *  - When both sides have the same package, the most recently edited copy wins;
 *    on a tie the browser copy wins.
 *  - Every cloud commit keeps the previous version of each changed part in
 *    crm_cloud_history, so nothing pushed can be lost.
 *  - A cloud failure never blocks the editor or the local save.
 */
(function(){
  'use strict';
  const URL_='https://coipdgmfuervnuqnfiud.supabase.co';
  const KEY='sb_publishable_-3GGsWtASGt6dyTet6TWjg_CoZf7Xqs';
  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  const LOCAL_ONLY=new Set(['draft','selected','activeDraftId','workspaceSavedAt','_cloudAcceptedAt']);
  const SPLIT_BYTES=900*1024;      // values bigger than this are stored as several parts
  const BATCH_BYTES=1500*1024;     // largest single commit request
  const PUSH_DELAY=8000;
  const LS='clm.cloud.sync.v1';

  let client=null,user=null,busy=false,pushTimer=0,pendingPush=false,lastError='',lastSync=0,ready=false;

  // ---------- small helpers ----------
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)+':'+str.length}
  function syncState(){try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch{return {}}}
  function setSyncState(s){try{localStorage.setItem(LS,JSON.stringify(s))}catch{}}
  function mine(){const s=syncState();return s.owner===user?.id?s:{owner:user?.id,version:0,hashes:{}}}
  function draftTime(d,restores){return Math.max(Date.parse(d?.lastEditedAt||d?.recoveryStoredAt||d?.savedAt||'')||0,restores?.[d?.id]||0)}
  function isPlain(v){return v&&typeof v==='object'&&!Array.isArray(v)}
  function getDb(){try{return db}catch{return null}}           // eslint-disable-line no-undef
  function setDb(v){db=v}                                      // eslint-disable-line no-undef

  // ---------- workspace <-> parts ----------
  function toParts(ws){
    const parts={};
    for(const [k,v] of Object.entries(ws||{})){
      if(LOCAL_ONLY.has(k))continue;
      if(k==='drafts'){for(const d of v||[])if(d&&d.id)parts['pkg:'+d.id]=d;continue}
      const json=JSON.stringify(v??null);
      if(isPlain(v)&&json.length>SPLIT_BYTES){
        parts['wsmeta:'+k]={split:true,keys:Object.keys(v)};
        for(const [sk,sv] of Object.entries(v))parts['wss:'+k+':'+sk]=sv;
      }else parts['ws:'+k]=v??null;
    }
    return parts;
  }
  function fromParts(rows){
    const ws={drafts:[]},split={};
    for(const {part_key:k,data} of rows){
      if(k.startsWith('pkg:'))ws.drafts.push(data);
      else if(k.startsWith('ws:'))ws[k.slice(3)]=data;
      else if(k.startsWith('wsmeta:'))split[k.slice(7)]=split[k.slice(7)]||{};
      else if(k.startsWith('wss:')){const rest=k.slice(4),i=rest.indexOf(':');const key=rest.slice(0,i);(split[key]=split[key]||{})[rest.slice(i+1)]=data}
    }
    for(const [k,v] of Object.entries(split))ws[k]=v;
    return ws;
  }

  // ---------- merge: union, never drop ----------
  function mergeValue(local,cloud){
    if(local===undefined||local===null||(Array.isArray(local)&&!local.length)||(isPlain(local)&&!Object.keys(local).length))return cloud===undefined?local:structuredClone(cloud);
    if(cloud===undefined||cloud===null)return local;
    if(Array.isArray(local)&&Array.isArray(cloud)){
      const keyed=a=>a.every(x=>isPlain(x)&&x.id!=null);
      if(keyed(local)&&keyed(cloud)){const ids=new Set(local.map(x=>String(x.id)));return [...local,...cloud.filter(x=>!ids.has(String(x.id))).map(x=>structuredClone(x))]}
      return local;
    }
    if(isPlain(local)&&isPlain(cloud))return {...structuredClone(cloud),...local};
    return local;
  }
  function merge(local,cloud){
    const out={...local};
    const dels={...(cloud.packageDeletionTimes||{})};
    for(const [id,t] of Object.entries(local.packageDeletionTimes||{}))dels[id]=Math.max(dels[id]||0,t);
    const restores={...(cloud.packageRestoreTimes||{})};
    for(const [id,t] of Object.entries(local.packageRestoreTimes||{}))restores[id]=Math.max(restores[id]||0,t);
    const byId=new Map();
    for(const d of local.drafts||[])byId.set(d.id,d);
    let added=0,updated=0;
    for(const d of cloud.drafts||[]){
      if(!d||!d.id)continue;
      const cur=byId.get(d.id);
      if(!cur){byId.set(d.id,d);added++}
      else if(draftTime(d,restores)>draftTime(cur,restores)){byId.set(d.id,d);updated++}
    }
    let removed=0;
    for(const [id,d] of byId)if(dels[id]&&dels[id]>=draftTime(d,restores)){byId.delete(id);removed++}
    for(const k of new Set([...Object.keys(local),...Object.keys(cloud)])){
      if(k==='drafts'||k==='packageDeletionTimes'||k==='packageRestoreTimes'||LOCAL_ONLY.has(k))continue;
      out[k]=mergeValue(local[k],cloud[k]);
    }
    // Keep the browser's own package order, then append packages new to it.
    const order=(local.drafts||[]).map(d=>d.id).filter(id=>byId.has(id));
    const seen=new Set(order);
    for(const id of byId.keys())if(!seen.has(id))order.push(id);
    out.drafts=order.map(id=>byId.get(id));
    out.packageDeletionTimes=dels;out.packageRestoreTimes=restores;
    if(out.activeDraftId&&!byId.has(out.activeDraftId))out.activeDraftId='';
    return {workspace:out,added,updated,removed};
  }

  // ---------- Supabase ----------
  function loadSdk(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((res,rej)=>{const s=document.createElement('script');s.src=SDK;s.onload=res;s.onerror=()=>rej(new Error('Could not load the cloud library.'));document.head.appendChild(s)});
  }
  async function getClient(){
    if(client)return client;
    await loadSdk();
    client=window.supabase.createClient(URL_,KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'clm-crm-cloud-auth'}});
    client.auth.onAuthStateChange((_e,session)=>{user=session?.user||null;render()});
    const {data}=await client.auth.getSession();user=data.session?.user||null;
    return client;
  }
  async function cloudVersion(){
    const {data,error}=await client.from('crm_cloud_state').select('version').eq('owner_id',user.id).maybeSingle();
    if(error)throw error;return data?.version||0;
  }
  async function pullRows(){
    const rows=[];const page=200;
    for(let from=0;;from+=page){
      const {data,error}=await client.from('crm_cloud_parts').select('part_key,data').eq('owner_id',user.id).order('part_key').range(from,from+page-1);
      if(error)throw error;rows.push(...data);if(data.length<page)break;
    }
    return rows;
  }
  async function commit(parts,expected){
    const {data,error}=await client.rpc('crm_commit',{p_expected:expected,p_parts:parts});
    if(error)throw error;return Number(data);
  }

  // ---------- sync ----------
  async function pullAndMerge(){
    const local=getDb();if(!local)return null;
    const rows=await pullRows();
    const version=await cloudVersion();
    if(!rows.length)return {version,added:0,updated:0,removed:0};
    const cloud=fromParts(rows);
    const r=merge(local,cloud);
    const changed=r.added||r.updated||r.removed||JSON.stringify(Object.keys(r.workspace).sort())!==JSON.stringify(Object.keys(local).sort());
    if(changed){
      setDb(r.workspace);
      try{if(typeof hydrateDraft==='function')hydrateDraft()}catch{}
      try{if(typeof save==='function')save()}catch(err){console.warn('Cloud merge local save failed',err)}
    }
    // Everything in the cloud is now in this browser, so mark it as known.
    const st=mine();st.version=version;const cloudParts={};for(const {part_key,data} of rows)cloudParts[part_key]=hash(JSON.stringify(data));
    st.hashes={...cloudParts};setSyncState(st);
    return {version,...r};
  }
  async function push(){
    const local=getDb();if(!local)return 0;
    const parts=toParts(local);const st=mine();
    const changed=Object.entries(parts).filter(([k,v])=>st.hashes[k]!==hash(JSON.stringify(v)));
    if(!changed.length)return 0;
    let batch={},bytes=0,sent=0;
    const flush=async()=>{
      if(!Object.keys(batch).length)return;
      st.version=await commit(batch,st.version);
      for(const [k,v] of Object.entries(batch))st.hashes[k]=hash(JSON.stringify(v));
      setSyncState(st);sent+=Object.keys(batch).length;batch={};bytes=0;
      status('Saving to cloud… '+sent+' of '+changed.length);
    };
    for(const [k,v] of changed){
      const size=JSON.stringify(v).length;
      if(bytes&&bytes+size>BATCH_BYTES)await flush();
      batch[k]=v;bytes+=size;
    }
    await flush();
    return sent;
  }
  async function sync(reason){
    if(!user||!ready)return;
    if(busy){pendingPush=true;return}
    busy=true;lastError='';
    try{
      status(reason==='start'?'Checking the cloud copy…':'Saving to cloud…');
      const st=mine();
      let remote=await cloudVersion();
      let merged=null;
      if(reason==='start'||remote!==st.version)merged=await pullAndMerge();
      try{await push()}
      catch(err){
        if(!/CRM_CONFLICT/.test(err.message||''))throw err;
        merged=await pullAndMerge();await push();
      }
      lastSync=Date.now();
      const n=getDb()?.drafts?.length||0;
      status('Saved to cloud · '+n+' packages'+(merged&&(merged.added||merged.updated)?' · '+merged.added+' added from the cloud'+(merged.updated?', '+merged.updated+' updated':''):''));
      if(merged&&(merged.added||merged.updated||merged.removed))try{renderAll()}catch{}
    }catch(err){
      lastError=err.message||String(err);
      console.error('Cloud save failed',err);
      status('Cloud save failed: '+lastError+' · Your browser copy is safe.',true);
    }finally{
      busy=false;
      if(pendingPush){pendingPush=false;schedule()}
    }
  }
  function schedule(){if(!user)return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>sync('change'),PUSH_DELAY)}

  // Every successful browser save schedules a cloud save.
  function hookLocalSaves(){
    try{
      const original=writeIndexedDBSnapshotNow;                 // eslint-disable-line no-undef
      if(original.__cloudHooked)return;
      const wrapped=async function(...args){const ok=await original.apply(this,args);if(ok)schedule();return ok};
      wrapped.__cloudHooked=true;
      writeIndexedDBSnapshotNow=wrapped;                        // eslint-disable-line no-undef
    }catch(err){console.warn('Cloud save hook unavailable',err)}
  }

  // ---------- panel ----------
  let statusText='',statusBad=false;
  function status(t,bad=false){statusText=t;statusBad=bad;render()}
  function render(){
    let box=$('#clmCloudPanel');
    if(!box){
      box=document.createElement('div');box.id='clmCloudPanel';
      box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;background:#fff;border:1px solid #cfd6d1;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:10px 12px;font:13px Arial,sans-serif;color:#1d2521;max-width:320px';
      document.body.appendChild(box);
    }
    if(!user){
      box.innerHTML=`<details${lastError?' open':''}><summary style="cursor:pointer;font-weight:700">☁ Cloud saving is off</summary>
        <form id="clmCloudForm" style="margin-top:8px;display:grid;gap:6px">
        <input id="clmCloudEmail" type="email" placeholder="Work email" autocomplete="username" required style="padding:7px;border:1px solid #cfd6d1;border-radius:7px">
        <input id="clmCloudPass" type="password" placeholder="Password" autocomplete="current-password" required style="padding:7px;border:1px solid #cfd6d1;border-radius:7px">
        <button type="submit" style="padding:8px;border:0;border-radius:7px;background:#1f2923;color:#fff;font-weight:700;cursor:pointer">Sign in and save this browser copy to cloud</button>
        <div class="muted" style="font-size:12px;color:#5c6660">Your packages are added to the cloud. Nothing in this browser is removed.</div>
        ${lastError?`<div style="color:#a22c25">${esc(lastError)}</div>`:''}</form></details>`;
      $('#clmCloudForm').onsubmit=async e=>{
        e.preventDefault();lastError='';
        try{
          await getClient();
          const {data,error}=await client.auth.signInWithPassword({email:$('#clmCloudEmail').value.trim(),password:$('#clmCloudPass').value});
          if(error)throw error;user=data.user;sync('start');
        }catch(err){lastError=err.message||String(err);render()}
      };
      return;
    }
    box.innerHTML=`<div style="font-weight:700">☁ Cloud saving on</div>
      <div style="margin:4px 0;color:${statusBad?'#a22c25':'#3c4640'}">${esc(statusText||'Ready')}</div>
      <div style="font-size:12px;color:#5c6660">${esc(user.email||'')}${lastSync?' · last saved '+new Date(lastSync).toLocaleTimeString():''}</div>
      <div style="margin-top:6px;display:flex;gap:6px"><button id="clmCloudNow" style="padding:6px 10px;border:1px solid #cfd6d1;border-radius:7px;background:#fff;cursor:pointer">Save now</button>
      <button id="clmCloudOut" style="padding:6px 10px;border:1px solid #cfd6d1;border-radius:7px;background:#fff;cursor:pointer">Sign out</button></div>`;
    $('#clmCloudNow').onclick=()=>sync('start');
    $('#clmCloudOut').onclick=async()=>{await client.auth.signOut();user=null;statusText='';render()};
  }

  async function start(){
    ready=true;hookLocalSaves();
    try{await getClient()}catch(err){lastError=err.message;console.warn(err)}
    render();
    if(user)sync('start');
  }
  window.CLMCloud={sync:()=>sync('start'),merge,toParts,fromParts,status:()=>({user:user?.email||null,statusText,lastError,lastSync})};
  if(window.__clmWorkspaceReady)start();
  else window.addEventListener('clm:workspace-ready',start,{once:true});
})();
