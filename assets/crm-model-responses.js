/* CLM CRM recent model requests / responses · 2026-09-25
   Syncs recent inbound Work Gmail messages, ties them to roster/package models,
   and renders a compact dashboard feed on Today. */
(function(){
  'use strict';
  if(window.__clmModelResponsesLoaded)return;
  window.__clmModelResponsesLoaded=true;

  const VERSION='2026-09-25-v1';
  const AUTO_INTERVAL_MS=5*60*1000;
  const LOOKBACK_DAYS=21;
  const FETCH_LIMIT=60;
  const KEEP_DAYS=60;
  let syncRunning=false;
  let timer=null;

  const VERIFIED_SEED=[
    {
      id:'gmail-1a0d8e856737ff49',gmailMessageId:'1a0d8e856737ff49',threadId:'1a0d8e856737ff49',
      date:'2026-09-25T14:11:03Z',kind:'Request',project:'OTTOLINGER SS27',
      fromName:'Ester DiLorenzo',fromEmail:'assistance@jesuiscasting.com',
      subject:'OTTOLINGER SS27 - CASTING / CHEZ LES MANNEQUINS',models:['Malia'],
      excerpt:'Initial option list: Malia requested to attend the September 29 casting.',
      source:'Verified Work Gmail'
    },
    {
      id:'gmail-1a0d798b2825c27d',gmailMessageId:'1a0d798b2825c27d',threadId:'1a0d798b2825c27d',
      date:'2026-09-25T08:05:00Z',kind:'Request',project:'WEINSANTO S/S 2027',
      fromName:'Remi Felipe',fromEmail:'remi.felipe@gmail.com',
      subject:'WEINSANTO SHOW SUMMER 2027',models:['Maja Stockwell','Mary','Sal'],
      excerpt:'Requested Maja, Mary and Sal for the September 25 Paris casting.',
      source:'Verified Work Gmail'
    },
    {
      id:'gmail-1a0d4ab65adadd51',gmailMessageId:'1a0d4ab65adadd51',threadId:'1a0d49a163f8264d',
      date:'2026-09-24T18:26:25Z',kind:'Request',project:'VIDIC COLLECTION - SEPT.30 PARIS',
      fromName:'Remi Felipe',fromEmail:'remi.felipe@gmail.com',
      subject:'Re: VIDIC COLLECTION - SEPT.30 PARIS',models:['Malia','Mary'],
      excerpt:'Remi asked to check Malia and Mary after reviewing the CLM suggestions.',
      source:'Verified Work Gmail'
    },
    {
      id:'gmail-1a0b9a338a31336b',gmailMessageId:'1a0b9a338a31336b',threadId:'1a0b5027eb8709ed',
      date:'2026-09-19T12:27:42Z',kind:'Pass',project:'Anteprima S/S 2027',
      fromName:'Federica Ciuci Priori',fromEmail:'federicaciucipriori@gmail.com',
      subject:'Re: S/S 2027 Model Package — Anteprima',
      models:['Molly','Maja Stockwell','Bianca','Ambre Prognitz','Claudia Lucchini','Callie Steg','Seven','Rachel','Malia','Lana'],
      excerpt:'Casting replied that none of the submitted proposals fit the collection at the moment.',
      source:'Verified Work Gmail'
    },
    {
      id:'gmail-1a0b5274ed090d14',gmailMessageId:'1a0b5274ed090d14',threadId:'1a0b4dc2db7e822b',
      date:'2026-09-18T15:33:51Z',kind:'Response',project:'Max Mara S/S 2027',
      fromName:'Giulia Massullo',fromEmail:'',subject:'Re: S/S 2027 Model Package — Max Mara',
      models:['Agang','Clara','Ambre Prognitz','Seven','Sophia Pippen','Mary','Callie Steg','Rachel','Claudia Lucchini'],
      excerpt:'DMCASTING acknowledged the package and said they would keep CLM posted.',
      source:'Verified Work Gmail'
    }
  ];

  function nowIso(){return new Date().toISOString()}
  function escHtml(value){
    if(typeof esc==='function')return esc(String(value||''));
    return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
  }
  function ensureStore(){
    if(typeof db==='undefined'||!db)return [];
    if(!Array.isArray(db.modelInteractions))db.modelInteractions=[];
    return db.modelInteractions;
  }
  function seedVerified(){
    const store=ensureStore();
    let changed=false;
    VERIFIED_SEED.forEach(function(seed){
      const existing=store.find(function(x){return String(x.gmailMessageId||x.id||'')===seed.gmailMessageId});
      if(existing){
        if(existing.source==='Verified Work Gmail')Object.assign(existing,seed);
        return;
      }
      store.push(Object.assign({},seed));
      changed=true;
    });
    if(changed&&typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
  }
  function emailList(value){
    return Array.from(new Set((String(value||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(function(x){return x.toLowerCase()})));
  }
  function header(message,name){
    const headers=(message&&message.payload&&message.payload.headers)||[];
    const hit=headers.find(function(h){return String(h.name||'').toLowerCase()===String(name||'').toLowerCase()});
    return hit?String(hit.value||''):'';
  }
  function senderParts(message){
    const raw=header(message,'From');
    const emails=emailList(raw);
    const email=emails[0]||'';
    let name=raw.replace(/<[^>]+>/g,'').replace(/^\s*["']|["']\s*$/g,'').trim();
    if(!name||name===email)name=email;
    return {name:name,email:email,raw:raw};
  }
  function internalAddress(email){
    email=String(email||'').toLowerCase();
    if(!email)return false;
    const work=String(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL).toLowerCase();
    const cc=String(typeof AGENT_CC==='undefined'?'':AGENT_CC).toLowerCase();
    return email===work||email===cc||/@chezlesmannequins\.com$/i.test(email)||email==='fatimah.chezlesmannequins@gmail.com';
  }
  function isBounceOrAuto(message){
    const subject=header(message,'Subject').toLowerCase();
    const from=header(message,'From').toLowerCase();
    const auto=[header(message,'Auto-Submitted'),header(message,'X-Autoreply'),header(message,'X-Autorespond'),header(message,'Precedence')].join(' ').toLowerCase();
    return /mailer-daemon|postmaster|mail delivery subsystem|delivery status notification/.test(from+' '+subject) ||
      /delivery incomplete|undeliverable|delivery failed|returned mail/.test(subject) ||
      /out of office|automatic reply|auto[- ]?reply|vacation reply/.test(subject) ||
      (auto&&/auto|vacation|bulk|list|junk/.test(auto));
  }
  function decodeBase64Url(value){
    if(!value)return '';
    let raw=String(value).replace(/-/g,'+').replace(/_/g,'/');
    while(raw.length%4)raw+='=';
    try{
      const binary=atob(raw);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }catch(err){return ''}
  }
  function htmlToText(value){
    if(!value)return '';
    try{
      const template=document.createElement('template');
      template.innerHTML=String(value);
      template.content.querySelectorAll('style,script,noscript').forEach(function(el){el.remove()});
      return String(template.content.textContent||'').replace(/\u00a0/g,' ');
    }catch(err){return String(value).replace(/<[^>]+>/g,' ')}
  }
  function messageText(message){
    const plain=[],html=[];
    function walk(part){
      if(!part)return;
      const mime=String(part.mimeType||'').toLowerCase();
      const data=part.body&&part.body.data?decodeBase64Url(part.body.data):'';
      if(data&&mime==='text/plain')plain.push(data);
      else if(data&&mime==='text/html')html.push(data);
      (part.parts||[]).forEach(walk);
    }
    walk(message&&message.payload);
    const value=plain.length?plain.join('\n'):html.map(htmlToText).join('\n');
    return (value||String(message&&message.snippet||'')).replace(/\r/g,'');
  }
  function topMessage(text){
    text=String(text||'').replace(/\r/g,'').trim();
    if(!text)return '';
    const markers=[
      /^On .+wrote:\s*$/im,
      /^Il giorno .+ ha scritto:\s*$/im,
      /^Le .+ a écrit\s*:\s*$/im,
      /^-{2,}\s*Forwarded message\s*-{2,}\s*$/im,
      /^From:\s.+$/im,
      /^_{5,}\s*$/im
    ];
    let cut=-1;
    markers.forEach(function(re){const m=re.exec(text);if(m&&m.index>20&&(cut<0||m.index<cut))cut=m.index});
    if(cut>0)text=text.slice(0,cut);
    return text.replace(/\n{3,}/g,'\n\n').trim();
  }
  function normalize(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function containsPhrase(hay,needle){
    hay=' '+normalize(hay)+' ';
    needle=normalize(needle);
    return needle&&hay.indexOf(' '+needle+' ')>=0;
  }
  function rosterMatches(text){
    if(typeof db==='undefined'||!db||!Array.isArray(db.models))return [];
    const models=db.models.filter(function(m){return m&&m.name&&m.activeBoard!==false});
    const firstCounts={};
    models.forEach(function(m){const f=normalize(m.name).split(' ')[0];if(f)firstCounts[f]=(firstCounts[f]||0)+1});
    const out=[];
    models.forEach(function(m){
      const full=normalize(m.name),first=full.split(' ')[0];
      if(containsPhrase(text,full)||(first&&first.length>=3&&firstCounts[first]===1&&containsPhrase(text,first))){
        if(!out.includes(m.name))out.push(m.name);
      }
    });
    return out;
  }
  function explicitRequestNames(text){
    const out=[];
    const clean=String(text||'').replace(/\r/g,'');
    const lines=clean.split('\n').map(function(x){return x.trim()});
    const stop=/^(important|casting|fitting|show|date|location|time|rate|usage|usages|thank|best|many thanks|creative director|hair|glam|line-?up|attending guests)/i;
    for(let i=0;i<lines.length;i++){
      if(!/^(models? requested|request|requested names|initial option list)\s*:??\s*$/i.test(lines[i]))continue;
      for(let j=i+1;j<Math.min(lines.length,i+10);j++){
        const line=lines[j];
        if(!line)continue;
        if(stop.test(line))break;
        if(/^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.-]{1,24}(?:\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.-]{1,24}){0,2}$/.test(line))out.push(line.replace(/\s+/g,' ').toLowerCase().replace(/(^|\s)[a-zà-öø-ÿ]/g,function(c){return c.toUpperCase()}));
      }
    }
    const check=/\b(?:check on|check|request(?:ing|ed)?|option(?:ing|ed)?)\s*:\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.-]*(?:\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’.-]*){0,5})/g;
    let m;
    while((m=check.exec(clean))){
      m[1].trim().split(/\s+/).forEach(function(name){if(name.length>=3)out.push(name.charAt(0)+name.slice(1).toLowerCase())});
    }
    return Array.from(new Set(out));
  }
  function normalizeModelNames(names){
    const roster=(typeof db!=='undefined'&&db&&Array.isArray(db.models))?db.models:[];
    return Array.from(new Set((names||[]).map(function(name){
      const n=normalize(name);
      const hit=roster.find(function(m){
        const full=normalize(m.name),first=full.split(' ')[0];
        return n===full||n===first;
      });
      return hit?hit.name:String(name||'').trim();
    }).filter(Boolean)));
  }
  function normalizeSubject(value){
    return normalize(String(value||'').replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,''));
  }
  function submissionModelsFor(message){
    if(typeof db==='undefined'||!db)return [];
    const subject=normalizeSubject(header(message,'Subject'));
    if(!subject)return [];
    const sources=[].concat(db.submissions||[],db.drafts||[]);
    const candidates=sources.filter(function(record){
      return record&&normalizeSubject(record.subject||'')===subject&&Array.isArray(record.models)&&record.models.length;
    }).sort(function(a,b){
      return (Date.parse(b.submittedAt||b.date||0)||0)-(Date.parse(a.submittedAt||a.date||0)||0);
    });
    if(candidates[0])return candidates[0].models.slice();
    return [];
  }
  function classify(text){
    const n=normalize(text);
    if(/\b(none of (them|these).{0,20}fit|not a fit|not right for|unfortunately.{0,80}(fit|move forward|pass)|passing on|will not be moving forward|won t be moving forward)\b/.test(n))return 'Pass';
    if(/\b(models? requested|initial option list|request|requested|check on|can we check|can we please check|casting request|callback|hold|option list|optioned|first option|second option|fitting request|go see)\b/.test(n))return 'Request';
    return 'Response';
  }
  function projectFrom(message){
    let s=String(header(message,'Subject')||'').replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').trim();
    s=s.replace(/\s*[-—|]\s*(casting\s*\/\s*chez les mannequins|chez les mannequins)\s*$/i,'').trim();
    return s||'Casting response';
  }
  function excerpt(text,kind,models){
    let value=String(text||'').replace(/\s+/g,' ').trim();
    if(value.length>230)value=value.slice(0,227).trim()+'…';
    if(value)return value;
    return kind==='Request'?'Requested '+models.join(', ')+'.':'Response received.';
  }
  function messageTimeIso(message){
    const ms=Number(message&&message.internalDate);
    return new Date(Number.isFinite(ms)&&ms>0?ms:(Date.parse(header(message,'Date'))||Date.now())).toISOString();
  }
  function upsertInteraction(record){
    const store=ensureStore();
    const key=String(record.gmailMessageId||record.id||'');
    const existing=store.find(function(x){return String(x.gmailMessageId||x.id||'')===key});
    if(existing)Object.assign(existing,record);
    else store.push(record);
  }
  function prune(){
    const store=ensureStore();
    const cutoff=Date.now()-KEEP_DAYS*24*60*60*1000;
    db.modelInteractions=store.filter(function(x){const t=Date.parse(x.date||0);return !Number.isFinite(t)||t>=cutoff||x.source==='Verified Work Gmail'});
  }
  async function gmailJson(token,url){
    const controller=new AbortController();
    const timeout=setTimeout(function(){controller.abort()},30000);
    try{
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(function(){return {}});
      if(!response.ok)throw new Error((data&&data.error&&data.error.message)||('Gmail request failed ('+response.status+').'));
      return data;
    }finally{clearTimeout(timeout)}
  }
  async function listInbox(token){
    const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q','in:inbox newer_than:'+LOOKBACK_DAYS+'d');
    url.searchParams.set('maxResults',String(FETCH_LIMIT));
    const data=await gmailJson(token,url.toString());
    return data.messages||[];
  }
  async function fullMessage(token,id){
    const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(id));
    url.searchParams.set('format','full');
    return gmailJson(token,url.toString());
  }
  async function syncModelResponses(showStatus){
    if(syncRunning)return;
    syncRunning=true;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Checking Work Gmail for model requests and responses…');
      if(typeof gmailToken!=='function')throw new Error('Gmail connection is not ready.');
      const token=await gmailToken();
      const list=await listInbox(token);
      let scanned=0,kept=0;
      for(const item of list){
        if(!item||!item.id)continue;
        const message=await fullMessage(token,item.id);
        scanned++;
        const sender=senderParts(message);
        if(internalAddress(sender.email)||isBounceOrAuto(message))continue;
        const top=topMessage(messageText(message));
        let models=normalizeModelNames([].concat(rosterMatches(top),explicitRequestNames(top)));
        const kind=classify(top);
        if(!models.length&&(kind==='Response'||kind==='Pass'))models=normalizeModelNames(submissionModelsFor(message));
        if(!models.length)continue;
        const record={
          id:'gmail-'+item.id,
          gmailMessageId:item.id,
          threadId:message.threadId||'',
          date:messageTimeIso(message),
          kind:kind,
          project:projectFrom(message),
          fromName:sender.name,
          fromEmail:sender.email,
          subject:header(message,'Subject'),
          models:models,
          excerpt:excerpt(top,kind,models),
          source:'Work Gmail sync',
          syncedAt:nowIso()
        };
        upsertInteraction(record);kept++;
      }
      prune();
      db.settings=Object.assign({},db.settings||{},
        {modelResponsesVersion:VERSION,modelResponsesLastSyncAt:nowIso(),modelResponsesLastScanned:scanned,modelResponsesLastKept:kept});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      renderDashboard();
      if(showStatus&&typeof setStatus==='function')setStatus('Updated recent model requests/responses from '+scanned+' inbox message'+(scanned===1?'':'s')+'.');
    }catch(err){
      console.error('CLM model response sync failed',err);
      if(showStatus&&typeof setStatus==='function')setStatus('Model response sync failed: '+String(err&&err.message||err));
    }finally{syncRunning=false}
  }
  function fmtDate(value){
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return '';
    try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)}catch(err){return d.toLocaleString()}
  }
  function gmailHref(record){
    const auth=encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL);
    return 'https://mail.google.com/mail/u/?authuser='+auth+'#inbox/'+encodeURIComponent(record.gmailMessageId||'');
  }
  function recentRecords(){
    const cutoff=Date.now()-45*24*60*60*1000;
    return ensureStore().filter(function(x){
      const t=Date.parse(x.date||0);return !Number.isFinite(t)||t>=cutoff;
    }).sort(function(a,b){return (Date.parse(b.date||0)||0)-(Date.parse(a.date||0)||0)});
  }
  function renderDashboard(){
    const el=document.getElementById('modelResponseDashboard');
    if(!el)return;
    const rows=recentRecords();
    const requests=rows.filter(function(x){return x.kind==='Request'});
    const responseCount=rows.filter(function(x){return x.kind==='Response'||x.kind==='Pass'}).length;
    const requestedModels=Array.from(new Set(requests.flatMap(function(x){return x.models||[]})));
    const shown=rows.slice(0,8);
    const synced=db&&db.settings&&db.settings.modelResponsesLastSyncAt?fmtDate(db.settings.modelResponsesLastSyncAt):'';
    const style=`<style>
      #modelResponseDashboard{margin:14px 0 16px;border:1px solid var(--line,#d8dfe8);border-radius:12px;padding:14px;background:var(--panel,#fff)}
      #modelResponseDashboard .mr-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      #modelResponseDashboard .mr-head h3{margin:0 0 3px}
      #modelResponseDashboard .mr-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      #modelResponseDashboard .mr-metric{border:1px solid var(--line,#d8dfe8);border-radius:999px;padding:4px 9px;font-size:12px}
      #modelResponseDashboard .mr-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
      #modelResponseDashboard .mr-item{border:1px solid var(--line,#d8dfe8);border-radius:10px;padding:10px;min-width:0}
      #modelResponseDashboard .mr-row{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      #modelResponseDashboard .mr-kind{font-size:10px;font-weight:800;letter-spacing:.06em;border:1px solid var(--line,#d8dfe8);border-radius:999px;padding:2px 6px;white-space:nowrap}
      #modelResponseDashboard .mr-models{display:flex;gap:4px;flex-wrap:wrap;margin:7px 0}
      #modelResponseDashboard .mr-model{font-size:11px;font-weight:700;background:var(--soft,#f3f6f9);border-radius:999px;padding:2px 6px}
      #modelResponseDashboard .mr-excerpt{font-size:12px;line-height:1.4;color:var(--muted,#536174);margin-top:5px}
      #modelResponseDashboard .mr-meta{font-size:11px;color:var(--muted,#536174);margin-top:4px}
    </style>`;
    el.innerHTML=style+
      '<div class="mr-head"><div><h3>Recent model requests &amp; responses</h3><div class="muted tiny">Work Gmail intelligence'+(synced?' · last sync '+escHtml(synced):'')+'</div></div><button class="btn" type="button" onclick="clmSyncModelResponses(true)">Refresh responses</button></div>'+
      '<div class="mr-summary"><span class="mr-metric"><b>'+requests.length+'</b> requests</span><span class="mr-metric"><b>'+responseCount+'</b> responses / passes</span><span class="mr-metric"><b>'+requestedModels.length+'</b> models requested</span></div>'+
      (shown.length?'<div class="mr-list">'+shown.map(function(r){
        const models=(r.models||[]).slice(0,8);
        const more=(r.models||[]).length-models.length;
        return '<article class="mr-item"><div class="mr-row"><div><b>'+escHtml(r.project||r.subject||'Casting response')+'</b><div class="mr-meta">'+escHtml(r.fromName||r.fromEmail||'Casting')+' · '+escHtml(fmtDate(r.date))+'</div></div><span class="mr-kind">'+escHtml(r.kind||'Response')+'</span></div>'+
          '<div class="mr-models">'+models.map(function(name){return '<span class="mr-model">'+escHtml(name)+'</span>'}).join('')+(more>0?'<span class="mr-model">+'+more+'</span>':'')+'</div>'+
          '<div class="mr-excerpt">'+escHtml(r.excerpt||'')+'</div>'+
          (r.gmailMessageId?'<div style="margin-top:7px"><a class="btn" target="_blank" rel="noopener" href="'+escHtml(gmailHref(r))+'">Open email</a></div>':'')+
          '</article>';
      }).join('')+'</div>':'<div class="empty">No recent model requests or casting responses yet.</div>');
  }
  function installRenderHook(){
    if(typeof renderToday!=='function'||renderToday.__clmModelResponses)return;
    const original=renderToday;
    const wrapped=function(){const result=original.apply(this,arguments);setTimeout(renderDashboard,0);return result};
    wrapped.__clmModelResponses=true;
    renderToday=wrapped;
  }
  function startTimer(){
    if(timer)clearInterval(timer);
    timer=setInterval(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncModelResponses(false);
    },AUTO_INTERVAL_MS);
    window.addEventListener('clm:gmail-connected',function(){setTimeout(function(){syncModelResponses(false)},1600)});
  }
  function init(){
    ensureStore();
    seedVerified();
    installRenderHook();
    renderDashboard();
    startTimer();
    db.settings=Object.assign({},db.settings||{},{modelResponsesVersion:VERSION});
    if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    setTimeout(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncModelResponses(false);
    },3200);
  }
  function initWhenReady(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db&&document.getElementById('modelResponseDashboard')){init();return}
    if(attempt<100)setTimeout(function(){initWhenReady(attempt+1)},100);
    else console.error('CLM model response dashboard could not find a ready CRM workspace.');
  }

  window.clmRenderModelResponses=renderDashboard;
  window.clmSyncModelResponses=function(showStatus){return syncModelResponses(showStatus!==false)};
  initWhenReady(0);
})();
