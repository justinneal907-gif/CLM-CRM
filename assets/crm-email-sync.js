/* CLM CRM sent-mail sync + submitted-package guard · 2026-09-22
   Keeps the static CRM in sync with Work Gmail while the CRM is open.
   Requires one-time Gmail read authorization in addition to the existing compose scope. */
(function(){
  'use strict';
  if(window.__clmEmailSyncLoaded)return;
  window.__clmEmailSyncLoaded=true;
  const SYNC_VERSION='2026-09-23-v4';
  const SYNC_INTERVAL_MS=5*60*1000;
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
    ['Subject','To','Date','X-CLM-Tracking-ID','X-CLM-Tracking-State','X-CLM-Signal-ID'].forEach(x=>u.searchParams.append('metadataHeaders',x));
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
  function startTimer(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(()=>{if(gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncSentMailNow(false)},SYNC_INTERVAL_MS);
    window.addEventListener('clm:gmail-connected',()=>setTimeout(()=>syncSentMailNow(false),250));
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
