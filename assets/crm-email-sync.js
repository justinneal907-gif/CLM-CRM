/* CLM CRM sent-mail sync + submitted-package guard · 2026-09-22
   Keeps the static CRM in sync with Work Gmail while the CRM is open.
   Requires one-time Gmail read authorization in addition to the existing compose scope. */
(function(){
  'use strict';
  if(window.__clmEmailSyncLoaded)return;
  window.__clmEmailSyncLoaded=true;
  const SYNC_VERSION='2026-09-25-v5';
  const SYNC_INTERVAL_MS=15*60*1000;
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
  function draftRecipientEmails(d){
    if(!d)return [];
    const contact=d.contactId?(db?.contacts||[]).find(c=>c.id===d.contactId):null;
    return emailList([d.recipientEmail,contact?.email].filter(Boolean).join(','));
  }
  function submissionRecipientEmails(sub){
    return emailList([sub?.email,sub?.recipient].filter(Boolean).join(','));
  }
  function sameCastingRecipient(d,sub){
    const draftEmails=draftRecipientEmails(d);
    const sentEmails=submissionRecipientEmails(sub);
    if(draftEmails.length&&sentEmails.length)return draftEmails.some(e=>sentEmails.includes(e));

    // Email is the canonical match. Only fall back to a contact name when
    // neither side has an address, so a shared template cannot create a false repeat.
    if(draftEmails.length||sentEmails.length)return false;
    const contact=d?.contactId?(db?.contacts||[]).find(c=>c.id===d.contactId):null;
    const draftName=norm(d?.contactName||contact?.name||'');
    const sentName=norm(sub?.contact||'');
    return !!draftName&&!!sentName&&draftName===sentName;
  }
  function draftPackageKey(d){
    return norm(d?.brandProject||d?.project||d?.subject||'');
  }
  function submissionPackageKey(sub){
    return norm(sub?.project||sub?.subject||'');
  }
  function draftSubmissionMatches(d,sub){
    if(!d||!sub||!sameCastingRecipient(d,sub))return false;

    // The notification is about this exact package to this exact casting route.
    // Never infer a repeat from shared models, body copy, season templates or brand-only overlap.
    if(d.id&&sub.draftId===d.id)return true;
    if(d.gmailMessageId&&sub.gmailMessageId&&d.gmailMessageId===sub.gmailMessageId)return true;

    const ds=norm(d.subject),ss=norm(sub.subject);
    if(!ds||!ss||ds!==ss)return false;

    const dk=draftPackageKey(d),sk=submissionPackageKey(sub);
    if(dk&&sk&&dk!==sk)return false;
    return true;
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
      const options={headers:{Authorization:'Bearer '+token}};
      const r=window.CLMGmailThrottle?.fetch
        ?await window.CLMGmailThrottle.fetch(u.toString(),options,{retryRateLimit:true,maxRetries:2})
        :await fetch(u,options);
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
    ['Subject','To','Date','X-CLM-Tracking-ID','X-CLM-Tracking-State','X-CLM-Signal-ID'].forEach(x=>u.searchParams.append('metadataHeaders',x));
    const options={headers:{Authorization:'Bearer '+token}};
    const r=window.CLMGmailThrottle?.fetch
      ?await window.CLMGmailThrottle.fetch(u.toString(),options,{retryRateLimit:true,maxRetries:2})
      :await fetch(u,options);
    if(!r.ok){
      const err=await r.json().catch(()=>({}));
      throw new Error(err?.error?.message||('Could not read sent message '+id+'.'));
    }
    return await r.json();
  }
  function findDraftForMessage(subject,to,messageId){
    const exactByMessage=messageId?(db?.drafts||[]).find(d=>d.gmailMessageId===messageId):null;
    if(exactByMessage)return exactByMessage;
    const subjectKey=norm(subject);
    const tos=emailList(to);
    if(!tos.length)return null;

    const sameRecipient=draft=>draftRecipientEmails(d).some(e=>tos.includes(e));
    let candidates=(db?.drafts||[]).filter(d=>norm(d.subject)===subjectKey&&sameRecipient(d));
    if(candidates.length){
      const active=db?.activeDraftId?candidates.find(d=>d.id===db.activeDraftId):null;
      return active||candidates[candidates.length-1];
    }

    const brandCandidates=(db?.drafts||[]).filter(d=>{
      if(!sameRecipient(d))return false;
      const b=norm(draftBrand(d));
      return b&&b.length>=4&&subjectKey.includes(b);
    });
    if(!brandCandidates.length)return null;
    const activeBrand=db?.activeDraftId?brandCandidates.find(d=>d.id===db.activeDraftId):null;
    return activeBrand||brandCandidates[brandCandidates.length-1];
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
    const trackingId=header(meta,'X-CLM-Tracking-ID');
    const tracked=header(meta,'X-CLM-Tracking-State')==='armed'&&/^[a-f0-9]{20,}$/.test(trackingId);
    const exactTracked=tracked?(db.drafts||[]).find(d=>d.openTrackingId===trackingId):null;
    const draft=exactTracked||findDraftForMessage(subject,to,messageId);
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
    if(tracked){
      const patch={openTrackingId:trackingId,openTrackingState:'armed',openTrackingArmedAt:new Date(Number(meta.internalDate)||Date.now()).toISOString()};
      Object.assign(sub,patch);
      if(exactTracked){
        Object.assign(exactTracked,patch,{gmailDraftId:''});
        if(db.activeDraftId===exactTracked.id)Object.assign(db.draft,patch,{gmailDraftId:'',gmailMessageId:messageId,gmailUrl});
      }
    }
    if(draft&&(!draft.gmailMessageId||draft.gmailMessageId===messageId||!draft.submittedAt||Number(meta.internalDate)>=Date.parse(draft.submittedAt))){
      draft.submittedAt=draft.submittedAt||new Date(Number(meta.internalDate)||Date.now()).toISOString();
      draft.submittedDate=draft.submittedDate||date;
      draft.gmailMessageId=messageId;
      draft.gmailUrl=gmailUrl;
      draft.submissionStatus='Submitted';
      changed=true;
    }
    const modelSignalId=header(meta,'X-CLM-Signal-ID');
    try{if(/^[a-f0-9]{32}$/.test(modelSignalId)&&typeof window.clmMarkModelSignalSent==='function')
      window.clmMarkModelSignalSent({modelSignalSubmissionId:modelSignalId,submittedAt:new Date(Number(meta.internalDate)||Date.now()).toISOString()},sub)}catch(err){console.warn('Model-signal update failed; sent-mail sync continues.',err)}
    return changed;
  }
  async function syncSentMailNow(showStatus=false){
    if(syncRunning)return;
    syncRunning=true;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Checking Work Gmail for sent model packages…');
      let token='';
      try{token=await gmailToken()}catch(err){
        renderSyncStatus();
        if(showStatus&&typeof setStatus==='function')setStatus('Reconnect Work Gmail to sync sent mail.');
        return;
      }
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
    // Canonical Gmail authorization now lives in index.html.
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
    if(!panel)return;
    let btn=$sync('#syncGmailNowBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.className='btn';btn.type='button';btn.id='syncGmailNowBtn';btn.textContent='Sync sent mail now';
      panel.appendChild(btn);
    }
    if(btn.dataset.clmBound==='1')return;
    btn.dataset.clmBound='1';
    btn.addEventListener('click',()=>syncSentMailNow(true));
  }
  function autoSyncAllowed(){
    const governor=window.CLMGmailThrottle;
    if(governor?.remainingCooldownMs?.()>0)return false;
    return governor?.claimBackground?governor.claimBackground('sent-sync',SYNC_INTERVAL_MS):true;
  }
  function startTimer(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(()=>{if(gmailAccessToken&&Date.now()<gmailTokenExpiresAt&&autoSyncAllowed())syncSentMailNow(false)},SYNC_INTERVAL_MS);
    window.addEventListener('clm:gmail-connected',()=>setTimeout(()=>{if(autoSyncAllowed())syncSentMailNow(false)},4000));
  }
  function init(){
    try{
      installConnectUpgrade();
      installStatusUpgrade();
      installDraftGuard();
      installManualSyncButton();
      startTimer();
      renderSyncStatus();
      setTimeout(()=>{if(gmailAccessToken&&Date.now()<gmailTokenExpiresAt&&autoSyncAllowed())syncSentMailNow(false)},8000);
    }catch(err){console.error('CLM email sync add-on failed to initialize',err)}
  }
  function initWhenReady(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db&&$sync('#gmailApiPanel')){
      init();
      return;
    }
    if(attempt<100)setTimeout(()=>initWhenReady(attempt+1),100);
    else console.error('CLM email sync could not find a ready CRM workspace.');
  }
  initWhenReady(0);
})();

/* PFW MALIA + REINE AVAILABILITY FOLLOW-UPS · 2026-09-24
   One-time workspace migration built from actual Work Gmail Paris S/S 2027 submissions.
   Each route gets its own saved follow-up so open tracking remains recipient-specific
   when sent with the CRM's "Send tracked draft" action. */
(function(){
  'use strict';
  const VERSION=3;
  const RECOVERY_KEY='pfwMaliaReineAvailabilitySeedVersion';
  const SUBJECT='Paris S/S 2027 Malia + Reine Availability';
  const MODEL_IDS=['los-angeles-women-malia','london-main-reine'];
  const MODEL_NAMES=['Malia','Reine'];
  const BODY="A quick availability update for Paris. Malia and Reine are both available as well. I wanted to put them on your radar for any remaining shows you're casting. Their materials are below.";

  // Dedupe is by casting person / working route, not by show. Julia Lange is intentionally
  // routed to her direct address rather than the older Art Partner inbox used for Hermès/Lacoste.
  const ROUTES=[
    {key:'nico-mao',name:'Nico Mao',company:'Midland',email:'nico@midland.agency',shows:['Carven']},
    {key:'julia-lange',name:'Julia Lange',company:'Julia Lange Casting',email:'julia.lange@me.com',shows:['Balmain','Courrèges','Stella McCartney','Lanvin','Hermès','Lacoste']},
    {key:'ben-grimes',name:'Ben Grimes',company:'Ben Grimes Casting',email:'studio@bengrimescasting.com',shows:['Victoria Beckham','Ann Demeulemeester']},
    {key:'birgitta-streeters',name:'Birgitta',company:'Streeters — Jess Hallett casting route',email:'birgitta@streeters.com',shows:['Givenchy','Gabriela Hearst'],routeNote:'Representative/shared route used in prior submissions.'},
    {key:'nicolas-bianciotto',name:'Nicolas Bianciotto',company:'IKKI Casting',email:'nicolas@ikkicasting.com',shows:['Christopher Esber']},
    {key:'simone-schofer',name:'Simone Schofer',company:'Simone Schofer Casting',email:'info@simoneschofer.com',shows:['Casablanca','Situationist','Niccolò Pasqualetti']},
    {key:'andrea-prato',name:'Andrea Prato',company:'AND Casting',email:'andrea@andcasting.co',shows:['Alainpaul']},
    {key:'daniel-von-der-graf',name:'Daniel von der Graf',company:'AND Casting',email:'daniel@andcasting.co',shows:['Alainpaul']},
    {key:'piergiorgio-del-moro',name:'Piergiorgio Del Moro',company:'DM Fashion Studio',email:'pg@dmfashionstudio.com',shows:['Balenciaga','Dries Van Noten','Acne Studios']},
    {key:'alejandra-perez',name:'Alejandra Perez',company:'DMCASTING',email:'alejandra@dmcasting.com',shows:['Balenciaga']},
    {key:'evagria-sergeeva',name:'Evagria Sergeeva',company:'DMCASTING',email:'evagria@dmcasting.com',shows:['Balenciaga']},
    {key:'ashley-brokaw',name:'Ashley Brokaw',company:'Ashley Brokaw Casting',email:'ashleybrokaw@me.com',shows:['Miu Miu','Loewe','The Row']},
    {key:'minaho-smn',name:'Minaho',company:'SMN Casting',email:'minaho@smncasting.com',shows:['Ujoh']},
    {key:'rachel-chandler',name:'Rachel Chandler',company:'Midland',email:'contact@midland.agency',shows:['Mugler','Valentino','Vaquera'],routeNote:'Shared Midland route used in prior submissions.'},
    {key:'jane-morineau',name:'Jane Morineau',company:'Jane Morineau Casting',email:'casting@janemorineau.com',shows:['Valentino','Vaquera']},
    {key:'mathilde-curel',name:'Mathilde Curel',company:'JL Casting',email:'mathilde@jl-casting.com',shows:['Courrèges']},
    {key:'sivan-currie',name:'Sivan Currie',company:'Independent Casting',email:'sivan.currie@gmail.com',shows:['Stella McCartney']},
    {key:'regina-limon-vega',name:'Regina Limon Vega',company:'The Casting Agency / DMCASTING',email:'regina@thecastingagency.com',shows:['Jean Paul Gaultier','Sacai']},
    {key:'rosie-vogel',name:'Rosie Vogel',company:'Rosie Vogel Casting',email:'rosie@rosievogelcasting.com',shows:['Elie Saab']},
    {key:'vivienne-westwood-streeters',name:'Casey',company:'Streeters — Liz Goldson casting route',email:'casey@streeters.com',shows:['Vivienne Westwood'],routeNote:'Representative route used in the prior submission; Liz Goldson is the casting credit retained in CRM research.'},
    {key:'william-lhoest',name:'William Lhoest',company:'WL Casting',email:'info@wl-casting.com',shows:['CFCL']},
    {key:'anita-bitton',name:'Anita Bitton',company:'Establishment Casting',email:'anita@establishmentnewyork.com',shows:['Zimmermann','Chanel']},
    {key:'samuel-ellis-scheinman',name:'Samuel Ellis Scheinman',company:'DM Fashion Studio',email:'samuele@dmfashionstudio.com',shows:['Saint Laurent','Celine']},
    {key:'leila-azizi',name:'Leila Azizi',company:'SUUN Consultancy',email:'sayhi@suunconsultancy.com',shows:['Burc Akyol']},
    {key:'je-suis-casting',name:'Franziska and Liv',company:'Je Suis Casting',email:'info@jesuiscasting.com',shows:['Ottolinger'],routeNote:'Shared casting inbox for Franziska Bachofen-Echt / Liv Tendlarz.'},
    {key:'caterina-matteucci',name:'Caterina Matteucci',company:'CM Casting',email:'caterina@cmcasting.it',shows:['Schiaparelli']},
    {key:'sophie-trouble',name:'Sophie',company:'Trouble Management / Rick Owens casting route',email:'sophie@trouble.management',shows:['Rick Owens'],routeNote:'Working route used in the prior Rick Owens submission.'}
  ];

  function byEmail(email){
    const key=String(email||'').trim().toLowerCase();
    return (db.contacts||[]).find(c=>String(c.email||'').trim().toLowerCase()===key)||null;
  }
  function ensureContact(route){
    const existing=byEmail(route.email);
    if(existing)return existing.id;
    const id='pfw-contact-'+route.key;
    db.contacts=db.contacts||[];
    db.contacts.push({
      id,
      name:route.name,
      company:route.company,
      email:route.email,
      relationship:'Developing',
      preferredNiches:'High Fashion / Editorial, Luxury / Runway',
      notes:'Paris S/S 2027 sent-submission route · '+route.shows.join(', ')+(route.routeNote?' · '+route.routeNote:'')
    });
    return id;
  }
  function draftId(route){return 'pfw-malia-reine-'+route.key+'-2026-09-24'}
  function seed(){
    try{
      if(typeof db==='undefined'||!db||!window.__clmWorkspaceReady)return false;
      db.recovery=db.recovery||{};
      if(Number(db.recovery[RECOVERY_KEY]||0)>=VERSION)return true;
      const found=MODEL_IDS.filter(id=>(db.models||[]).some(m=>m.id===id));
      if(found.length!==MODEL_IDS.length){
        console.warn('PFW Malia/Reine follow-up seed skipped because both roster IDs are not available.',found);
        return false;
      }
      db.drafts=db.drafts||[];
      let added=0;
      for(const route of ROUTES){
        const id=draftId(route);
        const contactId=ensureContact(route);
        const existing=db.drafts.find(d=>d.id===id);
        const draftPatch={
          date:'2026-09-24',
          purpose:'followup',
          contactId,
          contactName:route.name,
          company:route.company,
          recipientEmail:route.email,
          brandProject:'Paris Fashion Week S/S 2027',
          packageLink:'',
          brief:'',
          customBody:BODY,
          signatureClose:'Thank you,',
          notes:'Tracked Paris availability follow-up · prior Paris submissions: '+route.shows.join(', ')+(route.routeNote?' · '+route.routeNote:'')+' · Use Send tracked draft so opens remain tied to this recipient.',
          castingBriefRaw:'',
          parsedBrief:{project:'Paris Fashion Week S/S 2027',location:'Paris',nicheClues:['High Fashion / Editorial','Luxury / Runway']},
          subject:SUBJECT,
          includeStats:true,
          includePhotos:true,
          includeSources:true,
          models:[...MODEL_NAMES],
          modelIds:[...MODEL_IDS],
          html:'',
          source:'Work Gmail Paris S/S 2027 sent-submission history through 2026-09-22 · availability follow-up updated 2026-09-24'
        };
        if(existing)Object.assign(existing,draftPatch);
        else{db.drafts.push({id,...draftPatch});added++}
      }
      db.recovery[RECOVERY_KEY]=VERSION;
      db.recovery.pfwMaliaReineAvailabilitySeededOn='2026-09-24';
      db.recovery.pfwMaliaReineAvailabilityDraftCount=ROUTES.length;
      db.recovery.pfwMaliaReineAvailabilityRecipients=ROUTES.map(r=>({name:r.name,email:r.email,shows:[...r.shows]}));
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      if(added&&typeof setStatus==='function')setStatus('Added '+added+' tracked Paris availability follow-up'+(added===1?'':'s')+' for Malia + Reine.');
      return true;
    }catch(err){
      console.error('PFW Malia/Reine follow-up seed failed',err);
      return false;
    }
  }
  function start(){
    if(window.__clmWorkspaceReady){seed();return}
    window.addEventListener('clm:workspace-ready',()=>setTimeout(seed,0),{once:true});
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(window.__clmWorkspaceReady&&seed()){clearInterval(timer);return}
      if(tries>100)clearInterval(timer);
    },100);
  }
  start();
})();


/* PARIS PACKAGES · MOLLY REMOVAL · 2026-09-25 */
(function(){
  'use strict';
  if(window.__clmParisMollyRemovalLoaded)return;
  window.__clmParisMollyRemovalLoaded=true;

  const BLOCKED_IDS=new Set([
    'new-york-women-molly-gardiner',
    'london-women-molly-gardiner',
    'milan-women-molly-gardiner'
  ]);

  function norm(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  function blocked(value){
    const id=typeof value==='object'?value&&value.id:value;
    if(BLOCKED_IDS.has(String(id||'')))return true;
    let name='';
    if(typeof value==='object')name=value&&value.name||'';
    else if(typeof db!=='undefined'&&db&&Array.isArray(db.models)){
      const model=db.models.find(function(m){return m.id===id});
      name=model&&model.name||String(value||'');
    }else name=String(value||'');
    const key=norm(name);
    return key==='molly'||key==='mollygardiner';
  }
  function isParisPackage(record){
    if(!record||typeof record!=='object')return false;
    if(/^paris-/i.test(String(record.id||'')))return true;
    const text=[
      record.brandProject,record.project,record.subject,record.brief,
      record.castingBriefRaw,record.source,
      record.parsedBrief&&record.parsedBrief.location,
      record.parsedBrief&&record.parsedBrief.project
    ].filter(Boolean).join(' ');
    return /\bparis\b/i.test(text)||/\bpfw\b/i.test(text);
  }
  function fixText(value){
    return String(value||'')
      .replace(/Elle, Eva,? and Molly are all in Paris now\./gi,'Elle and Eva are both in Paris now.')
      .replace(/Eva and Molly are both in Paris now\./gi,'Eva is in Paris now.')
      .replace(/Elle\s*\+\s*Eva\s*\+\s*Molly/gi,'Elle + Eva')
      .replace(/Eva\s*\+\s*Molly/gi,'Eva')
      .replace(/No prior sent-mail match found for Elle, Eva or Molly to this recipient/gi,'No prior sent-mail match found for Elle or Eva to this recipient');
  }
  function clean(record){
    if(!isParisPackage(record))return record;
    const out=Object.assign({},record);
    let changed=false;

    ['modelIds','models','modelNames'].forEach(function(key){
      if(!Array.isArray(record[key]))return;
      const next=record[key].filter(function(value){return !blocked(value)});
      if(next.length!==record[key].length){out[key]=next;changed=true}
    });

    ['photoSelections','packagePhotos'].forEach(function(key){
      if(!record[key]||typeof record[key]!=='object')return;
      const next=Object.fromEntries(Object.entries(record[key]).filter(function(entry){return !blocked(entry[0])}));
      if(Object.keys(next).length!==Object.keys(record[key]).length){out[key]=next;changed=true}
    });

    ['subject','customBody','notes'].forEach(function(key){
      if(typeof out[key]!=='string')return;
      const next=fixText(out[key]);
      if(next!==out[key]){out[key]=next;changed=true}
    });

    if(out.packageDepthReview&&typeof out.packageDepthReview==='object'){
      const review=Object.assign({},out.packageDepthReview);
      if(Array.isArray(review.addedModels)){
        const next=review.addedModels.filter(function(value){return !blocked(value)});
        if(next.length!==review.addedModels.length){review.addedModels=next;changed=true}
      }
      if(review.reasons&&typeof review.reasons==='object'){
        const reasons=Object.assign({},review.reasons);
        if(Object.prototype.hasOwnProperty.call(reasons,'Molly')){delete reasons.Molly;changed=true}
        if(Object.prototype.hasOwnProperty.call(reasons,'Molly Gardiner')){delete reasons['Molly Gardiner'];changed=true}
        review.reasons=reasons;
      }
      out.packageDepthReview=review;
    }

    if(changed){
      out.html='';
      delete out.manualEmailHtml;
      delete out.manualEmailEditedAt;
      out.previewNeedsGmailUpdate=true;
      if(out.gmailDraftId&&out.openTrackingState==='ready')out.openTrackingState='editing';
    }
    return out;
  }
  function apply(){
    if(typeof db==='undefined'||!db)return false;
    let changed=false;

    if(Array.isArray(db.drafts)){
      db.drafts=db.drafts.map(function(record){
        const next=clean(record);
        if(next!==record)changed=true;
        return next;
      });
    }

    const active=(db.drafts||[]).find(function(d){return d.id===db.activeDraftId});
    if(isParisPackage(db.draft)||isParisPackage(active)){
      const before=JSON.stringify({
        modelIds:db.draft&&db.draft.modelIds,
        models:db.draft&&db.draft.models,
        subject:db.draft&&db.draft.subject,
        customBody:db.draft&&db.draft.customBody
      });
      db.draft=clean(db.draft||{});
      const after=JSON.stringify({
        modelIds:db.draft&&db.draft.modelIds,
        models:db.draft&&db.draft.models,
        subject:db.draft&&db.draft.subject,
        customBody:db.draft&&db.draft.customBody
      });
      if(before!==after)changed=true;

      if(Array.isArray(db.selected)){
        const next=db.selected.filter(function(id){return !blocked(id)});
        if(next.length!==db.selected.length){db.selected=next;changed=true}
      }
      if(typeof selected!=='undefined'&&Array.isArray(selected)){
        selected=selected.filter(function(id){return !blocked(id)});
      }
      if(db.draftPhotoSelections&&typeof db.draftPhotoSelections==='object'){
        Object.keys(db.draftPhotoSelections).forEach(function(id){
          if(blocked(id)){delete db.draftPhotoSelections[id];changed=true}
        });
      }
    }

    db.recovery=Object.assign({},db.recovery||{},{
      mollyRemovedFromParisPackages:true,
      mollyRemovedFromParisPackagesOn:'2026-09-25'
    });

    if(changed){
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      if(typeof setStatus==='function')setStatus('Molly removed from all Paris packages.');
    }
    return true;
  }
  function wait(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db&&window.__clmWorkspaceReady){apply();return}
    if(attempt<120)setTimeout(function(){wait(attempt+1)},100);
  }

  window.clmRemoveMollyFromParisPackages=apply;
  window.addEventListener('clm:workspace-ready',function(){setTimeout(apply,0)},{once:true});
  wait(0);
})();


/* CRM EMAIL COPY DASH CLEANUP · 2026-09-25 */
(function(){
  'use strict';
  if(window.__clmEmailDashCleanupLoaded)return;
  window.__clmEmailDashCleanupLoaded=true;

  const DASH=/[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
  const SPACED_DASH=/\s+[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212]+\s+/g;

  function cleanSubject(value){
    const raw=String(value||'');
    const prefix=(raw.match(/^\s*((?:(?:Re|Fwd):\s*)+)/i)||[])[1]||'';
    const body=prefix?raw.slice(raw.indexOf(prefix)+prefix.length):raw;
    const cleaned=body
      .replace(SPACED_DASH,' ')
      .replace(DASH,' ')
      .replace(/:\s+/g,' ')
      .replace(/\s+([;,!?])/g,'$1')
      .replace(/\s{2,}/g,' ')
      .trim();
    return (prefix+cleaned).trim();
  }

  function cleanBodyText(value){
    return String(value||'')
      .replace(SPACED_DASH,', ')
      .replace(DASH,' ')
      .replace(/\s+([,.;:!?])/g,'$1')
      .replace(/,\s*,/g,',')
      .replace(/\s{2,}/g,' ');
  }

  function cleanHtml(html){
    const template=document.createElement('template');
    template.innerHTML=String(html||'');
    const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      const parent=node.parentElement;
      if(parent&&/^(STYLE|SCRIPT|CODE|PRE)$/i.test(parent.tagName))return;
      node.nodeValue=cleanBodyText(node.nodeValue);
    });
    return template.innerHTML;
  }

  function cleanRecord(record){
    if(!record||typeof record!=='object')return false;
    let changed=false;
    if(typeof record.subject==='string'){
      const next=cleanSubject(record.subject);
      if(next!==record.subject){record.subject=next;changed=true}
    }
    for(const key of ['customBody','brief']){
      if(typeof record[key]!=='string')continue;
      const next=cleanBodyText(record[key]);
      if(next!==record[key]){record[key]=next;changed=true}
    }
    if(typeof record.manualEmailHtml==='string'){
      const next=cleanHtml(record.manualEmailHtml);
      if(next!==record.manualEmailHtml){record.manualEmailHtml=next;changed=true}
    }
    if(typeof record.html==='string'&&record.html){
      const next=cleanHtml(record.html);
      if(next!==record.html){record.html=next;changed=true}
    }
    if(changed){
      record.previewNeedsGmailUpdate=true;
      if(record.openTrackingState==='ready')record.openTrackingState='editing';
    }
    return changed;
  }

  function cleanUi(){
    let changed=false;
    const subject=document.getElementById('emailSubject');
    if(subject){
      const next=cleanSubject(subject.value);
      if(next!==subject.value){subject.value=next;changed=true}
    }
    for(const id of ['emailCustomBody','emailContext']){
      const el=document.getElementById(id);
      if(!el)continue;
      const next=cleanBodyText(el.value);
      if(next!==el.value){el.value=next;changed=true}
    }
    const preview=document.getElementById('emailPreview');
    if(preview&&preview.innerHTML){
      const next=cleanHtml(preview.innerHTML);
      if(next!==preview.innerHTML){preview.innerHTML=next;changed=true}
    }
    return changed;
  }

  function applyAll(){
    if(typeof db==='undefined'||!db)return false;
    let changed=false;
    if(cleanRecord(db.draft))changed=true;
    (db.drafts||[]).forEach(function(record){if(cleanRecord(record))changed=true});
    if(cleanUi())changed=true;
    db.settings=Object.assign({},db.settings||{},{
      noDashEmailCopyVersion:1,
      noDashEmailCopyUpdatedOn:'2026-09-25'
    });
    if(changed&&typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    return changed;
  }

  if(typeof emailHtml==='function'&&!emailHtml.__clmNoDash){
    const original=emailHtml;
    const wrapped=function(){
      return cleanHtml(original.apply(this,arguments));
    };
    wrapped.__clmNoDash=true;
    emailHtml=wrapped;
  }

  if(typeof captureDraft==='function'&&!captureDraft.__clmNoDash){
    const original=captureDraft;
    const wrapped=function(){
      cleanUi();
      const result=original.apply(this,arguments);
      cleanRecord(db.draft);
      return result;
    };
    wrapped.__clmNoDash=true;
    captureDraft=wrapped;
  }

  if(typeof hydrateDraft==='function'&&!hydrateDraft.__clmNoDash){
    const original=hydrateDraft;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      cleanUi();
      return result;
    };
    wrapped.__clmNoDash=true;
    hydrateDraft=wrapped;
  }

  if(typeof createFormattedWorkGmailDraft==='function'&&!createFormattedWorkGmailDraft.__clmNoDash){
    const original=createFormattedWorkGmailDraft;
    const wrapped=async function(){
      cleanUi();
      cleanRecord(db.draft);
      const active=db.activeDraftId?(db.drafts||[]).find(function(d){return d.id===db.activeDraftId}):null;
      if(active)cleanRecord(active);
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      return original.apply(this,arguments);
    };
    wrapped.__clmNoDash=true;
    createFormattedWorkGmailDraft=wrapped;
  }

  ['emailSubject','emailCustomBody','emailContext'].forEach(function(id){
    const el=document.getElementById(id);
    if(!el||el.dataset.noDashBound==='1')return;
    el.dataset.noDashBound='1';
    el.addEventListener('blur',function(){
      cleanUi();
      if(typeof captureDraft==='function')captureDraft();
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderEmail==='function')renderEmail();
    });
  });

  window.clmCleanEmailDashes=function(){
    const changed=applyAll();
    if(typeof renderEmail==='function')renderEmail();
    if(typeof renderDrafts==='function')renderDrafts();
    if(typeof setStatus==='function')setStatus('Removed dashes from CRM email subjects and body copy.');
    return changed;
  };

  window.addEventListener('clm:workspace-ready',function(){
    setTimeout(function(){
      applyAll();
      if(typeof renderAll==='function')renderAll();
    },0);
  },{once:true});

  setTimeout(function(){
    if(typeof db!=='undefined'&&db){
      applyAll();
      if(typeof renderAll==='function')renderAll();
    }
  },1200);
})();


/* CLM EXACT EMAIL TEMPLATE · 2026-09-25 */
(function(){
  'use strict';
  if(window.__clmExactEmailTemplateLoaded)return;
  window.__clmExactEmailTemplateLoaded=true;

  function cleanCopy(value){
    return String(value||'')
      .replace(/\s+[\u2010\u2011\u2012\u2013\u2014\u2015-]+\s+/g,' ')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015-]+/g,' ')
      .replace(/\s+([,.;:!?])/g,'$1')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  function subjectCopy(value){
    const raw=String(value||'');
    const prefix=(raw.match(/^\s*((?:(?:Re|Fwd):\s*)+)/i)||[])[1]||'';
    const body=prefix?raw.slice(raw.indexOf(prefix)+prefix.length):raw;
    return (prefix+cleanCopy(body).replace(/:\s+/g,' ')).trim();
  }

  function firstName(value){
    return String(value||'').trim().split(/\s+/)[0]||'';
  }

  function shortSubjectName(value){
    const name=String(value||'').trim();
    if(!name)return '';
    if(/^elle(?:\s+pickens)?$/i.test(name))return 'Elle';
    if(/^eva(?:\s+kann)?$/i.test(name))return 'Eva';
    return firstName(name);
  }

  function activeRecord(){
    return typeof db!=='undefined'&&db&&db.activeDraftId
      ?(db.drafts||[]).find(function(d){return d.id===db.activeDraftId})||null
      :null;
  }

  function currentSelectedModels(){
    if(typeof selectedModels==='function')return selectedModels();
    if(typeof db==='undefined'||!db)return [];
    const ids=Array.isArray(window.selected)?window.selected:(Array.isArray(db.selected)?db.selected:[]);
    return ids.map(function(id){return (db.models||[]).find(function(m){return m.id===id})}).filter(Boolean);
  }

  function greetingName(record,contactName){
    if(typeof draftGreetingNames==='function'){
      const names=draftGreetingNames(record||{contactName:contactName});
      if(names&&names.length)return names.slice(0,3);
    }
    const first=firstName(contactName);
    return first?[first]:[];
  }

  function namesText(names){
    if(typeof naturalNameList==='function')return naturalNameList(names);
    if(names.length<2)return names[0]||'';
    if(names.length===2)return names[0]+' and '+names[1];
    return names.slice(0,-1).join(', ')+' and '+names[names.length-1];
  }

  function templateModelNames(picked){
    const names=(picked||[]).map(function(model){return shortSubjectName(model&&model.name)}).filter(Boolean);
    const unique=[...new Set(names)];
    if(unique.length<2)return unique[0]||'';
    if(unique.length===2)return unique[0]+' and '+unique[1];
    return unique.slice(0,-1).join(', ')+' and '+unique[unique.length-1];
  }

  function introCopy(d,picked,record){
    const recordText=[
      record&&record.id,record&&record.brandProject,record&&record.project,
      record&&record.subject,record&&record.parsedBrief&&record.parsedBrief.project,
      record&&record.parsedBrief&&record.parsedBrief.location
    ].filter(Boolean).join(' ');
    if(/Paris/i.test(recordText)&&/In[\\s-]?Town|in town model update/i.test(recordText)){
      const names=templateModelNames(picked);
      if(names){
        const verb=(picked||[]).length===1?'is':'are';
        const pronoun=(picked||[]).length===1?'Their':'Their';
        return 'Another quick Paris update '+names+' '+verb+' in Paris as well. '+pronoun+' materials are below.';
      }
    }
    const custom=cleanCopy(d.customBody||'');
    if(custom)return custom;
    if(d.purpose==='submission')return 'I preselected a few models I think would be a good fit. Their materials are below.';
    if(d.purpose==='availability')return 'Sharing the latest availability and model details. Their materials are below.';
    if(d.purpose==='introduction')return 'I wanted to introduce a few models from our roster. Their materials are below.';
    if(d.purpose==='followup')return 'Just following up with a few model options. Their materials are below.';
    return picked.length?'Their materials are below.':'';
  }

  function modelBlock(model,d){
    const name=String(model.name||'').trim();
    const stats=d.stats&&model.stats?' | '+formatStats(model.stats):'';
    const portfolio=d.sources&&model.profile
      ?'<div style="margin:0 0 10px"><a href="'+esc(model.profile)+'" target="_blank" style="color:#1155cc;text-decoration:underline">'+esc(model.profileLabel||'Portfolio')+'</a></div>'
      :'';
    const photo=d.photos&&typeof modelDraftPhotosHtml==='function'?modelDraftPhotosHtml(model):'';
    return '<div style="margin:0 0 28px;color:#000;font-size:13px">'+
      '<div style="line-height:1.55"><b>'+esc(name)+'</b>'+stats+'</div>'+
      portfolio+
      photo+
      '</div>';
  }

  function exactEmailHtml(){
    const d={
      purpose:document.getElementById('emailPurpose')?.value||'submission',
      contactName:String(document.getElementById('emailContactName')?.value||'').trim(),
      recipientEmail:String(document.getElementById('emailRecipient')?.value||'').trim(),
      brand:String(document.getElementById('emailBrand')?.value||'').trim(),
      brief:String(document.getElementById('emailContext')?.value||'').trim(),
      customBody:String(document.getElementById('emailCustomBody')?.value||'').trim(),
      stats:document.getElementById('includeStats')?.checked!==false,
      photos:document.getElementById('includePhotos')?.checked!==false,
      sources:document.getElementById('includeSources')?.checked!==false
    };

    const record=activeRecord()||db.draft||{};
    const manual=String(record.manualEmailHtml||db.draft?.manualEmailHtml||'').trim();
    if(manual)return manual;

    const picked=currentSelectedModels();
    const greetingNames=greetingName(record,d.contactName);
    const greeting=greetingNames.length?'Hi '+esc(namesText(greetingNames))+',':'Hi,';
    const intro=introCopy(d,picked,record);
    const brief=cleanCopy(d.brief||'');
    const blocks=picked.map(function(model){return modelBlock(model,d)}).join('');
    const more=picked.length
      ?'<div style="margin:0 0 28px">More model options <a href="https://canva.link/hkqja7ybl587pm8" target="_blank" style="color:#1155cc;text-decoration:underline">HERE</a> if helpful.</div>'
      :'';

    return '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.35;color:#000">'+
      '<div>'+greeting+'</div>'+
      '<div style="height:18px"></div>'+
      (intro?'<div>'+esc(intro).replace(/\n/g,'<br>')+'</div>':'')+
      (brief&&cleanCopy(brief)!==cleanCopy(intro)?'<div style="height:18px"></div><div>'+esc(brief).replace(/\n/g,'<br>')+'</div>':'')+
      '<div style="height:18px"></div>'+
      (blocks||'<div>[Select one or more models]</div>')+
      more+
      '<div>Thank you,</div>'+
      '<div>Justin</div>'+
      '<div style="height:18px"></div>'+
      '<div><b>Chez Les Mannequins · Creative Agency</b></div>'+
      '<div><i>Model Representation | Artist Management | Casting | Production | Advertising</i></div>'+
      '</div>';
  }

  function parisInTownCopy(record){
    if(!record||typeof record!=='object')return false;
    const text=[record.id,record.brandProject,record.project,record.subject,record.parsedBrief&&record.parsedBrief.project].filter(Boolean).join(' ');
    if(!/Paris/i.test(text)||!/In[\s-]?Town|in town model update/i.test(text))return false;
    const rawNames=Array.isArray(record.models)?record.models:[];
    const names=rawNames.map(shortSubjectName).filter(Boolean);
    if(!names.length&&Array.isArray(record.modelIds)&&typeof db!=='undefined'){
      record.modelIds.forEach(function(id){
        const m=(db.models||[]).find(function(x){return x.id===id});
        if(m)names.push(shortSubjectName(m.name));
      });
    }
    const unique=[...new Set(names)].filter(Boolean);
    if(!unique.length)return false;
    const joined=unique.length===1?unique[0]:unique.length===2?unique[0]+' + '+unique[1]:unique.slice(0,-1).join(' + ')+' + '+unique[unique.length-1];
    const natural=unique.length===1?unique[0]:unique.length===2?unique[0]+' and '+unique[1]:unique.slice(0,-1).join(', ')+' and '+unique[unique.length-1];
    const subject='Paris S/S 2027 '+joined+' in Paris';
    const body=unique.length===1
      ?'Another quick Paris update '+natural+' is in Paris as well. Their materials are below.'
      :'Another quick Paris update '+natural+' are in Paris as well. Their materials are below.';
    let changed=false;
    if(record.subject!==subject){record.subject=subject;changed=true}
    if(record.customBody!==body){record.customBody=body;changed=true}
    if(changed){
      record.html='';
      delete record.manualEmailHtml;
      delete record.manualEmailEditedAt;
      record.previewNeedsGmailUpdate=true;
      if(record.openTrackingState==='ready')record.openTrackingState='editing';
    }
    return changed;
  }

  function migrate(){
    if(typeof db==='undefined'||!db)return false;
    let changed=false;
    (db.drafts||[]).forEach(function(record){
      if(parisInTownCopy(record))changed=true;
      if(typeof record.subject==='string'){
        const next=subjectCopy(record.subject);
        if(next!==record.subject){record.subject=next;record.previewNeedsGmailUpdate=true;changed=true}
      }
    });
    if(db.draft){
      if(parisInTownCopy(db.draft))changed=true;
      if(typeof db.draft.subject==='string'){
        const next=subjectCopy(db.draft.subject);
        if(next!==db.draft.subject){db.draft.subject=next;db.draft.previewNeedsGmailUpdate=true;changed=true}
      }
    }
    const subject=document.getElementById('emailSubject');
    if(subject){
      const next=subjectCopy(subject.value);
      if(next!==subject.value){subject.value=next;changed=true}
    }
    db.settings=Object.assign({},db.settings||{},{
      exactEmailTemplateVersion:2,
      exactEmailTemplateUpdatedOn:'2026-09-25'
    });
    if(changed&&typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    return changed;
  }

  emailHtml=exactEmailHtml;
  emailHtml.__clmExactTemplate=true;

  if(typeof hydrateDraft==='function'&&!hydrateDraft.__clmExactTemplate){
    const originalHydrate=hydrateDraft;
    hydrateDraft=function(){
      const out=originalHydrate.apply(this,arguments);
      const subject=document.getElementById('emailSubject');
      if(subject)subject.value=subjectCopy(subject.value);
      return out;
    };
    hydrateDraft.__clmExactTemplate=true;
  }

  if(typeof createFormattedWorkGmailDraft==='function'&&!createFormattedWorkGmailDraft.__clmExactTemplate){
    const originalCreate=createFormattedWorkGmailDraft;
    createFormattedWorkGmailDraft=async function(){
      migrate();
      const subject=document.getElementById('emailSubject');
      if(subject)subject.value=subjectCopy(subject.value);
      if(typeof captureDraft==='function')captureDraft();
      return originalCreate.apply(this,arguments);
    };
    createFormattedWorkGmailDraft.__clmExactTemplate=true;
  }

  window.clmApplyExactEmailTemplate=function(){
    migrate();
    if(typeof renderEmail==='function')renderEmail();
    if(typeof renderDrafts==='function')renderDrafts();
    if(typeof setStatus==='function')setStatus('Email formatting updated to the approved CLM template.');
  };

  window.addEventListener('clm:workspace-ready',function(){
    setTimeout(function(){
      migrate();
      if(typeof renderAll==='function')renderAll();
    },50);
  },{once:true});

  setTimeout(function(){
    if(typeof db!=='undefined'&&db){
      migrate();
      if(typeof renderAll==='function')renderAll();
    }
  },1500);
})();
