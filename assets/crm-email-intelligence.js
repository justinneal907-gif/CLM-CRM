/* CLM CRM email intelligence · 2026-09-24
   Enriches CRM-linked sent emails with Gmail thread/reply metadata, exact send/reply
   timing, participant/contact signals, bounce/auto-reply detection, reply-topic
   signals, unread state, message size and a limited preview of the latest human reply.
   The system only scans Gmail messages already linked to CRM records; it does not
   crawl unrelated mailbox traffic. */
(function(){
  'use strict';
  if(window.__clmEmailIntelligenceLoaded)return;
  window.__clmEmailIntelligenceLoaded=true;

  const VERSION='2026-09-24-v1';
  const AUTO_INTERVAL_MS=5*60*1000;
  const AUTO_LIMIT=40;
  const MANUAL_LIMIT=160;
  const PREVIEW_LIMIT=1800;
  const FULL_REPLY_LIMIT_BYTES=1500000;
  let intelRunning=false;
  let intelTimer=null;

  function q(sel){return document.querySelector(sel)}
  function safe(value){
    if(typeof esc==='function')return esc(String(value||''));
    return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
  }
  function nowIso(){return new Date().toISOString()}
  function emailList(value){
    return Array.from(new Set((String(value||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(function(x){return x.toLowerCase()})));
  }
  function messageHeader(message,name){
    const headers=(message&&message.payload&&message.payload.headers)||[];
    const hit=headers.find(function(h){return String(h.name||'').toLowerCase()===String(name||'').toLowerCase()});
    return hit?String(hit.value||''):'';
  }
  function internalEmails(){
    return new Set([String(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL).toLowerCase(),String(typeof AGENT_CC==='undefined'?'':AGENT_CC).toLowerCase()].filter(Boolean));
  }
  function isInternalMessage(message){
    const from=emailList(messageHeader(message,'From'));
    const internal=internalEmails();
    return from.some(function(addr){return internal.has(addr)});
  }
  function isBounce(message){
    const from=(messageHeader(message,'From')+' '+messageHeader(message,'Return-Path')).toLowerCase();
    const subject=messageHeader(message,'Subject').toLowerCase();
    return /mailer-daemon|postmaster|mail delivery subsystem|delivery status notification/.test(from+' '+subject) ||
      /undeliverable|delivery failed|delivery status notification|returned mail/.test(subject);
  }
  function isAutoReply(message){
    if(isBounce(message))return false;
    const subject=messageHeader(message,'Subject').toLowerCase();
    const auto=[messageHeader(message,'Auto-Submitted'),messageHeader(message,'X-Autoreply'),messageHeader(message,'X-Autorespond'),messageHeader(message,'Precedence')].join(' ').toLowerCase();
    return (auto&&/auto|vacation|bulk|list|junk/.test(auto)) ||
      /out of office|automatic reply|auto[- ]?reply|vacation reply|away from the office/.test(subject);
  }
  function classifyReplyText(value){
    const text=String(value||'').toLowerCase().replace(/\s+/g,' ');
    const signals=[];
    if(/\b(book(?:ed|ing)?|confirmed|confirming|selected|selection|cast confirmed)\b/.test(text))signals.push('booking / confirmation');
    if(/\b(option|hold|first refusal|avail(?:able|ability)|pencil)\b/.test(text))signals.push('availability / hold');
    if(/\b(callback|fitting|casting appointment|self[- ]?tape|digitals?|polaroids?|walk video|casting call)\b/.test(text))signals.push('casting / fitting');
    if(/\b(please send|can you send|could you send|need|measurements?|comp card|portfolio|video|digitals?|polaroids?)\b/.test(text))signals.push('materials requested');
    if(/\b(pass|passing|not moving forward|not a fit|release(?:d)?|unfortunately|won't be moving|will not be moving)\b/.test(text))signals.push('decline / release');
    if(/\b(thank you|thanks|received|got it|noted|appreciate it)\b/.test(text))signals.push('acknowledgement');
    if(/\b(rate|usage|fee|budget|buyout|day rate|fitting rate|overtime|travel)\b/.test(text))signals.push('rate / usage');
    if(/\b(call time|location|address|wardrobe|hair|makeup|transport|travel|hotel|flight)\b/.test(text))signals.push('logistics');
    return Array.from(new Set(signals));
  }
  function formatTime(value){
    const d=new Date(value);
    return value&&Number.isFinite(d.getTime())?d.toLocaleString():'—';
  }
  function formatDuration(minutes){
    const n=Number(minutes);
    if(!Number.isFinite(n)||n<0)return '—';
    if(n<60)return Math.round(n)+'m';
    if(n<1440)return (n/60).toFixed(n<180?1:0)+'h';
    return (n/1440).toFixed(n<4320?1:0)+'d';
  }
  function median(values){
    const nums=values.map(Number).filter(Number.isFinite).sort(function(a,b){return a-b});
    if(!nums.length)return null;
    const mid=Math.floor(nums.length/2);
    return nums.length%2?nums[mid]:(nums[mid-1]+nums[mid])/2;
  }
  function domainFor(value){
    const list=emailList(value);
    return list.length&&list[0].includes('@')?list[0].split('@')[1]:'';
  }
  function linkedRecords(){
    const source=[].concat((db&&db.submissions)||[],(db&&db.followUps)||[],(db&&db.drafts)||[]);
    const map=new Map();
    source.forEach(function(record){
      if(!record||!record.gmailMessageId)return;
      const id=String(record.gmailMessageId);
      if(!map.has(id))map.set(id,record);
      else{
        const current=map.get(id);
        if(!current.project&&record.project)map.set(id,record);
      }
    });
    return Array.from(map.values());
  }
  function patchLinked(messageId,patch){
    const all=[].concat((db&&db.submissions)||[],(db&&db.followUps)||[],(db&&db.drafts)||[],db&&db.draft?[db.draft]:[]);
    all.forEach(function(record){
      if(record&&String(record.gmailMessageId||'')===String(messageId))Object.assign(record,patch);
    });
  }
  async function gmailFetchJson(token,url){
    const controller=new AbortController();
    const timeout=setTimeout(function(){controller.abort()},30000);
    try{
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(function(){return {}});
      if(!response.ok){
        const message=(data&&data.error&&data.error.message)||('Gmail request failed ('+response.status+').');
        throw new Error(message);
      }
      return data;
    }finally{clearTimeout(timeout)}
  }
  function metadataHeaders(url){
    ['Subject','From','To','Cc','Date','Message-ID','In-Reply-To','References','Return-Path','Auto-Submitted','X-Autoreply','X-Autorespond','Precedence','List-Id'].forEach(function(name){
      url.searchParams.append('metadataHeaders',name);
    });
    return url;
  }
  async function gmailMessageMeta(token,id){
    const url=metadataHeaders(new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(id)));
    url.searchParams.set('format','metadata');
    return gmailFetchJson(token,url.toString());
  }
  async function gmailThreadMeta(token,id){
    const url=metadataHeaders(new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads/'+encodeURIComponent(id)));
    url.searchParams.set('format','metadata');
    return gmailFetchJson(token,url.toString());
  }
  async function gmailMessageFull(token,id){
    const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(id));
    url.searchParams.set('format','full');
    return gmailFetchJson(token,url.toString());
  }
  function decodeBase64Url(value){
    if(!value)return '';
    try{
      let normalized=String(value).replace(/-/g,'+').replace(/_/g,'/');
      while(normalized.length%4)normalized+='=';
      const binary=atob(normalized);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    }catch(err){return ''}
  }
  function collectPayloadData(payload,out){
    out=out||{plain:[],html:[],attachments:[],links:[],images:0};
    if(!payload)return out;
    const mime=String(payload.mimeType||'').toLowerCase();
    const filename=String(payload.filename||'').trim();
    if(filename)out.attachments.push(filename);
    if(mime.startsWith('image/'))out.images++;
    const body=payload.body||{};
    if(body.data&&(/^text\/plain/.test(mime)||/^text\/html/.test(mime))){
      const decoded=decodeBase64Url(body.data);
      if(/^text\/plain/.test(mime))out.plain.push(decoded);
      else out.html.push(decoded);
    }
    (payload.parts||[]).forEach(function(part){collectPayloadData(part,out)});
    return out;
  }
  function stripHtml(value){
    const html=String(value||'');
    try{
      const node=document.createElement('div');
      node.innerHTML=html;
      return String(node.innerText||node.textContent||'').replace(/\s+/g,' ').trim();
    }catch(err){
      return html.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
    }
  }
  function linksFromText(value){
    return Array.from(new Set((String(value||'').match(/https?:\/\/[^\s<>"')\]]+/ig)||[]).map(function(url){return url.replace(/[.,;:!?]+$/,'')}))).slice(0,25);
  }
  function extractFullMessageInfo(message){
    const data=collectPayloadData(message&&message.payload);
    const body=(data.plain.join('\n').trim()||stripHtml(data.html.join('\n'))).replace(/\s+/g,' ').trim();
    const links=linksFromText(data.html.join('\n')+' '+body);
    return {
      bodyPreview:body.slice(0,PREVIEW_LIMIT),
      attachmentNames:Array.from(new Set(data.attachments)).slice(0,30),
      attachmentCount:Array.from(new Set(data.attachments)).length,
      linkCount:links.length,
      linkDomains:Array.from(new Set(links.map(function(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch(err){return ''}}).filter(Boolean))).slice(0,20),
      imageParts:data.images
    };
  }
  function messageTimestamp(message){
    const ms=Number(message&&message.internalDate);
    return Number.isFinite(ms)&&ms>0?ms:Date.parse(messageHeader(message,'Date'))||0;
  }
  function participantSet(messages){
    const set=new Set();
    messages.forEach(function(message){
      ['From','To','Cc'].forEach(function(name){emailList(messageHeader(message,name)).forEach(function(addr){set.add(addr)})});
    });
    return Array.from(set);
  }
  function primaryRecipient(record,anchor){
    return emailList(messageHeader(anchor,'To'))[0]||emailList(record.recipientEmail||record.email||'')[0]||'';
  }
  function recordLabel(record){
    return record.brandProject||record.project||record.company||record.subject||'Email';
  }
  async function analyzeRecord(token,record){
    const anchor=await gmailMessageMeta(token,record.gmailMessageId);
    const threadId=anchor.threadId||record.gmailThreadId||'';
    if(!threadId)throw new Error('Gmail did not return a thread for '+record.gmailMessageId+'.');
    const thread=await gmailThreadMeta(token,threadId);
    const messages=(thread.messages||[]).slice().sort(function(a,b){return messageTimestamp(a)-messageTimestamp(b)});
    const sentAtMs=messageTimestamp(anchor);
    const afterAnchor=messages.filter(function(message){return messageTimestamp(message)>=sentAtMs-1000});
    const inbound=afterAnchor.filter(function(message){return !isInternalMessage(message)});
    const bounces=inbound.filter(isBounce);
    const autoReplies=inbound.filter(function(message){return !isBounce(message)&&isAutoReply(message)});
    const humans=inbound.filter(function(message){return !isBounce(message)&&!isAutoReply(message)});
    const outbound=afterAnchor.filter(isInternalMessage);
    const firstHuman=humans[0]||null;
    const latestHuman=humans.length?humans[humans.length-1]:null;
    const latestInbound=inbound.length?inbound[inbound.length-1]:null;
    const firstHumanMs=firstHuman?messageTimestamp(firstHuman):0;
    const latestHumanMs=latestHuman?messageTimestamp(latestHuman):0;
    const latestInboundMs=latestInbound?messageTimestamp(latestInbound):0;
    const latestActivity=messages.length?messageTimestamp(messages[messages.length-1]):sentAtMs;
    const toEmails=emailList(messageHeader(anchor,'To'));
    const ccEmails=emailList(messageHeader(anchor,'Cc'));
    const recipient=primaryRecipient(record,anchor);
    const labels=(latestHuman&&latestHuman.labelIds)||[];
    const replyText=[latestHuman?messageHeader(latestHuman,'Subject'):'',latestHuman?latestHuman.snippet:''].join(' ');
    let fullInfo=null;
    const prior=record.emailIntel||{};
    if(latestHuman&&String(prior.latestInboundMessageId||'')!==String(latestHuman.id||'')&&Number(latestHuman.sizeEstimate||0)<=FULL_REPLY_LIMIT_BYTES){
      try{fullInfo=extractFullMessageInfo(await gmailMessageFull(token,latestHuman.id))}catch(err){console.warn('Could not enrich latest reply body',err)}
    }
    const preview=(fullInfo&&fullInfo.bodyPreview)||String(latestHuman&&latestHuman.snippet||'').slice(0,PREVIEW_LIMIT);
    const topicSignals=classifyReplyText([replyText,preview].join(' '));
    const sentDate=new Date(sentAtMs||Date.now());
    const intel={
      version:VERSION,
      syncedAt:nowIso(),
      threadId:threadId,
      threadHistoryId:String(thread.historyId||anchor.historyId||''),
      sentMessageId:String(anchor.id||record.gmailMessageId||''),
      sentAt:sentAtMs?new Date(sentAtMs).toISOString():'',
      sentWeekday:sentDate.toLocaleDateString([],{weekday:'short'}),
      sentHour:sentDate.getHours(),
      sentSizeBytes:Number(anchor.sizeEstimate||0),
      toEmails:toEmails,
      ccEmails:ccEmails,
      recipientCount:toEmails.length,
      ccCount:ccEmails.length,
      primaryRecipient:recipient,
      recipientDomain:domainFor(recipient),
      threadMessageCount:afterAnchor.length,
      outboundMessageCount:outbound.length,
      inboundMessageCount:inbound.length,
      humanReplyCount:humans.length,
      autoReplyCount:autoReplies.length,
      bounceCount:bounces.length,
      hasHumanReply:humans.length>0,
      firstHumanReplyAt:firstHumanMs?new Date(firstHumanMs).toISOString():'',
      lastHumanReplyAt:latestHumanMs?new Date(latestHumanMs).toISOString():'',
      responseLatencyMinutes:firstHumanMs&&sentAtMs?Math.max(0,(firstHumanMs-sentAtMs)/60000):null,
      latestInboundAt:latestInboundMs?new Date(latestInboundMs).toISOString():'',
      latestInboundMessageId:latestHuman?String(latestHuman.id||''):'',
      latestInboundFrom:latestHuman?messageHeader(latestHuman,'From'):'',
      latestInboundSubject:latestHuman?messageHeader(latestHuman,'Subject'):'',
      latestInboundSnippet:String(latestHuman&&latestHuman.snippet||'').slice(0,500),
      latestInboundPreview:preview,
      latestInboundUnread:!!(latestHuman&&labels.includes('UNREAD')),
      latestInboundStarred:!!(latestHuman&&labels.includes('STARRED')),
      latestInboundImportant:!!(latestHuman&&labels.includes('IMPORTANT')),
      latestReplySignals:topicSignals,
      latestActivityAt:latestActivity?new Date(latestActivity).toISOString():'',
      participantEmails:participantSet(messages),
      inboundSenders:Array.from(new Set(humans.flatMap(function(message){return emailList(messageHeader(message,'From'))}))),
      latestReplyAttachmentCount:fullInfo?fullInfo.attachmentCount:Number(prior.latestReplyAttachmentCount||0),
      latestReplyAttachmentNames:fullInfo?fullInfo.attachmentNames:(prior.latestReplyAttachmentNames||[]),
      latestReplyLinkCount:fullInfo?fullInfo.linkCount:Number(prior.latestReplyLinkCount||0),
      latestReplyLinkDomains:fullInfo?fullInfo.linkDomains:(prior.latestReplyLinkDomains||[]),
      latestReplyImageParts:fullInfo?fullInfo.imageParts:Number(prior.latestReplyImageParts||0)
    };
    return intel;
  }
  function recordsForSync(limit){
    return linkedRecords().slice().sort(function(a,b){
      const aSync=Date.parse((a.emailIntel&&a.emailIntel.syncedAt)||0)||0;
      const bSync=Date.parse((b.emailIntel&&b.emailIntel.syncedAt)||0)||0;
      if(aSync!==bSync)return aSync-bSync;
      const ad=Date.parse(a.submittedAt||a.date||0)||0;
      const bd=Date.parse(b.submittedAt||b.date||0)||0;
      return bd-ad;
    }).slice(0,limit);
  }
  async function syncEmailIntelligence(showStatus){
    if(intelRunning)return;
    intelRunning=true;
    render();
    let token='';
    let checked=0,updated=0,failed=0;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Reading Gmail threads for CRM email intelligence…');
      if(typeof gmailToken!=='function')throw new Error('Gmail connection is not ready.');
      token=await gmailToken();
      const records=recordsForSync(showStatus?MANUAL_LIMIT:AUTO_LIMIT);
      if(!records.length){
        db.settings=Object.assign({},db.settings||{},{emailIntelLastSyncAt:nowIso(),emailIntelVersion:VERSION,emailIntelLastSummary:'No Gmail-linked CRM emails to analyze yet.'});
        if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
        return;
      }
      for(const record of records){
        try{
          const intel=await analyzeRecord(token,record);
          patchLinked(record.gmailMessageId,{emailIntel:intel,gmailThreadId:intel.threadId});
          checked++;updated++;
        }catch(err){
          failed++;checked++;
          patchLinked(record.gmailMessageId,{emailIntelError:String(err&&err.message||err),emailIntelLastAttemptAt:nowIso()});
        }
      }
      const summary='Analyzed '+updated+' CRM email'+(updated===1?'':'s')+(failed?' · '+failed+' failed':'')+'.';
      db.settings=Object.assign({},db.settings||{},{emailIntelLastSyncAt:nowIso(),emailIntelVersion:VERSION,emailIntelLastSummary:summary});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      render();
      if(showStatus&&typeof setStatus==='function')setStatus(summary);
    }catch(err){
      console.error('CLM email intelligence sync failed',err);
      db.settings=Object.assign({},db.settings||{},{emailIntelLastSummary:'Email intelligence sync failed: '+String(err&&err.message||err)});
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(showStatus&&typeof setStatus==='function')setStatus(db.settings.emailIntelLastSummary);
    }finally{
      intelRunning=false;
      render();
    }
  }
  function intelligenceRecords(){
    return linkedRecords().filter(function(record){return record.emailIntel&&record.emailIntel.sentMessageId});
  }
  function aggregateContacts(records){
    const map=new Map();
    records.forEach(function(record){
      const intel=record.emailIntel||{};
      const key=intel.primaryRecipient||emailList(record.recipientEmail||record.email||'')[0]||'unknown';
      if(!map.has(key))map.set(key,{email:key,count:0,replied:0,latencies:[],lastReply:'',lastActivity:'',openSignals:0,bounces:0,projects:new Set()});
      const item=map.get(key);
      item.count++;
      if(intel.hasHumanReply)item.replied++;
      if(Number.isFinite(Number(intel.responseLatencyMinutes)))item.latencies.push(Number(intel.responseLatencyMinutes));
      if(Date.parse(intel.lastHumanReplyAt||0)>Date.parse(item.lastReply||0))item.lastReply=intel.lastHumanReplyAt;
      if(Date.parse(intel.latestActivityAt||0)>Date.parse(item.lastActivity||0))item.lastActivity=intel.latestActivityAt;
      item.openSignals+=Number(record.openTrackingCount||0);
      item.bounces+=Number(intel.bounceCount||0);
      item.projects.add(recordLabel(record));
    });
    return Array.from(map.values()).map(function(item){
      item.medianLatency=median(item.latencies);
      item.projects=Array.from(item.projects);
      return item;
    }).sort(function(a,b){
      if(b.replied!==a.replied)return b.replied-a.replied;
      return (Date.parse(b.lastReply||0)||0)-(Date.parse(a.lastReply||0)||0);
    });
  }
  function renderSummary(records){
    const el=q('#emailIntelSummary');if(!el)return;
    const replied=records.filter(function(r){return r.emailIntel&&r.emailIntel.hasHumanReply}).length;
    const tracked=records.filter(function(r){return Number(r.openTrackingCount||0)>0}).length;
    const unread=records.filter(function(r){return r.emailIntel&&r.emailIntel.latestInboundUnread}).length;
    const bounced=records.filter(function(r){return Number(r.emailIntel&&r.emailIntel.bounceCount||0)>0}).length;
    const med=median(records.map(function(r){return r.emailIntel&&r.emailIntel.responseLatencyMinutes}));
    const replyRate=records.length?Math.round(replied/records.length*100):0;
    el.innerHTML=
      '<div class="metric-grid">'+
      '<div class="metric"><span class="tiny muted">Analyzed</span><b>'+records.length+'</b><span class="tiny">CRM emails</span></div>'+
      '<div class="metric"><span class="tiny muted">Human replies</span><b>'+replied+'</b><span class="tiny">'+replyRate+'% reply rate</span></div>'+
      '<div class="metric"><span class="tiny muted">Median response</span><b>'+safe(formatDuration(med))+'</b><span class="tiny">first human reply</span></div>'+
      '<div class="metric"><span class="tiny muted">Open signals</span><b>'+tracked+'</b><span class="tiny">emails with ≥1 signal</span></div>'+
      '<div class="metric"><span class="tiny muted">Unread replies</span><b>'+unread+'</b><span class="tiny">latest human reply</span></div>'+
      '<div class="metric"><span class="tiny muted">Bounces</span><b>'+bounced+'</b><span class="tiny">delivery failures</span></div>'+
      '</div>';
  }
  function filterRecords(records){
    const search=String(q('#emailIntelSearch')&&q('#emailIntelSearch').value||'').toLowerCase().trim();
    const filter=q('#emailIntelFilter')?q('#emailIntelFilter').value:'all';
    return records.filter(function(record){
      const intel=record.emailIntel||{};
      const text=[recordLabel(record),record.recipientEmail,record.email,record.subject,intel.primaryRecipient,intel.recipientDomain,intel.latestInboundFrom,intel.latestInboundSubject,intel.latestInboundSnippet,(intel.latestReplySignals||[]).join(' ')].join(' ').toLowerCase();
      const matchesSearch=!search||text.includes(search);
      let matchesFilter=true;
      if(filter==='replied')matchesFilter=!!intel.hasHumanReply;
      else if(filter==='waiting')matchesFilter=!intel.hasHumanReply&&!intel.bounceCount;
      else if(filter==='unread')matchesFilter=!!intel.latestInboundUnread;
      else if(filter==='bounced')matchesFilter=Number(intel.bounceCount||0)>0;
      else if(filter==='auto')matchesFilter=Number(intel.autoReplyCount||0)>0;
      else if(filter==='open')matchesFilter=Number(record.openTrackingCount||0)>0;
      return matchesSearch&&matchesFilter;
    }).sort(function(a,b){
      return (Date.parse((b.emailIntel&&b.emailIntel.latestActivityAt)||b.submittedAt||b.date||0)||0)-
        (Date.parse((a.emailIntel&&a.emailIntel.latestActivityAt)||a.submittedAt||a.date||0)||0);
    });
  }
  function renderRecords(records){
    const el=q('#emailIntelHistory');if(!el)return;
    const filtered=filterRecords(records);
    if(!filtered.length){
      el.innerHTML='<p class="intel-help">No analyzed emails match this view.</p>';
      return;
    }
    el.innerHTML=filtered.map(function(record){
      const intel=record.emailIntel||{};
      const gmailUrl=record.gmailUrl||('https://mail.google.com/mail/u/?authuser='+encodeURIComponent(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL)+'#sent/'+encodeURIComponent(record.gmailMessageId||''));
      const replyBadge=intel.hasHumanReply?'Human reply':(intel.bounceCount?'Bounced':(intel.autoReplyCount?'Auto-reply':'No human reply'));
      const flags=[];
      if(intel.latestInboundUnread)flags.push('Unread');
      if(intel.latestInboundImportant)flags.push('Important');
      if(intel.latestInboundStarred)flags.push('Starred');
      if(Number(record.openTrackingCount||0)>0)flags.push('Open signals '+Number(record.openTrackingCount||0));
      const signals=(intel.latestReplySignals||[]).join(' · ');
      const preview=String(intel.latestInboundPreview||intel.latestInboundSnippet||'').trim();
      return '<article class="intel-item">'+
        '<div class="intel-item-head"><strong>'+safe(recordLabel(record))+'</strong><span>'+safe(replyBadge)+'</span></div>'+
        '<div class="intel-meta">'+safe(intel.primaryRecipient||record.recipientEmail||record.email||'Recipient not recorded')+
        (intel.recipientDomain?' · '+safe(intel.recipientDomain):'')+'<br>'+safe(record.subject||'')+'</div>'+
        '<div class="intel-meta">Sent: '+safe(formatTime(intel.sentAt||record.submittedAt))+
        ' · Thread messages: '+Number(intel.threadMessageCount||0)+
        ' · Human replies: '+Number(intel.humanReplyCount||0)+
        ' · Auto: '+Number(intel.autoReplyCount||0)+
        ' · Bounces: '+Number(intel.bounceCount||0)+'</div>'+
        '<div class="intel-meta">First human reply: '+safe(formatTime(intel.firstHumanReplyAt))+
        ' · Response time: '+safe(formatDuration(intel.responseLatencyMinutes))+
        '<br>Latest human reply: '+safe(formatTime(intel.lastHumanReplyAt))+
        (flags.length?' · '+safe(flags.join(' · ')):'')+'</div>'+
        (signals?'<div class="intel-signals"><b>Detected reply signals:</b> '+safe(signals)+'</div>':'')+
        (preview?'<div class="intel-preview">'+safe(preview)+'</div>':'')+
        ((intel.latestReplyAttachmentCount||intel.latestReplyLinkCount)?'<div class="intel-meta">Latest reply: '+Number(intel.latestReplyAttachmentCount||0)+' attachment(s)'+
          (intel.latestReplyAttachmentNames&&intel.latestReplyAttachmentNames.length?' ['+safe(intel.latestReplyAttachmentNames.join(', '))+']':'')+
          ' · '+Number(intel.latestReplyLinkCount||0)+' link(s)'+
          (intel.latestReplyLinkDomains&&intel.latestReplyLinkDomains.length?' ['+safe(intel.latestReplyLinkDomains.join(', '))+']':'')+'</div>':'')+
        '<div class="actions"><a class="btn" target="_blank" rel="noopener" href="'+safe(gmailUrl)+'">Open Gmail</a></div>'+
        '</article>';
    }).join('');
  }
  function renderContacts(records){
    const el=q('#emailIntelContacts');if(!el)return;
    const contacts=aggregateContacts(records).slice(0,20);
    if(!contacts.length){el.innerHTML='';return}
    el.innerHTML='<h4>Contact response history</h4><div class="table-wrap"><table><thead><tr><th>Contact</th><th>Emails</th><th>Replies</th><th>Median response</th><th>Latest reply</th><th>Open signals</th></tr></thead><tbody>'+
      contacts.map(function(item){
        return '<tr><td>'+safe(item.email)+'</td><td>'+item.count+'</td><td>'+item.replied+'</td><td>'+safe(formatDuration(item.medianLatency))+'</td><td>'+safe(formatTime(item.lastReply))+'</td><td>'+item.openSignals+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function csvCell(value){
    const text=Array.isArray(value)?value.join(' | '):String(value==null?'':value);
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function exportCsv(){
    const rows=[['Project','Subject','Recipient','Domain','Sent At','Sent Weekday','Sent Hour','Message Size Bytes','Thread Messages','Outbound Messages','Inbound Messages','Human Replies','Auto Replies','Bounces','First Human Reply','Last Human Reply','Response Minutes','Latest Reply Unread','Latest Reply From','Latest Reply Subject','Reply Signals','Latest Reply Preview','Reply Attachment Count','Reply Attachment Names','Reply Link Count','Reply Link Domains','Participants','Open Signals','First Open Signal Detected','Latest Open Signal Detected','Gmail Message ID','Gmail Thread ID']];
    intelligenceRecords().forEach(function(record){
      const i=record.emailIntel||{};
      rows.push([recordLabel(record),record.subject||'',i.primaryRecipient||record.recipientEmail||record.email||'',i.recipientDomain||'',i.sentAt||'',i.sentWeekday||'',i.sentHour==null?'':i.sentHour,i.sentSizeBytes||0,i.threadMessageCount||0,i.outboundMessageCount||0,i.inboundMessageCount||0,i.humanReplyCount||0,i.autoReplyCount||0,i.bounceCount||0,i.firstHumanReplyAt||'',i.lastHumanReplyAt||'',i.responseLatencyMinutes==null?'':Math.round(i.responseLatencyMinutes*10)/10,!!i.latestInboundUnread,i.latestInboundFrom||'',i.latestInboundSubject||'',i.latestReplySignals||[],i.latestInboundPreview||'',i.latestReplyAttachmentCount||0,i.latestReplyAttachmentNames||[],i.latestReplyLinkCount||0,i.latestReplyLinkDomains||[],i.participantEmails||[],Number(record.openTrackingCount||0),record.openTrackingFirstDetectedAt||'',record.openTrackingLastDetectedAt||'',record.gmailMessageId||'',i.threadId||'']);
    });
    const csv=rows.map(function(row){return row.map(csvCell).join(',')}).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='clm-email-intelligence-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }
  function installPanel(){
    if(q('#emailIntelligencePanel'))return;
    const anchor=q('#openTrackingPanel')||q('#gmailApiPanel');
    if(!anchor)return;
    const panel=document.createElement('section');
    panel.id='emailIntelligencePanel';
    panel.className='field';
    panel.setAttribute('aria-label','Email intelligence');
    panel.innerHTML=
      '<style>'+
      '#emailIntelligencePanel{border:1px solid var(--line,#d8dfe8);border-radius:12px;padding:16px;margin:16px 0;background:var(--panel,#fff);font-size:14px}'+
      '#emailIntelligencePanel h3{margin:0 0 8px;font-size:18px}'+
      '#emailIntelligencePanel h4{margin:18px 0 8px}'+
      '#emailIntelligencePanel .intel-help{line-height:1.5;color:var(--muted,#536174)}'+
      '#emailIntelligencePanel .intel-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}'+
      '#emailIntelligencePanel .intel-tools input{flex:1;min-width:160px}'+
      '#emailIntelligencePanel .intel-list{max-height:620px;overflow:auto}'+
      '#emailIntelligencePanel .intel-item{border-top:1px solid var(--line,#d8dfe8);padding:13px 0;overflow-wrap:anywhere}'+
      '#emailIntelligencePanel .intel-item-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}'+
      '#emailIntelligencePanel .intel-meta{font-size:13px;color:var(--muted,#536174);line-height:1.55;margin:5px 0}'+
      '#emailIntelligencePanel .intel-signals{font-size:13px;margin:7px 0}'+
      '#emailIntelligencePanel .intel-preview{font-size:13px;line-height:1.5;padding:9px 10px;border-left:3px solid var(--line,#d8dfe8);background:#f8faf8;margin:8px 0;max-height:130px;overflow:auto}'+
      '#emailIntelligencePanel .metric-grid{grid-template-columns:repeat(3,minmax(120px,1fr))}'+
      '@media(max-width:700px){#emailIntelligencePanel .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
      '</style>'+
      '<h3>Email intelligence</h3>'+
      '<p class="intel-help">Uses Gmail metadata from CRM-linked emails and their threads to capture exact send/reply timing, human replies, auto-replies, bounces, unread state, participants, contact response history, message size and limited latest-reply content. Open signals remain approximate because privacy/security scanners can trigger them.</p>'+
      '<div id="emailIntelSummary"></div>'+
      '<div class="actions" style="margin-top:12px"><button class="btn primary" type="button" id="syncEmailIntelBtn">Sync email intelligence</button><button class="btn" type="button" id="exportEmailIntelBtn">Export email data CSV</button></div>'+
      '<div id="emailIntelStatus" class="tiny muted" style="margin-top:7px" role="status" aria-live="polite"></div>'+
      '<details style="margin-top:10px"><summary>What is collected</summary><p class="intel-help">For Gmail-linked CRM emails: exact Gmail send time, recipients and CCs, recipient domain, thread/message counts, human reply count, first/latest reply time, response latency, auto-replies, delivery failures, unread/starred/important state, participants, reply-topic signals, latest-reply preview, and lightweight attachment/link metadata from the newest human reply when small enough to fetch safely. The system does not scan unrelated mailbox threads.</p></details>'+
      '<div class="intel-tools"><input id="emailIntelSearch" type="search" placeholder="Search contact, brand, subject or reply signal" aria-label="Search email intelligence"><select id="emailIntelFilter" aria-label="Filter email intelligence"><option value="all">All analyzed</option><option value="replied">Human reply</option><option value="waiting">No human reply</option><option value="unread">Unread reply</option><option value="bounced">Bounced</option><option value="auto">Auto-reply</option><option value="open">Open signal</option></select></div>'+
      '<div id="emailIntelHistory" class="intel-list"></div>'+
      '<div id="emailIntelContacts"></div>';
    anchor.insertAdjacentElement('afterend',panel);
    q('#syncEmailIntelBtn').addEventListener('click',function(){syncEmailIntelligence(true)});
    q('#exportEmailIntelBtn').addEventListener('click',exportCsv);
    q('#emailIntelSearch').addEventListener('input',render);
    q('#emailIntelFilter').addEventListener('change',render);
  }
  function render(){
    installPanel();
    const records=intelligenceRecords();
    renderSummary(records);
    renderRecords(records);
    renderContacts(records);
    const status=q('#emailIntelStatus');
    if(status){
      status.textContent=intelRunning?'Analyzing Gmail threads…':((db&&db.settings&&db.settings.emailIntelLastSummary)||'No email-intelligence sync yet.');
    }
    const button=q('#syncEmailIntelBtn');
    if(button){button.disabled=intelRunning;button.textContent=intelRunning?'Syncing…':'Sync email intelligence'}
  }
  function startTimer(){
    if(intelTimer)clearInterval(intelTimer);
    intelTimer=setInterval(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncEmailIntelligence(false);
    },AUTO_INTERVAL_MS);
    window.addEventListener('clm:gmail-connected',function(){setTimeout(function(){syncEmailIntelligence(false)},1200)});
  }
  function init(){
    installPanel();
    startTimer();
    db.settings=Object.assign({},db.settings||{},{emailIntelVersion:VERSION});
    if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    render();
    setTimeout(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncEmailIntelligence(false);
    },2500);
  }
  function initWhenReady(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db&&q('#gmailApiPanel')){
      init();
      return;
    }
    if(attempt<100)setTimeout(function(){initWhenReady(attempt+1)},100);
    else console.error('CLM email intelligence could not find a ready CRM workspace.');
  }

  window.clmSyncEmailIntelligence=function(){return syncEmailIntelligence(true)};
  window.clmExportEmailIntelligence=exportCsv;
  window.clmEmailIntelligenceClassify=classifyReplyText;
  initWhenReady(0);
})();