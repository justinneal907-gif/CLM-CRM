/* CLM CRM response-time sync · 2026-09-24
   Keeps only one email-intelligence metric: time from CRM-linked sent email
   to the first human reply in its Gmail thread. */
(function(){
  'use strict';
  if(window.__clmResponseTimeLoaded)return;
  window.__clmResponseTimeLoaded=true;

  const VERSION='2026-09-24-v1';
  const SYNC_INTERVAL_MS=5*60*1000;
  const AUTO_LIMIT=40;
  const MANUAL_LIMIT=160;
  let syncRunning=false;
  let syncTimer=null;

  function nowIso(){return new Date().toISOString()}
  function emailList(value){
    return Array.from(new Set((String(value||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(function(x){return x.toLowerCase()})));
  }
  function header(message,name){
    const headers=(message&&message.payload&&message.payload.headers)||[];
    const hit=headers.find(function(h){return String(h.name||'').toLowerCase()===String(name||'').toLowerCase()});
    return hit?String(hit.value||''):'';
  }
  function messageTime(message){
    const ms=Number(message&&message.internalDate);
    return Number.isFinite(ms)&&ms>0?ms:(Date.parse(header(message,'Date'))||0);
  }
  function internalEmails(){
    return new Set([String(typeof WORK_EMAIL==='undefined'?'':WORK_EMAIL).toLowerCase(),String(typeof AGENT_CC==='undefined'?'':AGENT_CC).toLowerCase()].filter(Boolean));
  }
  function isInternal(message){
    const from=emailList(header(message,'From'));
    const internal=internalEmails();
    return from.some(function(address){return internal.has(address)});
  }
  function isBounce(message){
    const from=(header(message,'From')+' '+header(message,'Return-Path')).toLowerCase();
    const subject=header(message,'Subject').toLowerCase();
    return /mailer-daemon|postmaster|mail delivery subsystem|delivery status notification/.test(from+' '+subject) ||
      /undeliverable|delivery failed|delivery status notification|returned mail/.test(subject);
  }
  function isAutoReply(message){
    if(isBounce(message))return false;
    const subject=header(message,'Subject').toLowerCase();
    const auto=[header(message,'Auto-Submitted'),header(message,'X-Autoreply'),header(message,'X-Autorespond'),header(message,'Precedence')].join(' ').toLowerCase();
    return (auto&&/auto|vacation|bulk|list|junk/.test(auto)) ||
      /out of office|automatic reply|auto[- ]?reply|vacation reply|away from the office/.test(subject);
  }
  function linkedRecords(){
    const source=[].concat((db&&db.submissions)||[],(db&&db.followUps)||[],(db&&db.drafts)||[]);
    const map=new Map();
    source.forEach(function(record){
      if(record&&record.gmailMessageId&&!map.has(String(record.gmailMessageId)))map.set(String(record.gmailMessageId),record);
    });
    return Array.from(map.values());
  }
  function patchLinked(messageId,patch){
    const all=[].concat((db&&db.submissions)||[],(db&&db.followUps)||[],(db&&db.drafts)||[],db&&db.draft?[db.draft]:[]);
    all.forEach(function(record){
      if(record&&String(record.gmailMessageId||'')===String(messageId))Object.assign(record,patch);
    });
  }
  function cleanLegacyEmailIntel(){
    const all=[].concat((db&&db.submissions)||[],(db&&db.followUps)||[],(db&&db.drafts)||[],db&&db.draft?[db.draft]:[]);
    all.forEach(function(record){
      if(!record)return;
      if(record.emailResponseTimeMinutes==null&&record.emailIntel&&Number.isFinite(Number(record.emailIntel.responseLatencyMinutes))){
        record.emailResponseTimeMinutes=Number(record.emailIntel.responseLatencyMinutes);
      }
      delete record.emailIntel;
      delete record.emailIntelError;
      delete record.emailIntelLastAttemptAt;
      delete record.gmailThreadId;
    });
    if(db&&db.settings){
      delete db.settings.emailIntelLastSyncAt;
      delete db.settings.emailIntelVersion;
      delete db.settings.emailIntelLastSummary;
    }
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
  function addHeaders(url){
    ['From','Date','Return-Path','Subject','Auto-Submitted','X-Autoreply','X-Autorespond','Precedence'].forEach(function(name){
      url.searchParams.append('metadataHeaders',name);
    });
    return url;
  }
  async function messageMeta(token,id){
    const url=addHeaders(new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(id)));
    url.searchParams.set('format','metadata');
    return gmailJson(token,url.toString());
  }
  async function threadMeta(token,id){
    const url=addHeaders(new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads/'+encodeURIComponent(id)));
    url.searchParams.set('format','metadata');
    return gmailJson(token,url.toString());
  }
  async function responseMinutes(token,record){
    const anchor=await messageMeta(token,record.gmailMessageId);
    const sentAt=messageTime(anchor);
    if(!anchor.threadId||!sentAt)return null;
    const thread=await threadMeta(token,anchor.threadId);
    const firstHuman=(thread.messages||[])
      .filter(function(message){
        return messageTime(message)>sentAt&&!isInternal(message)&&!isBounce(message)&&!isAutoReply(message);
      })
      .sort(function(a,b){return messageTime(a)-messageTime(b)})[0];
    if(!firstHuman)return null;
    return Math.max(0,(messageTime(firstHuman)-sentAt)/60000);
  }
  function recordsForSync(limit){
    return linkedRecords().slice().sort(function(a,b){
      const as=Date.parse(a.emailResponseTimeSyncedAt||0)||0;
      const bs=Date.parse(b.emailResponseTimeSyncedAt||0)||0;
      if(as!==bs)return as-bs;
      return (Date.parse(b.submittedAt||b.date||0)||0)-(Date.parse(a.submittedAt||a.date||0)||0);
    }).slice(0,limit);
  }
  async function syncResponseTimes(showStatus){
    if(syncRunning)return;
    syncRunning=true;
    try{
      if(showStatus&&typeof setStatus==='function')setStatus('Updating Gmail response times…');
      if(typeof gmailToken!=='function')throw new Error('Gmail connection is not ready.');
      const token=await gmailToken();
      const records=recordsForSync(showStatus?MANUAL_LIMIT:AUTO_LIMIT);
      let updated=0,failed=0;
      for(const record of records){
        try{
          const minutes=await responseMinutes(token,record);
          patchLinked(record.gmailMessageId,{
            emailResponseTimeMinutes:minutes,
            emailResponseTimeSyncedAt:nowIso()
          });
          updated++;
        }catch(err){
          failed++;
          console.warn('Response-time check failed for '+record.gmailMessageId,err);
        }
      }
      db.settings=Object.assign({},db.settings||{},{
        emailResponseTimeVersion:VERSION,
        emailResponseTimeLastSyncAt:nowIso()
      });
      if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
      if(typeof renderAll==='function')renderAll();
      if(typeof renderTrackerStatus==='function')renderTrackerStatus();
      if(showStatus&&typeof setStatus==='function'){
        setStatus('Updated response time for '+updated+' email'+(updated===1?'':'s')+(failed?' · '+failed+' failed':'')+'.');
      }
    }catch(err){
      console.error('CLM response-time sync failed',err);
      if(showStatus&&typeof setStatus==='function')setStatus('Response-time sync failed: '+String(err&&err.message||err));
    }finally{syncRunning=false}
  }
  function startTimer(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncResponseTimes(false);
    },SYNC_INTERVAL_MS);
    window.addEventListener('clm:gmail-connected',function(){setTimeout(function(){syncResponseTimes(false)},1200)});
  }
  function init(){
    cleanLegacyEmailIntel();
    db.settings=Object.assign({},db.settings||{},{emailResponseTimeVersion:VERSION});
    if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false);
    startTimer();
    setTimeout(function(){
      if(typeof gmailAccessToken!=='undefined'&&gmailAccessToken&&Date.now()<gmailTokenExpiresAt)syncResponseTimes(false);
    },2500);
  }
  function initWhenReady(attempt){
    attempt=Number(attempt||0);
    if(typeof db!=='undefined'&&db){
      init();
      return;
    }
    if(attempt<100)setTimeout(function(){initWhenReady(attempt+1)},100);
    else console.error('CLM response-time sync could not find a ready CRM workspace.');
  }

  window.clmSyncResponseTimes=function(){return syncResponseTimes(true)};
  initWhenReady(0);
})();