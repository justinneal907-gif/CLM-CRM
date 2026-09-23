/* CLM CRM email open tracking · 2026-09-23
   Adds opt-in tracked sending for CRM-created Gmail drafts.
   Tracking is armed only when the reviewed draft is sent from the CRM, so
   reviewing the sender's draft does not intentionally trigger the counter. */
(function(){
  'use strict';

  const TRACK_VERSION='2026-09-23-v1';
  const TRACK_BASE='https://countapi.mileshilliard.com/api/v1';
  const TRACK_POLL_MS=5*60*1000;
  let trackTimer=null;
  let trackChecking=false;

  function q(sel){return document.querySelector(sel)}
  function safe(value){return typeof esc==='function'?esc(String(value||'')):String(value||'')}
  function nowIso(){return new Date().toISOString()}
  function randomHex(bytes){
    bytes=bytes||16;
    const a=new Uint8Array(bytes);
    try{crypto.getRandomValues(a)}catch(err){for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256)}
    return Array.from(a).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
  }
  function currentDraft(){
    if(typeof db==='undefined'||!db)return null;
    if(db.activeDraftId){
      const saved=(db.drafts||[]).find(function(x){return x.id===db.activeDraftId});
      if(saved)return saved;
    }
    return db.draft||null;
  }
  function applyCurrentPatch(patch){
    if(typeof db==='undefined'||!db)return;
    db.draft=Object.assign({},db.draft||{},patch);
    if(db.activeDraftId){
      const saved=(db.drafts||[]).find(function(x){return x.id===db.activeDraftId});
      if(saved)Object.assign(saved,patch);
    }
  }
  function trackingNamespace(){
    db.settings=Object.assign({},db.settings||{});
    let value=String(db.settings.openTrackingNamespace||'').toLowerCase().replace(/[^a-f0-9]/g,'');
    if(value.length<24){
      value=randomHex(16);
      db.settings.openTrackingNamespace=value;
    }
    return value;
  }
  function ensureTrackingId(){
    const d=currentDraft();
    let value=String((d&&d.openTrackingId)||(db.draft&&db.draft.openTrackingId)||'').toLowerCase().replace(/[^a-f0-9]/g,'');
    if(value.length<20)value=randomHex(14);
    applyCurrentPatch({openTrackingId:value});
    return value;
  }
  function counterKey(id){
    return 'clm_'+trackingNamespace()+'_'+String(id||'').toLowerCase().replace(/[^a-f0-9]/g,'');
  }
  function hitUrl(id){
    return TRACK_BASE+'/hit/'+encodeURIComponent(counterKey(id));
  }
  function pixelHtml(id){
    return '<img data-clm-open-track="1" src="'+hitUrl(id)+'" width="1" height="1" alt="" style="display:block;width:1px;height:1px;max-width:1px;max-height:1px;opacity:0;overflow:hidden;border:0;margin:0;padding:0" />';
  }

  function utf8ToBase64Url(value){
    const bytes=new TextEncoder().encode(String(value||''));
    let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function base64UrlToUtf8(value){
    let raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    while(raw.length%4)raw+='=';
    const binary=atob(raw);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function base64ToUtf8(value){
    const binary=atob(String(value||'').replace(/\s/g,''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function utf8ToWrappedBase64(value){
    const bytes=new TextEncoder().encode(String(value||''));
    let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
    const encoded=btoa(binary);
    return (encoded.match(/.{1,76}/g)||[]).join('\r\n');
  }
  function decodeQuotedPrintable(value){
    const input=String(value||'').replace(/=\r?\n/g,'');
    const bytes=[];
    for(let i=0;i<input.length;i++){
      if(input.charAt(i)==='='&&/^[0-9A-F]{2}$/i.test(input.slice(i+1,i+3))){
        bytes.push(parseInt(input.slice(i+1,i+3),16));
        i+=2;
      }else{
        const code=input.charCodeAt(i);
        if(code<=255)bytes.push(code);
        else{
          const encoded=new TextEncoder().encode(input.charAt(i));
          for(let j=0;j<encoded.length;j++)bytes.push(encoded[j]);
        }
      }
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  function setTopHeader(mime,name,value){
    const sep=String(mime).indexOf('\r\n')>=0?'\r\n':'\n';
    const cut=mime.indexOf(sep+sep);
    if(cut<0)return mime;
    let head=mime.slice(0,cut);
    const body=mime.slice(cut+sep.length*2);
    const lower=name.toLowerCase()+':';
    const lines=head.split(sep);
    const out=[];
    let skipping=false;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(line.toLowerCase().indexOf(lower)===0){skipping=true;continue}
      if(skipping&&/^[ \t]/.test(line))continue;
      skipping=false;
      out.push(line);
    }
    out.push(name+': '+value);
    return out.join(sep)+sep+sep+body;
  }
  function topHeader(mime,name){
    const sep=String(mime).indexOf('\r\n')>=0?'\r\n':'\n';
    const cut=mime.indexOf(sep+sep);
    const head=(cut>=0?mime.slice(0,cut):mime).replace(/\r?\n[ \t]+/g,' ');
    const target=name.toLowerCase()+':';
    const lines=head.split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      if(lines[i].toLowerCase().indexOf(target)===0)return lines[i].slice(target.length).trim();
    }
    return '';
  }
  function addPixelToHtml(html,id){
    let out=String(html||'').replace(/<img\b[^>]*data-clm-open-track=["']?1["']?[^>]*>/ig,'');
    const pixel=pixelHtml(id);
    if(/<\/body>/i.test(out))return out.replace(/<\/body>/i,pixel+'</body>');
    if(/<\/html>/i.test(out))return out.replace(/<\/html>/i,pixel+'</html>');
    return out+pixel;
  }
  function injectPixel(mime,id){
    const sep=String(mime).indexOf('\r\n')>=0?'\r\n':'\n';
    const match=/Content-Type:\s*text\/html\b/i.exec(mime);
    if(!match)throw new Error('The Gmail draft does not contain an HTML body, so tracking could not be added.');
    const headerStart=match.index;
    const headerEnd=mime.indexOf(sep+sep,headerStart);
    if(headerEnd<0)throw new Error('Could not locate the HTML body in the Gmail draft.');
    const bodyStart=headerEnd+sep.length*2;
    const boundary=/\r?\n--[^\r\n]+/.exec(mime.slice(bodyStart));
    const bodyEnd=boundary?bodyStart+boundary.index:mime.length;
    const partHeaders=mime.slice(headerStart,headerEnd);
    const body=mime.slice(bodyStart,bodyEnd);
    const encoding=((partHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)||[])[1]||'8bit').trim().toLowerCase();
    let html='';
    if(encoding==='base64')html=base64ToUtf8(body);
    else if(encoding==='quoted-printable')html=decodeQuotedPrintable(body);
    else html=body;
    html=addPixelToHtml(html,id);
    if(encoding==='base64'){
      return mime.slice(0,bodyStart)+utf8ToWrappedBase64(html)+mime.slice(bodyEnd);
    }
    if(encoding==='quoted-printable'){
      let headers=partHeaders.replace(/Content-Transfer-Encoding:\s*[^\r\n]+/i,'Content-Transfer-Encoding: base64');
      if(headers===partHeaders)headers+=sep+'Content-Transfer-Encoding: base64';
      return mime.slice(0,headerStart)+headers+sep+sep+utf8ToWrappedBase64(html)+mime.slice(bodyEnd);
    }
    return mime.slice(0,bodyStart)+html+mime.slice(bodyEnd);
  }

  async function counterValue(id){
    const r=await fetch(TRACK_BASE+'/get/'+encodeURIComponent(counterKey(id)),{cache:'no-store'});
    if(r.status===404)return 0;
    if(!r.ok)throw new Error('Open-tracking counter is unavailable ('+r.status+').');
    const data=await r.json().catch(function(){return {}});
    const n=Number(data&&data.value!==undefined?data.value:(data&&data.count!==undefined?data.count:0));
    return Number.isFinite(n)?n:0;
  }
  async function resetCounter(id){
    const r=await fetch(TRACK_BASE+'/set/'+encodeURIComponent(counterKey(id))+'?value=0',{cache:'no-store'});
    if(!r.ok)throw new Error('Open tracking could not be armed ('+r.status+').');
  }

  function mirrorToSubmissions(record){
    if(!record||typeof db==='undefined'||!db)return;
    (db.submissions||[]).forEach(function(sub){
      const sameDraft=record.id&&sub.draftId===record.id;
      const sameMessage=record.gmailMessageId&&sub.gmailMessageId===record.gmailMessageId;
      const sameTracker=record.openTrackingId&&sub.openTrackingId===record.openTrackingId;
      if(!sameDraft&&!sameMessage&&!sameTracker)return;
      sub.openTrackingId=record.openTrackingId||sub.openTrackingId||'';
      sub.openTrackingState=record.openTrackingState||sub.openTrackingState||'';
      sub.openTrackingCount=Number(record.openTrackingCount||0);
      sub.openTrackingFirstDetectedAt=record.openTrackingFirstDetectedAt||'';
      sub.openTrackingLastCheckedAt=record.openTrackingLastCheckedAt||'';
    });
  }
  function trackingRecords(includeOpened){
    if(typeof db==='undefined'||!db)return [];
    const all=[].concat(db.drafts||[],db.submissions||[]);
    if(db.draft)all.push(db.draft);
    const seen=new Set();
    const out=[];
    const cutoff=Date.now()-45*24*60*60*1000;
    all.forEach(function(record){
      if(!record||record.openTrackingState!=='armed'||!record.openTrackingId)return;
      if(!includeOpened&&Number(record.openTrackingCount||0)>0)return;
      const sentMs=Date.parse(record.submittedAt||record.openTrackingArmedAt||record.date||'');
      if(Number.isFinite(sentMs)&&sentMs<cutoff)return;
      const key=record.openTrackingId;
      if(seen.has(key))return;
      seen.add(key);
      out.push(record);
    });
    return out;
  }
  function trackingSummary(){
    const all=trackingRecords(true);
    let open=0,waiting=0;
    all.forEach(function(record){
      if(Number(record.openTrackingCount||0)>0)open++;
      else waiting++;
    });
    let ready=0;
    const seen=new Set();
    (db.drafts||[]).concat(db.draft||[]).forEach(function(record){
      if(!record||record.openTrackingState!=='ready'||!record.gmailDraftId||record.submittedAt)return;
      if(record.openTrackingId&&seen.has(record.openTrackingId))return;
      if(record.openTrackingId)seen.add(record.openTrackingId);
      ready++;
    });
    return {open:open,waiting:waiting,ready:ready};
  }

  function trackingBadge(record){
    if(!record||!record.openTrackingId)return '';
    if(Number(record.openTrackingCount||0)>0)return '<span class="pill" title="A remote image-load signal was detected. Privacy features can create false positives.">OPEN SIGNAL</span>';
    if(record.openTrackingState==='armed')return '<span class="pill" title="Open tracking was armed when this email was sent.">TRACKING</span>';
    if(record.openTrackingState==='ready'&&record.submittedAt)return '<span class="pill" title="This draft was sent without using the tracked-send action.">NOT TRACKED</span>';
    if(record.openTrackingState==='ready'&&record.gmailDraftId)return '<span class="pill" title="Review in Gmail, then use Send tracked draft in the CRM.">TRACKING READY</span>';
    return '';
  }
  function renderTrackerStatus(){
    const anchor=q('#gmailSentSyncStatus')||q('#gmailApiStatus');
    if(anchor){
      let el=q('#gmailOpenTrackingStatus');
      if(!el){
        el=document.createElement('div');
        el.id='gmailOpenTrackingStatus';
        el.className='tiny muted';
        el.style.marginTop='5px';
        anchor.insertAdjacentElement('afterend',el);
      }
      const x=trackingSummary();
      if(x.open)el.innerHTML='<b>Open tracking:</b> '+x.open+' open signal'+(x.open===1?'':'s')+' detected.';
      else if(x.waiting)el.innerHTML='<b>Open tracking:</b> '+x.waiting+' tracked email'+(x.waiting===1?'':'s')+' awaiting a signal.';
      else if(x.ready)el.innerHTML='<b>Open tracking:</b> '+x.ready+' Gmail draft'+(x.ready===1?'':'s')+' ready for tracked send.';
      else el.innerHTML='<b>Open tracking:</b> ready for new CRM Gmail drafts.';
    }

    const scope=q('#draftScopeBanner');
    if(scope){
      let row=q('#openTrackingDraftStatus');
      if(!row){
        row=document.createElement('div');
        row.id='openTrackingDraftStatus';
        row.className='tiny muted';
        row.style.marginTop='8px';
        scope.appendChild(row);
      }
      const d=currentDraft();
      if(!d||!d.openTrackingId){
        row.style.display='none';
        row.textContent='';
      }else{
        row.style.display='block';
        const count=Number(d.openTrackingCount||0);
        if(count>0){
          const detected=d.openTrackingFirstDetectedAt?new Date(d.openTrackingFirstDetectedAt).toLocaleString():'';
          row.innerHTML='<b>Open signal detected.</b>'+(detected?' First detected '+safe(detected)+'.':'')+' Image-load signals: '+count+'.';
        }else if(d.openTrackingState==='armed'){
          row.innerHTML='<b>Open tracking active.</b> No image-load signal detected yet.';
        }else if(d.openTrackingState==='ready'&&d.submittedAt){
          row.innerHTML='<b>No open tracking for this sent email.</b> It was sent directly from Gmail instead of through <b>Send tracked draft</b>.';
        }else if(d.openTrackingState==='ready'&&d.gmailDraftId){
          row.innerHTML='<b>Tracking ready.</b> Review the Gmail draft, return here, then click <b>Send tracked draft</b>.';
        }else{
          row.style.display='none';
          row.textContent='';
        }
      }
    }

    const d=currentDraft();
    const send=q('#sendTrackedDraftBtn');
    const check=q('#checkOpenTrackingBtn');
    if(send){
      send.disabled=!(d&&d.gmailDraftId&&d.openTrackingId&&!d.submittedAt);
      send.title=send.disabled?'Create the Gmail draft from this CRM package first.':'Send the reviewed Gmail draft immediately with open tracking armed.';
    }
    if(check)check.disabled=!trackingRecords(true).length;
  }

  async function checkOpens(showStatus,includeOpened){
    if(trackChecking)return;
    const records=trackingRecords(!!includeOpened);
    if(!records.length){
      renderTrackerStatus();
      if(showStatus&&typeof setStatus==='function')setStatus('No tracked sent emails need an open check.');
      return;
    }
    trackChecking=true;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Checking tracked email opens…');
      let newlyOpened=0;
      let changed=false;
      for(let i=0;i<records.length;i++){
        const record=records[i];
        try{
          const before=Number(record.openTrackingCount||0);
          const value=await counterValue(record.openTrackingId);
          record.openTrackingCount=value;
          record.openTrackingLastCheckedAt=nowIso();
          if(value>0&&!record.openTrackingFirstDetectedAt){
            record.openTrackingFirstDetectedAt=nowIso();
            newlyOpened++;
          }
          if(value!==before||record.openTrackingLastCheckedAt)changed=true;
          mirrorToSubmissions(record);
          if(db.activeDraftId&&record.id===db.activeDraftId){
            Object.assign(db.draft,{
              openTrackingCount:record.openTrackingCount,
              openTrackingFirstDetectedAt:record.openTrackingFirstDetectedAt||'',
              openTrackingLastCheckedAt:record.openTrackingLastCheckedAt||''
            });
          }
        }catch(err){
          console.warn('CLM open tracking check failed for one email',err);
        }
      }
      db.settings=Object.assign({},db.settings||{},{openTrackingLastCheckAt:nowIso(),openTrackingVersion:TRACK_VERSION});
      if(changed&&typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      renderTrackerStatus();
      if(showStatus&&typeof setStatus==='function'){
        setStatus(newlyOpened?'Detected '+newlyOpened+' new email open signal'+(newlyOpened===1?'':'s')+'.':'Open tracking checked; no new signals.');
      }
    }finally{
      trackChecking=false;
    }
  }

  async function loadGmailDraftRaw(token,id){
    const u=new URL('https://gmail.googleapis.com/gmail/v1/users/me/drafts/'+encodeURIComponent(id));
    u.searchParams.set('format','raw');
    const r=await fetch(u,{headers:{Authorization:'Bearer '+token}});
    const data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error((data.error&&data.error.message)||'Could not load the Gmail draft. It may already have been sent or deleted.');
    if(!data.message||!data.message.raw)throw new Error('Gmail returned the draft without a message body.');
    return data.message.raw;
  }
  async function updateGmailDraft(token,id,raw){
    const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/'+encodeURIComponent(id),{
      method:'PUT',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({id:id,message:{raw:raw}})
    });
    const data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error((data.error&&data.error.message)||'Could not arm open tracking on the Gmail draft.');
    return data;
  }
  async function sendGmailDraft(token,id){
    const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({id:id})
    });
    const data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error((data.error&&data.error.message)||'Gmail could not send the tracked draft.');
    return data;
  }
  function nyDate(){
    try{
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const get=function(type){const p=parts.find(function(x){return x.type===type});return p?p.value:''};
      return get('year')+'-'+get('month')+'-'+get('day');
    }catch(err){
      return new Date().toISOString().slice(0,10);
    }
  }
  function recordTrackedSubmission(d,messageId,to,subject){
    if(typeof db==='undefined'||!db)return;
    const date=nyDate();
    const gmailUrl=messageId?'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL)+'#sent/'+messageId:'';
    let sub=(db.submissions||[]).find(function(x){
      return (messageId&&x.gmailMessageId===messageId)||(d&&d.id&&x.draftId===d.id&&x.date===date);
    });
    if(!sub){
      let modelNames=[];
      try{if(typeof selectedModels==='function')modelNames=selectedModels().map(function(m){return m.name})}catch(err){}
      if(!modelNames.length&&d&&Array.isArray(d.models))modelNames=d.models.slice();
      sub={
        id:'gmail-sent-'+(messageId||randomHex(8)),
        date:date,
        draftId:(d&&d.id)||(db.activeDraftId||''),
        contact:(d&&d.contactName)||'',
        company:(d&&(d.company||d.brandProject))||'',
        email:to||(d&&d.recipientEmail)||'',
        project:(d&&(d.brandProject||d.company))||subject||(d&&d.subject)||'',
        models:modelNames,
        modelIds:(d&&Array.isArray(d.modelIds))?d.modelIds.slice():(Array.isArray(db.selected)?db.selected.slice():[]),
        status:'Submitted',
        subject:subject||(d&&d.subject)||'',
        gmailMessageId:messageId||'',
        gmailUrl:gmailUrl,
        source:'Work Gmail tracked send'
      };
      db.submissions.push(sub);
      try{if(typeof autoFollowUpForSubmission==='function')autoFollowUpForSubmission(sub)}catch(err){}
    }
    Object.assign(sub,{
      gmailMessageId:messageId||sub.gmailMessageId||'',
      gmailUrl:gmailUrl||sub.gmailUrl||'',
      openTrackingId:(d&&d.openTrackingId)||sub.openTrackingId||'',
      openTrackingState:'armed',
      openTrackingCount:0,
      openTrackingFirstDetectedAt:'',
      openTrackingLastCheckedAt:'',
      source:'Work Gmail tracked send'
    });
  }

  async function sendTrackedCurrentDraft(){
    const d=currentDraft();
    if(!d||!d.gmailDraftId||!d.openTrackingId)throw new Error('Create this package as a Work Gmail draft first.');
    if(d.submittedAt)throw new Error('This package is already marked as submitted.');
    if(typeof gmailToken!=='function')throw new Error('Reconnect Work Gmail before sending.');
    const token=await gmailToken();
    let encoded=await loadGmailDraftRaw(token,d.gmailDraftId);
    let mime=base64UrlToUtf8(encoded);
    const to=topHeader(mime,'To')||d.recipientEmail||'';
    const subject=d.subject||topHeader(mime,'Subject')||'Model package';
    const okay=window.confirm('Send this tracked Gmail draft now?\n\nTo: '+to+'\nSubject: '+subject+'\n\nThis sends immediately. Open tracking is an approximate image-load signal, not a guaranteed human read.');
    if(!okay)return;
    if(typeof setStatus==='function')setStatus('Arming open tracking and sending the reviewed Gmail draft…');
    await resetCounter(d.openTrackingId);
    mime=setTopHeader(mime,'X-CLM-Tracking-ID',d.openTrackingId);
    mime=setTopHeader(mime,'X-CLM-Tracking-State','armed');
    mime=injectPixel(mime,d.openTrackingId);
    encoded=utf8ToBase64Url(mime);
    await updateGmailDraft(token,d.gmailDraftId,encoded);
    const sent=await sendGmailDraft(token,d.gmailDraftId);
    const messageId=(sent&&sent.id)||(sent&&sent.message&&sent.message.id)||'';
    const sentAt=nowIso();
    const gmailUrl=messageId?'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL)+'#sent/'+messageId:'';
    applyCurrentPatch({
      gmailDraftId:'',
      gmailMessageId:messageId,
      gmailUrl:gmailUrl,
      submittedAt:sentAt,
      submittedDate:nyDate(),
      submissionStatus:'Submitted',
      openTrackingState:'armed',
      openTrackingArmedAt:sentAt,
      openTrackingCount:0,
      openTrackingFirstDetectedAt:'',
      openTrackingLastCheckedAt:''
    });
    const updated=currentDraft();
    recordTrackedSubmission(updated,messageId,to,subject);
    db.settings=Object.assign({},db.settings||{},{openTrackingVersion:TRACK_VERSION});
    if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    if(typeof renderAll==='function')renderAll();
    renderTrackerStatus();
    if(typeof setStatus==='function')setStatus('Tracked email sent. The CRM will check for open signals while it is open.');
    if(typeof window.clmSyncSentMail==='function')setTimeout(function(){window.clmSyncSentMail()},1500);
    setTimeout(function(){checkOpens(false,false)},45000);
  }

  function installDraftCreationHook(){
    if(typeof createFormattedWorkGmailDraft!=='function'||createFormattedWorkGmailDraft.__clmOpenTracking)return;
    const original=createFormattedWorkGmailDraft;
    const wrapped=async function(){
      const result=await original.apply(this,arguments);
      const id=ensureTrackingId();
      applyCurrentPatch({
        gmailDraftId:(result&&result.id)||'',
        openTrackingId:id,
        openTrackingState:'ready',
        openTrackingCreatedAt:nowIso(),
        openTrackingCount:0,
        openTrackingFirstDetectedAt:'',
        openTrackingLastCheckedAt:''
      });
      db.settings=Object.assign({},db.settings||{},{openTrackingVersion:TRACK_VERSION});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      renderTrackerStatus();
      return result;
    };
    wrapped.__clmOpenTracking=true;
    createFormattedWorkGmailDraft=wrapped;
  }
  function installDraftCardHook(){
    if(typeof draftCardHtml!=='function'||draftCardHtml.__clmOpenTracking)return;
    const original=draftCardHtml;
    const wrapped=function(d,activeDraft){
      let html=original.apply(this,arguments);
      const badge=trackingBadge(d);
      if(!badge)return html;
      const brand=(d&&(d.brandProject||d.company||d.recipientEmail))||'No brand';
      const needle='<b>'+safe(brand)+'</b>';
      if(html.indexOf(needle)>=0)html=html.replace(needle,needle+badge);
      return html;
    };
    wrapped.__clmOpenTracking=true;
    draftCardHtml=wrapped;
  }
  function installRenderHook(){
    if(typeof renderAll!=='function'||renderAll.__clmOpenTracking)return;
    const original=renderAll;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      setTimeout(renderTrackerStatus,0);
      return result;
    };
    wrapped.__clmOpenTracking=true;
    renderAll=wrapped;
  }
  function installButtons(){
    const panel=q('#gmailApiPanel .actions');
    if(!panel)return;
    if(!q('#sendTrackedDraftBtn')){
      const send=document.createElement('button');
      send.type='button';
      send.id='sendTrackedDraftBtn';
      send.className='btn primary';
      send.textContent='Send tracked draft';
      send.addEventListener('click',function(){
        sendTrackedCurrentDraft().catch(function(err){
          console.error('Tracked send failed',err);
          if(typeof setStatus==='function')setStatus(err&&err.message?err.message:String(err));
          renderTrackerStatus();
        });
      });
      panel.appendChild(send);
    }
    if(!q('#checkOpenTrackingBtn')){
      const check=document.createElement('button');
      check.type='button';
      check.id='checkOpenTrackingBtn';
      check.className='btn';
      check.textContent='Check opens now';
      check.addEventListener('click',function(){checkOpens(true,true)});
      panel.appendChild(check);
    }
  }
  function startTimer(){
    if(trackTimer)clearInterval(trackTimer);
    trackTimer=setInterval(function(){checkOpens(false,false)},TRACK_POLL_MS);
  }
  function init(){
    try{
      installDraftCreationHook();
      installDraftCardHook();
      installRenderHook();
      installButtons();
      startTimer();
      db.settings=Object.assign({},db.settings||{},{openTrackingVersion:TRACK_VERSION});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      renderTrackerStatus();
      setTimeout(function(){checkOpens(false,false)},3000);
    }catch(err){
      console.error('CLM open tracking failed to initialize',err);
    }
  }

  window.clmSendTrackedDraft=function(){
    return sendTrackedCurrentDraft().catch(function(err){
      console.error(err);
      if(typeof setStatus==='function')setStatus(err&&err.message?err.message:String(err));
      renderTrackerStatus();
    });
  };
  window.clmCheckEmailOpens=function(){return checkOpens(true,true)};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();