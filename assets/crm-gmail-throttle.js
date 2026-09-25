/* CLM Gmail API request governor · 2026-09-25
   Coordinates Gmail API traffic across CRM tabs and applies exponential backoff
   when Google returns per-user or per-project rate-limit responses. */
(function(){
  'use strict';
  if(window.CLMGmailThrottle)return;

  const COOLDOWN_KEY='clm.gmail.quotaCooldownUntil.v1';
  const NEXT_REQUEST_KEY='clm.gmail.nextRequestAt.v1';
  const BACKGROUND_PREFIX='clm.gmail.background.';
  const MIN_GAP_MS=300;
  let localNext=0;

  function now(){return Date.now()}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,ms||0)))}
  function readNumber(key){
    try{
      const value=Number(localStorage.getItem(key)||0);
      return Number.isFinite(value)?value:0;
    }catch{return 0}
  }
  function writeNumber(key,value){
    try{localStorage.setItem(key,String(Math.max(0,Number(value)||0)))}catch{}
  }
  function cooldownUntil(){return Math.max(readNumber(COOLDOWN_KEY),0)}
  function setCooldown(ms){
    const until=now()+Math.max(1000,Number(ms)||0);
    if(until>cooldownUntil())writeNumber(COOLDOWN_KEY,until);
    return until;
  }
  function clearExpiredCooldown(){
    const until=cooldownUntil();
    if(until&&until<=now())writeNumber(COOLDOWN_KEY,0);
  }
  function rateLimitReason(data){
    const error=data&&data.error;
    const message=String((error&&error.message)||'').toLowerCase();
    const reasons=[];
    const errors=(error&&Array.isArray(error.errors))?error.errors:[];
    errors.forEach(item=>reasons.push(String(item&&item.reason||'').toLowerCase()));
    const details=(error&&Array.isArray(error.details))?error.details:[];
    details.forEach(item=>{
      if(item&&item.reason)reasons.push(String(item.reason).toLowerCase());
      if(item&&item.metadata&&item.metadata.quota_limit)reasons.push('quota');
    });
    const joined=reasons.join(' ');
    return /ratelimit|quota|userratelimit|dailylimit/.test(joined)||/quota|rate limit|too many requests|resource has been exhausted/.test(message);
  }
  async function responseLooksRateLimited(response){
    if(!response)return false;
    if(response.status===429)return true;
    if(response.status!==403)return false;
    try{
      const data=await response.clone().json();
      return rateLimitReason(data);
    }catch{return false}
  }
  function retryAfterMs(response,fallbackMs){
    try{
      const raw=response&&response.headers&&response.headers.get('Retry-After');
      const seconds=Number(raw);
      if(Number.isFinite(seconds)&&seconds>0)return Math.min(120000,seconds*1000);
      const date=Date.parse(raw||'');
      if(Number.isFinite(date)&&date>now())return Math.min(120000,date-now());
    }catch{}
    return fallbackMs;
  }
  async function waitForTurn(){
    clearExpiredCooldown();
    const cooldown=cooldownUntil();
    if(cooldown>now())await sleep(cooldown-now());
    const sharedNext=readNumber(NEXT_REQUEST_KEY);
    const target=Math.max(localNext,sharedNext,now());
    if(target>now())await sleep(target-now());
    const next=now()+MIN_GAP_MS;
    localNext=next;
    writeNumber(NEXT_REQUEST_KEY,next);
  }
  async function throttledFetch(url,options,config){
    const cfg=Object.assign({retryRateLimit:true,maxRetries:2},config||{});
    let attempt=0;
    while(true){
      await waitForTurn();
      const response=await fetch(url,options||{});
      const limited=await responseLooksRateLimited(response);
      if(!limited)return response;

      const base=Math.min(60000,2500*Math.pow(2,attempt));
      const delay=retryAfterMs(response,base+Math.floor(Math.random()*750));
      setCooldown(delay);

      if(!cfg.retryRateLimit||attempt>=cfg.maxRetries)return response;
      attempt++;
      await sleep(delay);
    }
  }
  function claimBackground(name,minIntervalMs){
    const key=BACKGROUND_PREFIX+String(name||'task');
    const current=now();
    const prior=readNumber(key);
    if(prior&&current-prior<Math.max(1000,Number(minIntervalMs)||0))return false;
    writeNumber(key,current);
    return true;
  }
  function remainingCooldownMs(){
    clearExpiredCooldown();
    return Math.max(0,cooldownUntil()-now());
  }
  function cooldownText(){
    const ms=remainingCooldownMs();
    if(!ms)return '';
    const sec=Math.ceil(ms/1000);
    return sec<60?sec+'s':Math.ceil(sec/60)+'m';
  }

  window.CLMGmailThrottle={
    fetch:throttledFetch,
    claimBackground,
    setCooldown,
    remainingCooldownMs,
    cooldownText,
    isRateLimitedResponse:responseLooksRateLimited
  };
  window.__clmGmailThrottleLoaded=true;
})();