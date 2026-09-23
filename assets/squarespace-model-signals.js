/* Install on Squarespace only after configuring GA4, office exclusions and consent. */
(function(){
  'use strict';
  if(window.__clmModelPageSignals)return;window.__clmModelPageSignals=true;
  const cfg=window.CLM_MODEL_SIGNALS_CONFIG||{};
  const query=new URLSearchParams(location.search),staffKey='clm_staff_device_v1';
  window.clmSetStaffDevice=function(value){localStorage.setItem(staffKey,value?'1':'0')};
  if(query.get('clm_staff')==='1'){
    try{window.clmSetStaffDevice(true);const note=document.createElement('p');note.textContent='This browser is excluded from CLM model-visit signals.';note.style.cssText='padding:16px;background:#fff;color:#111;border:2px solid #111';document.body.prepend(note)}catch{}
    return;
  }
  const submission=query.get('clm_submission'),model=query.get('clm_model'),position=Number(query.get('clm_position'));
  if(!/^[a-f0-9]{32}$/.test(submission||'')||!/^[a-zA-Z0-9_-]{1,100}$/.test(model||'')||!Number.isInteger(position)||position<1)return;
  let session='',visitor='',viewSent=false,interactionSent=false,visibleSince=0;
  function allowed(){
    try{return cfg.officeExclusionVerified===true&&/^G-[A-Z0-9]+$/.test(cfg.measurementId||'')&&
      typeof cfg.hasAnalyticsConsent==='function'&&cfg.hasAnalyticsConsent()===true&&
      localStorage.getItem(staffKey)!=='1'&&!navigator.webdriver&&!/bot|crawler|spider|headless/i.test(navigator.userAgent)&&typeof window.gtag==='function'}catch{return false}
  }
  function id(){return crypto.randomUUID().replace(/-/g,'')}
  function identities(){
    // No analytics identifiers are stored before consent is granted.
    visitor=localStorage.getItem('clm_visitor_v1')||id();localStorage.setItem('clm_visitor_v1',visitor);
    const saved=JSON.parse(sessionStorage.getItem('clm_session_v1')||'null');
    session=saved&&Date.now()-saved.at<30*60*1000?saved.id:id();
    sessionStorage.setItem('clm_session_v1',JSON.stringify({id:session,at:Date.now()}));
  }
  function emit(name){
    if(!allowed()||document.visibilityState!=='visible')return false;
    try{identities();window.gtag('event',name,{send_to:cfg.measurementId,clm_submission:submission,clm_model:model,
      clm_position:position,clm_visitor:visitor,clm_session:session,clm_event_id:id()});return true}catch{return false}
  }
  function tick(){
    if(!allowed()||document.visibilityState!=='visible'){visibleSince=0;return}
    if(!visibleSince)visibleSince=Date.now();
    if(!viewSent&&Date.now()-visibleSince>=2000)viewSent=emit('model_view');
  }
  document.addEventListener('visibilitychange',tick);
  ['pointerdown','keydown'].forEach(type=>document.addEventListener(type,event=>{
    if(!event.isTrusted||!viewSent||interactionSent||Date.now()-visibleSince<2000)return;
    interactionSent=emit('model_interaction');
  },{passive:true}));
  const timer=setInterval(tick,1000);tick();
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
