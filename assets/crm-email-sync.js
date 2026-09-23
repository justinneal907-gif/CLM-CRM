/* CLM CRM sent-mail sync + submitted-package guard · 2026-09-22
   Keeps the static CRM in sync with Work Gmail while the CRM is open.
   Requires one-time Gmail read authorization in addition to the existing compose scope. */
(function(){
  'use strict';
  const SYNC_VERSION='2026-09-23-v2';
  const SYNC_INTERVAL_MS=5*60*1000;
  const GMAIL_SYNC_SCOPE='openid email https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly';
  const KNOWN_IDS_KEY='clm.crm.gmailSentSyncIds.v1';
  let syncTimer=null;
  let syncRunning=false;

  function $sync(sel){return document.querySelector(sel)}
  function norm(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/^\s*(re|fwd):\s*/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function emailList(value){
    return [...new Set((String(value||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(x=>x.toLowerCase()))];
  }
  function draftBrand(d){
    return String(d?.company||d?.brandProject||d?.project||d?.subject||'')
      .replace(/\s+[—–-]\s+(?:Paris|Milan|Milano|New York).*$/i,'').trim();
  }
  function draftSubmissionMatches(d,sub){
    if(!d||!sub)return false;
    if(d.id&&sub.draftId===d.id)return true;
    const ds=norm(d.subject), ss=norm(sub.subject);
    if(ds&&ss&&ds===ss)return true;
    const brand=norm(draftBrand(d));
    const project=norm([sub.project,sub.company,sub.subject].filter(Boolean).join(' '));
    if(brand&&brand.length>=4&&project.includes(brand))return true;
    return false;
  }
  function submissionMatchesForDraft(d){
    const matches=(db?.submissions||[]).filter(s=>draftSubmissionMatches(d,s));
    if(d?.submittedAt||d?.submittedDate){
      const synthetic={date:d.submittedDate||String(d.submittedAt||'').slice(0,10),subject:d.subject||'',email:d.recipientEmail||'',gmailUrl:d.gmailUrl||'',source:'Draft submission marker'};
      if(!matches.some(s=>s.gmailMessageId&&d.gmailMessageId&&s.gmailMessageId===d.gmailMessageId))matches.unshift(synthetic);
    }
    return matches;
  }
  function nyDateFromMs(ms){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Number(ms)||Date.now()));
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  function header(message,name){
    const h=message?.payload?.headers?.find(x=>String(x.name||'').toLowerCase()===name.toLowerCase());
    return h?.value||'';
  }
  function knownIds(){
    try{return new Set(JSON.parse(localStorage.getItem(KNOWN_IDS_KEY)||'[]'))}catch{return new Set()}
  }
  function saveKnownIds(set){
    try{localStorage.setItem(KNOWN_IDS_KEY,JSON.stringify([...set].slice(-800)))}catch{}
  }
  function lastSyncText(){
    const iso=db?.settings?.gmailLastSyncAt;
    if(!iso)return 'Not synced yet';
    try{return new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return iso}
  }
  function renderSyncStatus(){
    const status=$sync('#gmailApiStatus');
    if(!status)return;
    let extra=$sync('#gmailSentSyncStatus');
    if(!extra){
      extra=document.createElement('div');
      extra.id='gmailSentSyncStatus';
      extra.className='tiny muted';
      extra.style.marginTop='5px';
      status.insertAdjacentElement('afterend',extra);
    }
    const connected=typeof gmailAccessToken!=='undefined'&&!!gmailAccessToken&&Date.now()<gmailTokenExpiresAt;
    extra.innerHTML=connected
      ? '<b>Sent-mail sync:</b> active every 5 minutes · last check '+(typeof esc==='function'?esc(lastSyncText()):lastSyncText())
      : '<b>Sent-mail sync:</b> connect Work Gmail to enable automatic submission updates while this CRM is open.';
  }
  async function gmailListSent(token){
    const out=[];
    let pageToken='';
    for(let page=0;page<3;page++){
      const q='in:sent newer_than:45d {subject:"Model Package" subject:"S/S 2027" subject:"SS 2027"}';
      const u=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      u.searchParams.set('maxResults','100');
      u.searchParams.set('q',q);
      if(pageToken)u.searchParams.set('pageToken',pageToken);
      const r=await fetch(u,{headers:{Authorization:'Bearer '+token}});
      if(!r.ok){
        const err=await r.json().catch(()=>({}));
        throw new Error(err?.error?.message||'Could not read sent mail.');
      }
      const j=await r.json();
      out.push(...(j.messages||[]));
      pageToken=j.nextPageToken||'';
      if(!pageToken)break;
    }
    return out;
  }
  async function gmailMessageMeta(token,id){
    const u=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(id));
    u.searchParams.set('format','metadata');
    ['Subject','To','Date'].forEach(x=>u.searchParams.append('metadataHeaders',x));
    const r=await fetch(u,{headers:{Authorization:'Bearer '+token}});
    if(!r.ok)throw new Error('Could not read sent message '+id+'.');
    return await r.json();
  }
  function findDraftForMessage(subject,to,messageId){
    const exactByMessage=messageId?(db?.drafts||[]).find(d=>d.gmailMessageId===messageId):null;
    if(exactByMessage)return exactByMessage;
    const subjectKey=norm(subject);
    const tos=emailList(to);
    let candidates=(db?.drafts||[]).filter(d=>norm(d.subject)===subjectKey);
    if(candidates.length===1)return candidates[0];
    if(candidates.length>1){
      const active=db?.activeDraftId?candidates.find(d=>d.id===db.activeDraftId):null;
      if(active&&emailList(active.recipientEmail).some(e=>tos.includes(e)))return active;
      const byRecipient=candidates.filter(d=>emailList(d.recipientEmail).some(e=>tos.includes(e)));
      if(byRecipient.length)return byRecipient[byRecipient.length-1];
      return candidates[candidates.length-1];
    }
    const brandCandidates=(db?.drafts||[]).filter(d=>{
      const b=norm(draftBrand(d));
      return b&&b.length>=4&&subjectKey.includes(b);
    });
    if(brandCandidates.length===1)return brandCandidates[0];
    const activeBrand=db?.activeDraftId?brandCandidates.find(d=>d.id===db.activeDraftId):null;
    if(activeBrand)return activeBrand;
    const byRecipient=brandCandidates.filter(d=>emailList(d.recipientEmail).some(e=>tos.includes(e)));
    return byRecipient[byRecipient.length-1]||brandCandidates[brandCandidates.length-1]||null;
  }
  function existingSubmissionForMessage(messageId,subject,date,to,draft){
    const subs=db?.submissions||[];
    let hit=subs.find(s=>s.gmailMessageId===messageId);
    if(hit)return hit;

    // Reconcile only records that do not already belong to a different Gmail message.
    // This prevents repeated sends with the same subject/recipient on the same day
    // from overwriting an earlier submission record.
    if(draft?.id){
      hit=subs.find(s=>s.draftId===draft.id&&!s.gmailMessageId&&(!s.date||s.date===date));
      if(hit)return hit;
    }

    const sk=norm(subject), tos=emailList(to);
    hit=subs.find(s=>{
      if(s.gmailMessageId)return false;
      const sameSubject=norm(s.subject)===sk;
      const sameDate=!s.date||s.date===date;
      const se=emailList([s.email,s.recipient].filter(Boolean).join(','));
      const emailOverlap=!se.length||!tos.length||se.some(e=>tos.includes(e));
      return sameSubject&&sameDate&&emailOverlap;
    });
    return hit||null;
  }
  function reconcileSentMessage(meta){
    const messageId=meta.id;
    const subject=header(meta,'Subject');
    if(!/model package|s\/s\s*2027|ss\s*2027/i.test(subject))return false;
    const to=header(meta,'To');
    const date=nyDateFromMs(meta.internalDate);
    const draft=findDraftForMessage(subject,to,messageId);
    const gmailUrl='https://mail.google.com/mail/u/?authuser='+encodeURIComponent(WORK_EMAIL)+'#sent/'+messageId;
    let sub=existingSubmissionForMessage(messageId,subject,date,to,draft);
    let changed=false;
    if(sub){
      const patch={gmailMessageId:messageId,gmailUrl,source:sub.source||'Work Gmail auto-sync'};
      if(draft?.id&&!sub.draftId)patch.draftId=draft.id;
      Object.assign(sub,patch);
      changed=true;
    }else{
      const models=draft?.models?.length?[...draft.models]:(draft?.modelIds||[]).map(id=>db.models.find(m=>m.id===id)?.name).filter(Boolean);
      sub={
        id:'gmail-sent-'+messageId,
        date,
        draftId:draft?.id||'',
        contact:draft?.contactName||'',
        company:draft?.company||draftBrand(draft)||'',
        email:to,
        project:draft?.brandProject||draft?.company||subject,
        models,
        modelIds:[...(draft?.modelIds||[])],
        status:'Submitted',
        subject,
        gmailMessageId:messageId,
        gmailUrl,
        source:'Work Gmail auto-sync'
      };
      db.submissions.push(sub);
      changed=true;
    }
    if(draft){
      draft.submittedAt=draft.submittedAt||new Date(Number(meta.internalDate)||Date.now()).toISOString();
      draft.submittedDate=draft.submittedDate||date;
      draft.gmailMessageId=messageId;
      draft.gmailUrl=gmailUrl;
      draft.submissionStatus='Submitted';
      changed=true;
    }
    return changed;
  }
  async function syncSentMailNow(showStatus=false){
    if(syncRunning)return;
    if(!gmailAccessToken||Date.now()>=gmailTokenExpiresAt){renderSyncStatus();return}
    syncRunning=true;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Checking Work Gmail for sent model packages…');
      const token=gmailAccessToken;
      const list=await gmailListSent(token);
      const known=knownIds();
      let updates=0,checked=0;
      const existingMessageIds=new Set((db?.submissions||[]).map(s=>s.gmailMessageId).filter(Boolean));
      for(const item of list){
        if(!item?.id)continue;
        if(known.has(item.id)&&existingMessageIds.has(item.id))continue;
        const meta=await gmailMessageMeta(token,item.id);
        checked++;
        if(reconcileSentMessage(meta))updates++;
        known.add(item.id);
      }
      saveKnownIds(known);
      db.settings={...(db.settings||{}),gmailLastSyncAt:new Date().toISOString(),gmailSentSyncVersion:SYNC_VERSION};
      if(updates||checked){
        if(typeof save==='function')save();
        else if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      }else if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      renderSyncStatus();
      if(showStatus&&typeof setStatus==='function')setStatus(updates?('Gmail sync updated '+updates+' submission record'+(updates===1?'':'s')+'.'):'Gmail sync is current; no new sent packages found.');
    }catch(err){
      console.error('CLM sent-mail sync failed',err);
      if(showStatus&&typeof setStatus==='function')setStatus('Gmail sync failed: '+(err?.message||err));
      const extra=$sync('#gmailSentSyncStatus');
      if(extra)extra.innerHTML='<b>Sent-mail sync:</b> needs attention · '+(typeof esc==='function'?esc(err?.message||String(err)):String(err));
    }finally{syncRunning=false}
  }
  window.clmSyncSentMail=()=>syncSentMailNow(true);

  function installConnectUpgrade(){
    if(typeof connectWorkGmailApi!=='function'||typeof gmailOAuthClientId!=='function')return;
    connectWorkGmailApi=async function(forcePrompt=true){
      const clientId=gmailOAuthClientId();
      if(!clientId){
        const details=$sync('#gmailApiSetup');if(details)details.open=true;
        $sync('#gmailOAuthClientId')?.focus();
        if(typeof renderGmailApiStatus==='function')renderGmailApiStatus();
        throw new Error('Add your Google OAuth Web Client ID first.');
      }
      await waitForGoogleIdentity();
      return await new Promise((resolve,reject)=>{
        gmailTokenClient=google.accounts.oauth2.initTokenClient({
          client_id:clientId,
          scope:GMAIL_SYNC_SCOPE,
          hint:WORK_EMAIL,
          callback:async response=>{
            if(response?.error){reject(new Error(response.error_description||response.error));return}
            try{
              const token=response.access_token;
              const email=await verifyGmailApiAccount(token);
              gmailAccessToken=token;
              gmailTokenExpiresAt=Date.now()+Math.max(60,Number(response.expires_in||3600)-60)*1000;
              gmailConnectedEmail=email;
              if(typeof renderGmailApiStatus==='function')renderGmailApiStatus();
              renderSyncStatus();
              if(typeof setStatus==='function')setStatus('Work Gmail connected. Draft creation and automatic sent-mail sync are active.');
              setTimeout(()=>syncSentMailNow(true),250);
              resolve(token);
            }catch(err){reject(err)}
          },
          error_callback:error=>reject(new Error(error?.message||error?.type||'Google authorization was cancelled.'))
        });
        gmailTokenClient.requestAccessToken({prompt:forcePrompt?'consent':''});
      });
    };
  }
  function installStatusUpgrade(){
    if(typeof renderGmailApiStatus!=='function')return;
    const original=renderGmailApiStatus;
    renderGmailApiStatus=function(){original();renderSyncStatus()};
  }
  function installDraftGuard(){
    if(typeof loadDraft!=='function')return;
    const originalLoad=loadDraft;
    loadDraft=function(id){
      const d=(db?.drafts||[]).find(x=>x.id===id);
      const matches=submissionMatchesForDraft(d);
      if(d&&matches.length){
        const latest=matches.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||{};
        const label=d.brandProject||d.company||d.subject||'This package';
        const detail=[latest.date,latest.email||latest.recipient].filter(Boolean).join(' · ');
        const okay=window.confirm(label+' has already been submitted'+(detail?' ('+detail+')':'')+'.\n\nOpen the package anyway?');
        if(!okay)return;
      }
      originalLoad(id);
      setTimeout(renderSubmittedWarning,0);
    };
    if(typeof renderDraftScope==='function'){
      const originalScope=renderDraftScope;
      renderDraftScope=function(){originalScope();setTimeout(renderSubmittedWarning,0)};
    }
  }
  function renderSubmittedWarning(){
    const active=db?.activeDraftId?(db.drafts||[]).find(x=>x.id===db.activeDraftId):null;
    let warning=$sync('#submittedDraftWarning');
    if(!active){warning?.remove();return}
    const matches=submissionMatchesForDraft(active);
    if(!matches.length){warning?.remove();return}
    const latest=matches.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||{};
    const scope=$sync('#draftScopeBanner');
    if(!scope)return;
    if(!warning){
      warning=document.createElement('div');
      warning.id='submittedDraftWarning';
      warning.className='warning';
      warning.style.marginTop='10px';
      scope.appendChild(warning);
    }
    const gmail=latest.gmailUrl?'<a href="'+latest.gmailUrl+'" target="_blank" rel="noopener">Open sent email</a>':'';
    warning.innerHTML='<b>Already submitted.</b> This package matches a sent/recorded submission'+
      (latest.date?' from '+latest.date:'')+
      (latest.email?' to '+(typeof esc==='function'?esc(latest.email):latest.email):'')+
      (gmail?' · '+gmail:'')+'.';
  }
  function installManualSyncButton(){
    const panel=$sync('#gmailApiPanel .actions');
    if(!panel||$sync('#syncGmailNowBtn'))return;
    const btn=document.createElement('button');
    btn.className='btn';btn.type='button';btn.id='syncGmailNowBtn';btn.textContent='Sync sent mail now';
    btn.addEventListener('click',()=>syncSentMailNow(true));
    panel.appendChild(btn);
  }
  function startTimer(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(()=>{if(gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncSentMailNow(false)},SYNC_INTERVAL_MS);
  }
  function init(){
    try{
      installConnectUpgrade();
      installStatusUpgrade();
      installDraftGuard();
      installManualSyncButton();
      startTimer();
      renderSyncStatus();
      setTimeout(()=>{if(gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncSentMailNow(false)},1500);
    }catch(err){console.error('CLM email sync add-on failed to initialize',err)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();