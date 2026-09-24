/* CLM CRM email open tracking · 2026-09-23
   Adds opt-in tracked sending for CRM-created Gmail drafts.
   Tracking is armed only when the reviewed draft is sent from the CRM, so
   reviewing the sender's draft does not intentionally trigger the counter. */
(function(){
  'use strict';
  if(window.__clmOpenTrackingLoaded)return;
  window.__clmOpenTrackingLoaded=true;

  const TRACK_VERSION='2026-09-24-v12';
  const TRACK_BASE='https://countapi.mileshilliard.com/api/v1';
  const TRACK_POLL_MS=60*1000;
  let trackTimer=null;
  let trackChecking=false;
  let sendBusy=false;
  let lastAttempt=0;

  function q(sel){return document.querySelector(sel)}
  function safe(value){return typeof esc==='function'?esc(String(value||'')):String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function nowIso(){return new Date().toISOString()}
  function randomHex(bytes){
    bytes=bytes||16;
    const a=new Uint8Array(bytes);
    try{crypto.getRandomValues(a)}catch(err){for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256)}
    return Array.from(a).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
  }
  let notificationRegistrationPromise=null;
  function notificationPermission(){
    if(!window.isSecureContext)return 'insecure';
    if(!('Notification' in window))return 'unsupported';
    return Notification.permission||'default';
  }
  async function notificationRegistration(){
    if(!('serviceWorker' in navigator)||!window.isSecureContext)return null;
    if(notificationRegistrationPromise)return notificationRegistrationPromise;
    notificationRegistrationPromise=navigator.serviceWorker.register('./sw.js',{scope:'./'})
      .then(reg=>navigator.serviceWorker.ready.then(()=>reg))
      .catch(err=>{
        notificationRegistrationPromise=null;
        console.warn('CLM notification service worker unavailable',err);
        return null;
      });
    return notificationRegistrationPromise;
  }
  async function showBrowserNotification(title,options){
    if(notificationPermission()!=='granted')return false;
    const opts=Object.assign({},options||{});
    try{
      const reg=await notificationRegistration();
      if(reg&&typeof reg.showNotification==='function'){
        await reg.showNotification(title,opts);
        return true;
      }
    }catch(err){console.warn('Service-worker notification failed',err)}
    try{
      new Notification(title,opts);
      return true;
    }catch(err){
      console.warn('Direct browser notification failed',err);
      return false;
    }
  }
  function notificationBrand(record){
    return String((record&&(record.brandProject||record.project||record.company||record.subject))||'package');
  }
  function notificationDirector(record){
    return String((record&&(record.contactName||record.contact||record.recipientName||record.recipientEmail||record.email))||'Casting director');
  }
  function notificationModels(record){
    const models=record&&Array.isArray(record.models)?record.models.filter(Boolean):[];
    if(!models.length)return '';
    const shown=models.slice(0,5).join(', ');
    return shown+(models.length>5?' +'+(models.length-5)+' more':'');
  }
  async function notifyOpenSignal(record,before,value){
    if(db.settings?.openAlertsEnabled===false||notificationPermission()!=='granted'||!record||value<=before)return false;
    const director=notificationDirector(record);
    const brand=notificationBrand(record);
    const models=notificationModels(record);
    const title=director+' has opened '+brand;
    let body=value>1?'Open signals: '+value+'.':'Tracked open signal detected.';
    if(models)body+='\nModels: '+models;
    return showBrowserNotification(title,{
      body:body,
      tag:'clm-open-'+record.openTrackingId,
      renotify:true,
      data:{url:location.href}
    });
  }
  async function enableOpenNotifications(){
    if(!window.isSecureContext)throw new Error('Browser notifications require HTTPS.');
    if(!('Notification' in window))throw new Error('This browser does not support desktop notifications.');
    const permission=await Notification.requestPermission();
    db.settings=Object.assign({},db.settings||{},{
      openAlertsEnabled:permission==='granted',
      openNotificationsPermission:permission,
      openNotificationsUpdatedAt:nowIso()
    });
    if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    if(permission==='granted')await notificationRegistration();
    renderTrackerStatus();
    if(permission==='granted'){
      await showBrowserNotification('CLM open alerts enabled',{
        body:'Alerts are ready. Keep the CRM open in any tab; it can be in the background or minimized.',
        tag:'clm-open-alerts-enabled'
      });
    }
    return permission;
  }
  async function testOpenNotification(){
    if(notificationPermission()!=='granted'){
      await enableOpenNotifications();
      if(notificationPermission()!=='granted'){
        if(typeof setStatus==='function')setStatus(notificationPermission()==='denied'?'Browser notifications are blocked for this site. Re-enable them in browser site settings.':'Browser notifications are not available.');
        return;
      }
    }
    const ok=await showBrowserNotification('CLM notification test',{
      body:'Browser notifications are working for this CRM.',
      tag:'clm-open-alert-test',
      renotify:true,
      data:{url:location.href}
    });
    if(typeof setStatus==='function')setStatus(ok?'Test notification requested. If you do not see it, check Windows/browser notification settings.':'The browser could not display the test notification.');
  }

  function currentDraft(){
    if(typeof db==='undefined'||!db)return null;
    if(db.activeDraftId){
      const saved=(db.drafts||[]).find(function(x){return x.id===db.activeDraftId});
      if(saved)return saved;
    }
    return db.draft||null;
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
  function decodeMimeHeader(value){
    return String(value||'').replace(/(\?=)\s+(=\?)/g,'$1$2').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/ig,(word,charset,encoding,payload)=>{
      try{
        const binary=encoding.toUpperCase()==='B'?atob(payload):payload.replace(/_/g,' ').replace(/=([0-9a-f]{2})/ig,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
        return new TextDecoder(charset).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
      }catch{return word}
    });
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
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(TRACK_BASE+'/get/'+encodeURIComponent(counterKey(id)),{cache:'no-store',signal:controller.signal});
      if(r.status===404)return 0;
      if(!r.ok)throw new Error('Tracking service unavailable ('+r.status+').');
      const data=await r.json();
      const value=data?.value??data?.count;
      if(value===null||value===undefined||value===''||!Number.isFinite(Number(value))||Number(value)<0)
        throw new Error('Tracking service returned an invalid count.');
      return Number(value);
    }finally{clearTimeout(timeout)}
  }
  function patchTracker(record,patch){
    const all=[...(db.drafts||[]),...(db.submissions||[]),db.draft];
    all.forEach(item=>{if(item&&item.openTrackingId===record.openTrackingId)Object.assign(item,patch)});
    Object.assign(record,patch);
  }
  function draftTarget(){
    return {id:db.activeDraftId||'',record:db.draft};
  }
  function patchTarget(target,patch){
    const saved=target.id&&(db.drafts||[]).find(x=>x.id===target.id);
    if(saved)Object.assign(saved,patch);
    if(target.id?db.activeDraftId===target.id:db.draft===target.record)Object.assign(db.draft,patch);
    Object.assign(target.record,patch);
    return saved||target.record;
  }

  function trackingRecords(includeOpened,includeHistory=false){
    if(typeof db==='undefined'||!db)return [];
    const all=[].concat(db.submissions||[],db.drafts||[]);
    if(db.draft)all.push(db.draft);
    const seen=new Set();
    const out=[];
    const cutoff=Date.now()-45*24*60*60*1000;
    all.forEach(function(record){
      if(!record||!record.openTrackingId)return;
      if(!includeHistory&&record.openTrackingState!=='armed')return;
      if(!includeOpened&&Number(record.openTrackingCount||0)>0)return;
      const sentMs=Date.parse(record.submittedAt||record.openTrackingArmedAt||record.date||'');
      if(!includeHistory&&Number.isFinite(sentMs)&&sentMs<cutoff)return;
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
      if(!record||record.openTrackingState!=='ready'||!record.gmailDraftId)return;
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
    if(record.openTrackingState==='send-uncertain')return '<span class="pill" title="Gmail did not confirm the send result. Check Sent Mail before retrying.">SEND UNCERTAIN</span>';
    if(record.openTrackingState==='ready'&&record.submittedAt&&!record.gmailDraftId)return '<span class="pill" title="This draft was sent without using the tracked-send action.">NOT TRACKED</span>';
    if(record.openTrackingState==='ready'&&record.gmailDraftId)return '<span class="pill" title="Review in Gmail, then use Send tracked draft in the CRM.">TRACKING READY</span>';
    return '';
  }
  function renderTrackerStatus(){
    const anchor=q('#trackingSummary');
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
      el.innerHTML='<b>'+x.open+'</b> with signals · <b>'+x.waiting+'</b> awaiting a signal · <b>'+x.ready+'</b> ready to send';
      const permission=notificationPermission();
      const alertText=permission==='granted'?(db.settings?.openAlertsEnabled===false?'paused':'on'):permission==='denied'?'blocked':permission==='default'?'not enabled':permission==='insecure'?'requires HTTPS':'unsupported';
      el.innerHTML+='<br><b>Browser alerts:</b> '+alertText+'.';
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
          const firstDetected=d.openTrackingFirstDetectedAt?new Date(d.openTrackingFirstDetectedAt).toLocaleString():'';
          const lastDetected=d.openTrackingLastDetectedAt?new Date(d.openTrackingLastDetectedAt).toLocaleString():'';
          row.innerHTML='<b>Open signal detected.</b>'+(firstDetected?' First detected '+safe(firstDetected)+'.':'')+(lastDetected?' Latest detected '+safe(lastDetected)+'.':'')+' Image-load signals: '+count+'.';
        }else if(d.openTrackingState==='armed'){
          row.innerHTML='<b>Open tracking active.</b> No image-load signal detected yet.';
        }else if(d.openTrackingState==='send-uncertain'){
          row.innerHTML='<b>Send result uncertain.</b> Check Work Gmail Sent Mail before retrying. If it is not there, confirm that in the tracking history below before retrying.';
        }else if(d.openTrackingState==='ready'&&d.submittedAt&&!d.gmailDraftId){
          row.innerHTML='<b>No open tracking for this sent email.</b> Only messages sent using <b>Send tracked draft</b> can be checked here.';
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
    const alerts=q('#enableOpenNotificationsBtn');
    if(send){
      send.disabled=sendBusy||!(d&&d.gmailDraftId&&d.openTrackingId&&d.openTrackingState==='ready');
      send.title=d&&d.openTrackingState==='send-uncertain'?'Check Work Gmail Sent Mail before retrying.':(send.disabled?'Create or update the Gmail draft from this CRM package first.':'Send the currently linked Gmail draft immediately with open tracking armed.');
    }
    if(check){check.disabled=trackChecking||!trackingRecords(true).length;check.textContent=trackChecking?'Checking…':'Check now';}
    if(alerts){
      const permission=notificationPermission();
      if(permission==='granted'){
        alerts.textContent=db.settings?.openAlertsEnabled===false?'Enable open alerts':'Pause open alerts';
        alerts.disabled=false;
        alerts.title='Browser notifications are enabled. They work while the CRM page is open, including in a background tab.';
      }else if(permission==='denied'){
        alerts.textContent='Open alerts blocked';
        alerts.disabled=true;
        alerts.title='Notifications are blocked for this site. Re-enable them in your browser site settings.';
      }else if(permission==='unsupported'||permission==='insecure'){
        alerts.textContent=permission==='insecure'?'Open alerts need HTTPS':'Open alerts unsupported';
        alerts.disabled=true;
        alerts.title=permission==='insecure'?'Notifications require a secure HTTPS page.':'This browser does not support desktop notifications.';
      }else{
        alerts.textContent='Enable open alerts';
        alerts.disabled=false;
        alerts.title='Allow desktop/browser notifications for new and repeat open signals.';
      }
    }
    renderTrackingHistory();
  }

  async function checkOpens(showStatus,includeOpened){
    if(trackChecking||(!showStatus&&Date.now()-lastAttempt<30000))return;
    const records=trackingRecords(!!includeOpened);
    if(!records.length){renderTrackerStatus();return}
    trackChecking=true;lastAttempt=Date.now();renderTrackerStatus();
    let succeeded=0,failed=0,newSignals=0,cursor=0;
    try{
      // Bound concurrency so one slow counter cannot stall every email.
      await Promise.all(Array.from({length:Math.min(4,records.length)},async()=>{
        while(cursor<records.length){
          const record=records[cursor++];
          try{
            const before=Number(record.openTrackingCount||0);
            const value=Math.max(before,await counterValue(record.openTrackingId));
            const stamp=nowIso();
            patchTracker(record,{openTrackingCount:value,openTrackingLastCheckedAt:stamp,openTrackingError:'',
              openTrackingFirstDetectedAt:record.openTrackingFirstDetectedAt||(value>0?stamp:''),
              openTrackingLastDetectedAt:value>before?stamp:(record.openTrackingLastDetectedAt||'')});
            succeeded++;
            if(value>before){newSignals++;void notifyOpenSignal(record,before,value).catch(()=>{})}
          }catch(err){
            failed++;
            patchTracker(record,{openTrackingError:err.name==='AbortError'?'Check timed out. Try again.':String(err.message||err)});
          }
        }
      }));
      db.settings=Object.assign({},db.settings||{},{openTrackingLastAttemptAt:nowIso(),openTrackingVersion:TRACK_VERSION,
        openTrackingCheckSummary:failed?failed+' of '+records.length+' checks failed. Previous results kept.':
          'Checked '+succeeded+' emails. '+newSignals+' with new signals.'});
      if(succeeded)db.settings.openTrackingLastCheckAt=nowIso();
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(showStatus&&typeof setStatus==='function')setStatus(db.settings.openTrackingCheckSummary);
    }finally{trackChecking=false;renderTrackerStatus()}
  }

  async function gmailTrackedFetch(url,options){
    if(typeof gmailToken!=='function')throw new Error('Reconnect Work Gmail before sending.');
    let token=await gmailToken();
    const request=async function(){
      const opts=Object.assign({},options||{});
      opts.headers=Object.assign({},opts.headers||{},{Authorization:'Bearer '+token});
      const controller=new AbortController();
      opts.signal=controller.signal;
      const timeout=setTimeout(()=>controller.abort(),30000);
      try{return await fetch(url,opts)}
      catch(err){
        const e=new Error('Network error while contacting Gmail. Check your connection and try again.');
        e.cause=err;
        e.clmNetwork=true;
        throw e;
      }finally{clearTimeout(timeout)}
    };
    let r=await request();
    if(r.status===401){
      try{
        gmailAccessToken='';
        gmailTokenExpiresAt=0;
        if(typeof clearGmailSession==='function')clearGmailSession();
        token=await connectWorkGmailApi(false);
        r=await request();
      }catch(err){
        throw new Error('Work Gmail authorization expired. Reconnect Work Gmail and try again.');
      }
    }
    return r;
  }
  async function loadGmailDraftRaw(id){
    const u=new URL('https://gmail.googleapis.com/gmail/v1/users/me/drafts/'+encodeURIComponent(id));
    u.searchParams.set('format','raw');
    const r=await gmailTrackedFetch(u.toString(),{});
    const data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error((data.error&&data.error.message)||'Could not load the linked Gmail draft. It may already have been sent or deleted.');
    if(!data.message||!data.message.raw)throw new Error('Gmail returned the draft without a message body.');
    return data.message.raw;
  }
  async function updateGmailDraft(id,raw){
    const r=await gmailTrackedFetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/'+encodeURIComponent(id),{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:id,message:{raw:raw}})
    });
    const data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error((data.error&&data.error.message)||'Could not prepare the linked Gmail draft for sending.');
    return data;
  }
  async function sendGmailDraft(id){
    const r=await gmailTrackedFetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
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
    const noModelFollowUp=!!(d&&d.purpose==='followup'&&!(Array.isArray(d.modelIds)&&d.modelIds.length)&&!(Array.isArray(d.models)&&d.models.length));
    if(noModelFollowUp){
      db.followUps=Array.isArray(db.followUps)?db.followUps:[];
      let item=db.followUps.find(function(x){return messageId&&x.gmailMessageId===messageId});
      if(!item){
        item={
          id:'gmail-followup-'+(messageId||randomHex(8)),
          date:date,
          draftId:(d&&d.id)||'',
          contact:(d&&d.contactName)||'',
          company:(d&&(d.company||d.brandProject))||'',
          email:to||(d&&d.recipientEmail)||'',
          project:(d&&(d.brandProject||d.company))||subject||(d&&d.subject)||'',
          subject:subject||(d&&d.subject)||'',
          gmailMessageId:messageId||'',
          gmailUrl:gmailUrl,
          source:'Work Gmail tracked follow-up'
        };
        db.followUps.push(item);
      }
      Object.assign(item,{
        gmailMessageId:messageId||item.gmailMessageId||'',
        gmailUrl:gmailUrl||item.gmailUrl||'',
        openTrackingId:(d&&d.openTrackingId)||item.openTrackingId||'',
        openTrackingState:'armed',
        openTrackingArmedAt:nowIso(),
        openTrackingCount:0,
        openTrackingError:'',
        openTrackingLastDetectedAt:'',
        openTrackingFirstDetectedAt:'',
        openTrackingLastCheckedAt:'',
        source:'Work Gmail tracked follow-up'
      });
      return;
    }
    const priorForDraft=!!(d&&d.id&&(db.submissions||[]).some(function(x){return x.draftId===d.id&&x.gmailMessageId}));
    let sub=(db.submissions||[]).find(function(x){
      if(messageId&&x.gmailMessageId===messageId)return true;
      return !!(d&&d.id&&x.draftId===d.id&&x.date===date&&!x.gmailMessageId);
    });
    if(!sub){
      let modelNames=[];
      try{modelNames=(d.modelIds||[]).map(id=>(db.models||[]).find(m=>m.id===id)?.name).filter(Boolean)}catch(err){}
      if(!modelNames.length&&d&&Array.isArray(d.models))modelNames=d.models.slice();
      sub={
        id:'gmail-sent-'+(messageId||randomHex(8)),
        date:date,
        draftId:(d&&d.id)||'',
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
      if(!priorForDraft){
        try{if(typeof autoFollowUpForSubmission==='function')autoFollowUpForSubmission(sub)}catch(err){}
      }
    }
    Object.assign(sub,{
      gmailMessageId:messageId||sub.gmailMessageId||'',
      gmailUrl:gmailUrl||sub.gmailUrl||'',
      openTrackingId:(d&&d.openTrackingId)||sub.openTrackingId||'',
      openTrackingState:'armed',
      openTrackingArmedAt:nowIso(),
      openTrackingCount:0,
        openTrackingError:'',
        openTrackingLastDetectedAt:'',
      openTrackingFirstDetectedAt:'',
      openTrackingLastCheckedAt:'',
      source:'Work Gmail tracked send'
    });
    try{if(typeof window.clmMarkModelSignalSent==='function')window.clmMarkModelSignalSent(d,sub)}catch(err){console.warn('Model-signal update failed; Gmail send remains confirmed.',err)}
  }

  async function sendTrackedCurrentDraft(){
    if(sendBusy)throw new Error('A tracked send is already in progress.');
    const target=draftTarget();
    const d=currentDraft();
    if(d?.openTrackingState==='send-uncertain')throw new Error('Check Sent Mail before retrying this uncertain send.');
    if(!d||!d.gmailDraftId||!d.openTrackingId)throw new Error('Create or update this email as a Work Gmail draft first.');
    sendBusy=true;renderTrackerStatus();
    try{
    const linkedDraftId=d.gmailDraftId;
    if(typeof setStatus==='function')setStatus('Loading the linked Gmail draft…');
    let encoded=await loadGmailDraftRaw(linkedDraftId);
    let mime=base64UrlToUtf8(encoded);
    const to=topHeader(mime,'To')||d.recipientEmail||'';
    const subject=decodeMimeHeader(topHeader(mime,'Subject'))||d.subject||'Model package';
    let repeat='';
    if(d.submittedAt){
      let prior='';
      try{prior=new Date(d.submittedAt).toLocaleString()}catch(err){}
      repeat='\n\nThis CRM draft has already been sent'+(prior?' on '+prior:'')+'. This will send another email.';
    }
    const okay=window.confirm('Send this tracked Gmail draft now?\n\nTo: '+to+'\nSubject: '+subject+repeat+'\n\nThis sends immediately. Open tracking is an approximate image-load signal, not a guaranteed human read.');
    if(!okay)return;

    const sendTrackingId=randomHex(14);
    mime=setTopHeader(mime,'X-CLM-Tracking-ID',sendTrackingId);
    mime=setTopHeader(mime,'X-CLM-Tracking-State','armed');
    mime=injectPixel(mime,sendTrackingId);
    encoded=utf8ToBase64Url(mime);

    patchTarget(target,{
      openTrackingId:sendTrackingId,
      openTrackingState:'arming',
      openTrackingCount:0,
        openTrackingError:'',
        openTrackingLastDetectedAt:'',
      openTrackingFirstDetectedAt:'',
      openTrackingLastCheckedAt:''
    });
    let phase='prepare';
    try{
      if(typeof setStatus==='function')setStatus('Preparing the linked Gmail draft…');
      await counterValue(sendTrackingId);
      await updateGmailDraft(linkedDraftId,encoded);
      phase='send';
      patchTarget(target,{openTrackingState:'send-uncertain'});
      if(typeof setStatus==='function')setStatus('Sending through Work Gmail…');
      if(typeof persistWorkspaceSafe==='function')await persistWorkspaceSafe(false);
      if(typeof idbWriteQueue!=='undefined')await idbWriteQueue;
      const sent=await sendGmailDraft(linkedDraftId);
      const messageId=(sent&&sent.id)||(sent&&sent.message&&sent.message.id)||'';
      if(!messageId)throw new Error('Gmail returned no sent message ID. Check Sent Mail.');
      const sentAt=nowIso();
      const gmailUrl=messageId?'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL)+'#sent/'+messageId:'';
      patchTarget(target,{
        gmailDraftId:'',
        gmailMessageId:messageId,
        gmailUrl:gmailUrl,
        submittedAt:sentAt,
        submittedDate:nyDate(),
        submissionStatus:'Submitted',
        openTrackingId:sendTrackingId,
        openTrackingState:'armed',
        openTrackingArmedAt:sentAt,
        openTrackingCount:0,
        openTrackingError:'',
        openTrackingLastDetectedAt:'',
        openTrackingFirstDetectedAt:'',
        openTrackingLastCheckedAt:''
      });
      const updated=patchTarget(target,{});
      recordTrackedSubmission(updated,messageId,to,subject);
      db.settings=Object.assign({},db.settings||{},{openTrackingVersion:TRACK_VERSION});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      renderTrackerStatus();
      if(typeof setStatus==='function')setStatus('Tracked email sent successfully. The CRM will check for open signals while it is open.');
      try{window.alert('Tracked email sent successfully to '+to+'.')}catch(err){}
      if(typeof window.clmSyncSentMail==='function')setTimeout(function(){window.clmSyncSentMail()},1500);
      setTimeout(function(){checkOpens(false,true)},45000);
    }catch(err){
      if(phase==='send'){
        err.clmSendUncertain=true;
        patchTarget(target,{openTrackingState:'send-uncertain'});
      }else{
        patchTarget(target,{openTrackingState:'ready'});
      }
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      renderTrackerStatus();
      throw err;
    }
    }finally{sendBusy=false;renderTrackerStatus()}
  }

  function installDraftCreationHook(){
    if(typeof createFormattedWorkGmailDraft!=='function'||createFormattedWorkGmailDraft.__clmOpenTracking)return;
    const original=createFormattedWorkGmailDraft;
    const wrapped=async function(){
      if(currentDraft()?.openTrackingState==='send-uncertain')throw new Error('Check Sent Mail and resolve the uncertain send before creating another draft.');
      if(sendBusy)throw new Error('Wait for the current send to finish.');
      if(typeof saveDraft==='function')saveDraft();
      const target=draftTarget();
      const result=await original.apply(this,arguments);
      const id=randomHex(14);
      patchTarget(target,{
        gmailDraftId:(result&&result.id)||'',
        gmailDraftMessageId:(result&&result.message&&result.message.id)||'',
        openTrackingId:id,
        openTrackingState:'ready',
        openTrackingCreatedAt:nowIso(),
        openTrackingCount:0,
        openTrackingError:'',
        openTrackingLastDetectedAt:'',
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
  function installTrackingPanel(){
    if(q('#openTrackingPanel'))return;
    const anchor=q('#gmailApiPanel');
    if(!anchor)return;
    const panel=document.createElement('section');
    panel.id='openTrackingPanel';panel.className='field';panel.setAttribute('aria-label','Email open tracking');
    panel.innerHTML=`<style>
      #openTrackingPanel{border:1px solid var(--line,#d8dfe8);border-radius:12px;padding:16px;margin:16px 0;background:var(--panel,#fff);font-size:14px}
      #openTrackingPanel h3{margin:0 0 8px;font-size:18px}
      #openTrackingPanel .tracking-help{line-height:1.55;margin:10px 0;color:var(--muted,#536174)}
      #openTrackingPanel .tracking-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
      #openTrackingPanel .tracking-tools input{flex:1;min-width:140px}
      #openTrackingPanel .tracking-tools select{width:auto;max-width:100%}
      #openTrackingPanel .tracking-list{max-height:460px;overflow:auto}
      #openTrackingPanel .tracking-item{border-top:1px solid var(--line,#d8dfe8);padding:12px 0;overflow-wrap:anywhere}
      #openTrackingPanel .tracking-item-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #openTrackingPanel .tracking-meta{font-size:13px;color:var(--muted,#536174);line-height:1.6;margin:5px 0}
      #openTrackingPanel .tracking-error{color:#a22c25;margin-top:5px}
      #trackingCheckResult{margin-top:8px;line-height:1.5}
      #openTrackingPanel button,#openTrackingPanel input,#openTrackingPanel select{font-size:14px}
    </style><h3>Email open tracking</h3>
    <div id="trackingSummary"></div>
    <p class="tracking-help">Create a formatted Gmail draft below, review it in Gmail, then return here to send with tracking. Sending directly in Gmail does not enable this tracker.</p>
    <div id="trackingActions" class="actions"></div>
    <div id="trackingCheckResult" role="status" aria-live="polite"></div>
    <details><summary>What the results mean</summary><p class="tracking-help">Signals mean the tracking address was requested, not proof that your casting director read the email. Your own views, CC recipients and privacy tools may trigger signals; blocked images and mail proxies may hide opens or repeat views. This legacy counter does not return a normal image, so some mail apps may not load it. No signal does not mean unread.</p><p class="tracking-help">Checks run about once a minute while this CRM is open. Background tabs may check less often. Automatic checks cover the last 45 days; older results stay in history. Times show when the CRM detected a signal, in your device’s timezone.</p></details>
    <div class="tracking-tools"><input id="trackingSearch" type="search" aria-label="Search tracked emails" placeholder="Search brand, recipient or model"><select id="trackingFilter" aria-label="Filter tracked emails"><option value="all">All tracked emails</option><option value="signals">With signals</option><option value="waiting">Awaiting signal</option><option value="ready">Ready to send</option><option value="attention">Needs attention</option></select></div>
    <div id="trackingHistory" class="tracking-list"></div>`;
    anchor.insertAdjacentElement('afterend',panel);
    ['sendTrackedDraftBtn','enableOpenNotificationsBtn','testOpenNotificationsBtn','checkOpenTrackingBtn'].forEach(id=>{
      const button=q('#'+id);if(button)q('#trackingActions').appendChild(button);
    });
    q('#trackingSearch').addEventListener('input',renderTrackingHistory);
    q('#trackingFilter').addEventListener('change',renderTrackingHistory);
    panel.addEventListener('click',event=>{
      const button=event.target.closest('button[data-track-action]');if(!button)return;
      const record=trackingRecords(true,true).find(r=>r.openTrackingId===button.dataset.trackId);if(!record)return;
      const draftId=record.draftId||record.id;
      if(button.dataset.trackAction==='package'&&typeof loadDraft==='function')loadDraft(draftId);
      if(button.dataset.trackAction==='resolve'){
        if(!window.confirm('Have you checked Work Gmail Sent Mail and confirmed this email was NOT sent?\n\nContinue only if it is absent. The existing Gmail draft will be relinked when you create the formatted draft again.'))return;
        patchTracker(record,{openTrackingState:'ready',openTrackingError:''});
        if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
        renderTrackerStatus();
      }
    });
  }
  function trackingState(record){
    if(record.openTrackingState==='send-uncertain')return {key:'attention',label:'Send unconfirmed'};
    if(record.openTrackingError)return {key:'attention',label:'Check failed'};
    if(Number(record.openTrackingCount||0)>0)return {key:'signals',label:'Signal detected'};
    if(record.openTrackingState==='armed')return {key:'waiting',label:'No signal yet'};
    if(record.openTrackingState==='ready'&&record.gmailDraftId)return {key:'ready',label:'Ready to send'};
    return {key:'other',label:'Not tracking'};
  }
  function formatTrackingTime(value){
    const date=new Date(value);return value&&Number.isFinite(date.getTime())?date.toLocaleString():'—';
  }
  function formatResponseTime(minutes){
    const n=Number(minutes);if(!Number.isFinite(n)||n<0)return '—';
    if(n<60)return Math.round(n)+'m';
    if(n<1440)return (n/60).toFixed(n<180?1:0)+'h';
    return (n/1440).toFixed(n<4320?1:0)+'d';
  }
  function renderTrackingHistory(){
    const el=q('#trackingHistory');if(!el)return;
    const search=String(q('#trackingSearch')?.value||'').toLowerCase().trim();
    const filter=q('#trackingFilter')?.value||'all';
    const records=trackingRecords(true,true).filter(record=>{
      const text=[record.brandProject,record.project,record.company,record.recipientEmail,record.email,record.subject,...(Array.isArray(record.models)?record.models:[])].join(' ').toLowerCase();
      return (!search||text.includes(search))&&(filter==='all'||trackingState(record).key===filter);
    }).sort((a,b)=>(Date.parse(b.submittedAt||b.openTrackingArmedAt||b.openTrackingCreatedAt||b.date)||0)-(Date.parse(a.submittedAt||a.openTrackingArmedAt||a.openTrackingCreatedAt||a.date)||0));
    el.innerHTML=records.length?records.map(record=>{
      const state=trackingState(record),draftId=record.draftId||record.id;
      const hasDraft=(db.drafts||[]).some(d=>d.id===draftId);
      const messageId=record.openTrackingState==='ready'?'':record.gmailMessageId;
      const href='https://mail.google.com/mail/u/?authuser='+encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL)+(messageId?'#sent/'+encodeURIComponent(messageId):record.openTrackingState==='send-uncertain'?'#sent':'#drafts');
      const sent=record.openTrackingState==='ready'?'':record.openTrackingArmedAt||record.submittedAt;
      return '<article class="tracking-item"><div class="tracking-item-head"><strong>'+safe(record.brandProject||record.project||record.company||record.subject||'Model package')+'</strong><span>'+safe(state.label)+'</span></div>'+
        '<div class="tracking-meta">'+safe(record.recipientEmail||record.email||'Recipient not recorded')+'<br>'+safe(record.subject||'')+'</div>'+
        (record.models?.length?'<div class="tracking-meta">Models: '+safe(record.models.join(', '))+'</div>':'')+
        '<div class="tracking-meta">'+(sent?'Sent: '+safe(formatTrackingTime(sent))+' · ':'')+'Signals: '+Number(record.openTrackingCount||0)+
        '<br>First detected: '+safe(formatTrackingTime(record.openTrackingFirstDetectedAt))+'<br>Latest detected: '+safe(formatTrackingTime(record.openTrackingLastDetectedAt))+'<br>Last checked: '+safe(formatTrackingTime(record.openTrackingLastCheckedAt))+((record.emailResponseTimeMinutes!=null&&Number.isFinite(Number(record.emailResponseTimeMinutes)))?'<br>Response time: '+safe(formatResponseTime(record.emailResponseTimeMinutes)):'')+'</div>'+
        (record.openTrackingError?'<div class="tracking-error">'+safe(record.openTrackingError)+'</div>':'')+
        (record.openTrackingState==='send-uncertain'?'<p>Check Sent Mail before retrying to avoid sending twice. If sent, use Sync sent mail now to confirm the result.</p>':'')+
        '<div class="actions"><a class="btn" target="_blank" rel="noopener" href="'+safe(href)+'">'+(messageId?'View sent email':record.openTrackingState==='send-uncertain'?'Check Sent Mail':'Review in Gmail')+'</a>'+
        (hasDraft?'<button class="btn" type="button" data-track-action="package" data-track-id="'+safe(record.openTrackingId)+'">Open package</button>':'')+
        (record.openTrackingState==='send-uncertain'?'<button class="btn" type="button" data-track-action="resolve" data-track-id="'+safe(record.openTrackingId)+'">I confirmed it was not sent</button>':'')+'</div></article>';
    }).join(''):'<p class="tracking-help">'+(search||filter!=='all'?'No emails match this filter.':'No tracked emails yet. Create a formatted Gmail draft to get started. Previously sent, untracked emails cannot be tracked retroactively.')+'</p>';
    const status=q('#trackingCheckResult');
    if(status)status.textContent=trackChecking?'Checking tracked emails…':db.settings?.openTrackingCheckSummary||'';
  }

  function installButtons(){
    const panel=q('#trackingActions');
    if(!panel)return;
    let send=q('#sendTrackedDraftBtn');
    if(!send){
      send=document.createElement('button');
      send.type='button';send.id='sendTrackedDraftBtn';send.className='btn primary';send.textContent='Send tracked draft';
      panel.appendChild(send);
    }
    if(send.dataset.clmBound!=='1'){
      send.dataset.clmBound='1';
      send.addEventListener('click',function(){
        if(send.disabled)return;
        const oldText=send.textContent;
        send.disabled=true;
        send.textContent='Sending…';
        sendTrackedCurrentDraft().catch(function(err){
          console.error('Tracked send failed',err);
          const message=err&&err.message?err.message:String(err);
          if(err&&err.clmSendUncertain){
            if(typeof setStatus==='function')setStatus('Gmail did not confirm the send. Check Sent Mail before retrying.');
            try{window.alert('Gmail did not confirm whether this message sent. Check Work Gmail Sent Mail before retrying.\n\n'+message);}catch(alertErr){}
          }else{
            if(typeof setStatus==='function')setStatus('Tracked send failed before sending: '+message);
            try{window.alert('Tracked send failed before Gmail sent the message.\n\n'+message);}catch(alertErr){}
          }
          renderTrackerStatus();
        }).finally(function(){
          send.textContent=oldText;
          renderTrackerStatus();
        });
      });
    }

    let alerts=q('#enableOpenNotificationsBtn');
    if(!alerts){
      alerts=document.createElement('button');
      alerts.type='button';alerts.id='enableOpenNotificationsBtn';alerts.className='btn';alerts.textContent='Enable open alerts';
      panel.appendChild(alerts);
    }
    if(alerts.dataset.clmBound!=='1'){
      alerts.dataset.clmBound='1';
      alerts.addEventListener('click',function(){
        if(notificationPermission()==='granted'&&db.settings?.openAlertsEnabled!==false){
          db.settings.openAlertsEnabled=false;
          if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
          renderTrackerStatus();return;
        }
        enableOpenNotifications().catch(function(err){
          console.error('Notification setup failed',err);
          try{window.alert(err&&err.message?err.message:String(err));}catch(alertErr){}
        });
      });
    }

    let test=q('#testOpenNotificationsBtn');
    if(!test){
      test=document.createElement('button');
      test.type='button';test.id='testOpenNotificationsBtn';test.className='btn';test.textContent='Test alert';
      panel.appendChild(test);
    }
    if(test.dataset.clmBound!=='1'){
      test.dataset.clmBound='1';
      test.addEventListener('click',function(){testOpenNotification().catch(function(err){
        console.error('Notification test failed',err);
        if(typeof setStatus==='function')setStatus(err&&err.message?err.message:String(err));
      })});
    }

    let check=q('#checkOpenTrackingBtn');
    if(!check){
      check=document.createElement('button');
      check.type='button';check.id='checkOpenTrackingBtn';check.className='btn';check.textContent='Check opens now';
      panel.appendChild(check);
    }
    if(check.dataset.clmBound!=='1'){
      check.dataset.clmBound='1';
      check.addEventListener('click',function(){checkOpens(true,true)});
    }
  }
  function startTimer(){
    if(trackTimer)clearInterval(trackTimer);
    trackTimer=setInterval(function(){checkOpens(false,true)},TRACK_POLL_MS);
    window.addEventListener('focus',function(){checkOpens(false,true)});
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')checkOpens(false,true)});
    window.addEventListener('online',function(){checkOpens(false,true)});
  }
  function init(){
    try{
      installTrackingPanel();
      installDraftCreationHook();
      installDraftCardHook();
      installRenderHook();
      installButtons();
      startTimer();
      if(notificationPermission()==='granted')notificationRegistration();
      db.settings=Object.assign({},db.settings||{},{openTrackingVersion:TRACK_VERSION});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      renderTrackerStatus();
      setTimeout(function(){checkOpens(false,true)},3000);
    }catch(err){
      console.error('CLM open tracking failed to initialize',err);
    }
  }

  window.clmSendTrackedDraft=function(){
    return sendTrackedCurrentDraft().catch(function(err){
      console.error(err);
      const message=err&&err.message?err.message:String(err);
      if(err&&err.clmSendUncertain){
        if(typeof setStatus==='function')setStatus('Gmail did not confirm the send. Check Sent Mail before retrying.');
        try{window.alert('Gmail did not confirm whether this message sent. Check Work Gmail Sent Mail before retrying.\n\n'+message);}catch(alertErr){}
      }else{
        if(typeof setStatus==='function')setStatus('Tracked send failed before sending: '+message);
        try{window.alert('Tracked send failed before Gmail sent the message.\n\n'+message);}catch(alertErr){}
      }
      renderTrackerStatus();
      throw err;
    });
  };
  window.clmCheckEmailOpens=function(){return checkOpens(true,true)};
  window.clmEnableOpenNotifications=function(){return enableOpenNotifications()};
  window.clmTestOpenNotification=function(){return testOpenNotification()};

  function initWhenReady(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db&&q('#gmailApiPanel')){
      init();
      return;
    }
    if(attempt<100)setTimeout(function(){initWhenReady(attempt+1)},100);
    else console.error('CLM open tracking could not find a ready CRM workspace.');
  }
  initWhenReady(0);
})();
