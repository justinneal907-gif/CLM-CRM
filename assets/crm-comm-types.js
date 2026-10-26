/* Communication type packages.
   Templates come from Justin's sent Gmail, grouped by the purpose of the contact.
   Pure template logic is exported for tests; the UI attaches to the package builder. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.CLMCommTypes=api;if(typeof document!=='undefined')api.mount(root);}
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const CANVA=[
  ['Standard','https://canva.link/qotixws4g0xzcy2'],
  ['Commercial','https://canva.link/roe42u4m15ykmz1'],
  ['Mature','https://canva.link/wcqk69xohlz0j7i'],
  ['Alternative','https://canva.link/6dkl45q4x83m1ou'],
  ['New Faces','https://canva.link/wnblda107s1pdj1'],
  ['Celebrity','https://canva.link/no4za3cv5ew9fng']
];
const WEBSITE='https://www.chezlesmannequins.com/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvaFooter=()=>'<div data-clm-comm-footer="1">'+CANVA.map(([l,u])=>'<div>View our '+l+' models <a href="'+u+'" target="_blank"><strong><em>HERE</em></strong></a>.</div>').join('')+'<br></div>';
const rosterFooter=(link)=>'<div data-clm-comm-footer="1"><div>You can see the rest of our models <a data-clm-package-link="1" href="'+esc(link||WEBSITE)+'" target="_blank"><strong><em>HERE</em></strong></a>.</div><br><div>Let me know if you want to see any of them.</div><br></div>';

/* Placeholders: {first} {brand} {models} {model} {city} {timing} {prevSubject}.
   models: set true when the package carries model photos and measurements. */
const TYPES=[
  {id:'gosee',label:'Casting go-see request',purpose:'introduction',models:false,
   subject:'Model Go-See(s)',
   body:"Hi {first},\n\nI hope you are well. I am a model agent at Chez Les Mannequins (CLM). Would you be available to see any models on go-sees some time between {timing}? We would love for you to consider our talent for any upcoming bookings.",
   defaults:{timing:'November and January'},footer:canvaFooter},
  {id:'brand_submission',label:'Brand or casting submission',purpose:'submission',models:true,
   subject:'{brand} | Campaign Casting',
   body:"Hi {first},\n\nI wanted to send {models} for any upcoming {brand} campaign casting. Their materials are below.",
   footer:rosterFooter},
  {id:'celebrity_intro',label:'Celebrity or brand introduction',purpose:'introduction',models:true,
   subject:'{model} Introduction | {brand}',
   body:"Hi {first},\n\nI am reaching out from Chez Les Mannequins to introduce {model} for consideration for upcoming fashion, activewear, and lifestyle campaigns. If there are any opportunities coming up, please keep {model} in mind!",
   firstFallback:true,
   footer:()=>'<div data-clm-comm-footer="1"><div>Let me know if you want to see more.</div><br></div>'},
  {id:'tfp_photographer',label:'TFP outreach: photographer',purpose:'introduction',models:false,
   subject:'{city} Model Test Collaboration | Chez Les Mannequins',
   body:"Hi {first},\n\nI am Justin, an agent with Chez Les Mannequins. I came across your work and wanted to see if you would be interested in collaborating with some of our models for TFP shoots.\n\nWe would love to create something that benefits everyone's portfolios. Let me know if you are interested, and I would be happy to share more details!",
   defaults:{city:'NYC'}},
  {id:'tfp_beauty',label:'TFP outreach: makeup or hair',purpose:'introduction',models:false,
   subject:'{city} Beauty Test Collaboration | Chez Les Mannequins',
   body:"Hi {first},\n\nI am Justin, an agent with Chez Les Mannequins. I came across your work and wanted to see if you would be interested in collaborating on TFP shoots with our models.\n\nWe are looking to connect with talented makeup artists for upcoming creative projects. Let me know if you are interested, and I would be happy to share more details!",
   defaults:{city:'NYC'}},
  {id:'shoot_collab',label:'Shoot team (Honolulu, Paris and more)',purpose:'introduction',models:false,
   subject:'{city} Model Test Collaboration | Chez Les Mannequins',
   body:"Hi {first},\n\nI am a modeling agent at Chez Les Mannequins. We are currently organizing a fashion editorial collaborative shoot in {city} for our model, {model}, and are looking to finalize our creative team.\n\nThis would be a collaborative (TFP) shoot, with everyone involved receiving professional images for their portfolios. I came across your work and thought you would be a great fit for the shoot! We are hoping to schedule it within {timing}.\n\nIf you are interested, please let me know your availability! I would be happy to share {model}'s portfolio and our creative references.",
   defaults:{city:'Honolulu',timing:'the next two weeks'},footer:()=>'<div data-clm-comm-footer="1"><i>Creative Agency</i><br></div>'},
  {id:'followup',label:'Follow up',purpose:'followup',models:false,
   subject:'Re: {prevSubject}',
   body:"Hi {first},\n\nI wanted to follow up on my previous email. We are currently coordinating {model}'s shoot in {city} and are hoping to schedule it soon.\n\nIf you are interested, please let me know your availability over the next {timing}!",
   defaults:{timing:'two weeks'}}
];
const byId=id=>TYPES.find(t=>t.id===id)||null;
function names(list){list=(list||[]).filter(Boolean);return list.length<2?(list[0]||''):list.length===2?list.join(' and '):list.slice(0,-1).join(', ')+', and '+list[list.length-1];}
function firstName(v){return String(v||'').trim().split(/\s+/)[0].replace(/[,;]/g,'');}
function fill(text,v){return String(text||'').replace(/\{(\w+)\}/g,(m,k)=>v[k]??'');}
/* input: {contactName, brand, models:[names], city, timing, prevSubject, link}
   overrides: {subject, body} saved by the user for this type. */
function render(typeId,input={},overrides={}){
  const t=byId(typeId);if(!t)throw new Error('Unknown communication type: '+typeId);
  const o=overrides[typeId]||{};
  const list=(input.models||[]).filter(Boolean);
  const brand=String(input.brand||'').trim();
  const first=firstName(input.contactName)||(t.firstFallback&&brand?(brand+' Team'):'there');
  const v={
    first,brand,models:names(list)||'our models',model:list[0]||'our model',
    city:String(input.city||'').trim()||(t.defaults&&t.defaults.city)||'',
    timing:String(input.timing||'').trim()||(t.defaults&&t.defaults.timing)||'',
    prevSubject:String(input.prevSubject||'').replace(/^\s*(re:\s*)+/i,'').trim()||'previous email'
  };
  let body=fill(o.body!==undefined?o.body:t.body,v);
  // A bare "Hi there," is fine; tidy double spaces left by empty placeholders.
  body=body.replace(/[ \t]{2,}/g,' ').replace(/ ([,.!?])/g,'$1');
  const subject=fill(o.subject!==undefined?o.subject:t.subject,v).replace(/\s{2,}/g,' ').trim();
  return {
    typeId,label:t.label,subject,body,purpose:t.purpose,noModels:!t.models,
    footerHtml:t.footer?t.footer(input.link):'',
    startsWithGreeting:/^\s*(Hi|Hello|Dear)(\s|,)/.test(body)
  };
}

function mount(win){
  const doc=win.document;
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(doc.getElementById('commTypePanel')){clearInterval(timer);return;}
    const purposeField=doc.getElementById('emailPurpose')?.closest('.field');
    if(!purposeField||typeof db==='undefined'||!win.__clmWorkspaceReady){if(tries>200)clearInterval(timer);return;}
    clearInterval(timer);
    build(win,doc,purposeField);
  },250);
}
function build(win,doc,anchor){
  const $=id=>doc.getElementById(id);
  const state=()=>db;
  const overrides=()=>{const s=state();return s.commTemplates=s.commTemplates||{};};
  const panel=doc.createElement('div');panel.className='field';panel.id='commTypePanel';
  panel.innerHTML='<label>Communication type</label>'+
    '<select id="commType">'+TYPES.map(t=>'<option value="'+t.id+'">'+esc(t.label)+'</option>').join('')+'</select>'+
    '<div class="muted tiny" style="margin-top:5px" id="commTypeHint"></div>'+
    '<div class="toolbar" style="margin-top:8px"><input id="commCity" placeholder="City (NYC, Honolulu, Paris)"/><input id="commTiming" placeholder="Timing (November and January, the next two weeks)"/></div>'+
    '<div class="actions"><button class="btn primary" type="button" id="commNewBtn">New package of this type</button><button class="btn" type="button" id="commApplyBtn">Apply to current package</button></div>'+
    '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Edit this template</summary>'+
    '<div class="field" style="margin-top:8px"><label>Subject</label><input id="commTplSubject"/></div>'+
    '<div class="field"><label>Body</label><textarea id="commTplBody" rows="9"></textarea></div>'+
    '<div class="muted tiny">Placeholders: {first} {brand} {models} {model} {city} {timing} {prevSubject}</div>'+
    '<div class="actions" style="margin-top:7px"><button class="btn" type="button" id="commTplSave">Save template</button><button class="btn" type="button" id="commTplReset">Reset to original</button></div></details>';
  anchor.parentNode.insertBefore(panel,anchor);

  const typeId=()=>$('commType').value;
  function inputs(){
    const s=state(),sel=(typeof selected!=='undefined'?selected:[]).map(id=>(s.models||[]).find(m=>m.id===id)).filter(Boolean).map(m=>m.name);
    return {contactName:$('emailContactName').value,brand:$('emailBrand').value||$('emailCompany').value,models:sel,
      city:$('commCity').value,timing:$('commTiming').value,prevSubject:$('emailSubject').value,link:$('emailLink').value};
  }
  function loadEditor(){
    const t=byId(typeId()),o=overrides()[t.id]||{};
    $('commTplSubject').value=o.subject!==undefined?o.subject:t.subject;
    $('commTplBody').value=o.body!==undefined?o.body:t.body;
    $('commTypeHint').textContent=t.models?'Uses the models selected below, with measurements and photos.':'No model photos. Sends the message and the signature only'+(t.footer&&t.id==='gosee'?', plus the six roster category links.':'.');
    const d=t.defaults||{};
    $('commCity').placeholder='City'+(d.city?' (default '+d.city+')':'');
    $('commTiming').placeholder='Timing'+(d.timing?' (default '+d.timing+')':'');
  }
  $('commType').addEventListener('change',loadEditor);
  $('commTplSave').addEventListener('click',async()=>{
    overrides()[typeId()]={subject:$('commTplSubject').value,body:$('commTplBody').value};
    await persistWorkspaceSafe(true);setStatus('Template saved.');
  });
  $('commTplReset').addEventListener('click',async()=>{delete overrides()[typeId()];loadEditor();await persistWorkspaceSafe(true);});

  function fields(r){
    return {purpose:r.purpose,subject:r.subject,initialMessage:r.startsWithGreeting?r.body:'Hi there,\n\n'+r.body,
      followupCtaHtml:r.footerHtml,commType:r.typeId,commNoModels:r.noModels,blankBodyCopy:false};
  }
  $('commApplyBtn').addEventListener('click',async()=>{
    const r=render(typeId(),inputs(),overrides());
    const s=state(),f=fields(r);
    if(doc.getElementById('emailPreview')?.dataset.manualRefreshInitialized==='1'&&!win.confirm('Replace the current email text with the '+r.label+' template? Model photos stay selected.'))return;
    $('emailPurpose').value=r.purpose;$('emailSubject').value=r.subject;
    const active=s.activeDraftId?(s.drafts||[]).find(d=>d.id===s.activeDraftId):null;
    for(const target of [s.draft=s.draft||{},active].filter(Boolean)){
      Object.assign(target,f);delete target.previewHtml;target.previewNeedsGmailUpdate=true;
    }
    renderEmail(true);
    await saveDraft(false);
    setStatus(r.label+' template applied. Edit the preview, then create the Gmail draft.');
  });
  $('commNewBtn').addEventListener('click',async()=>{
    const s=state(),r=render(typeId(),inputs(),overrides());
    const ids=r.noModels?[]:(typeof selected!=='undefined'?selected:[]).slice();
    if(!r.noModels&&!ids.length){setStatus('Select at least one model first, then create this package.');return;}
    const names_=ids.map(id=>(s.models||[]).find(m=>m.id===id)?.name).filter(Boolean);
    const id='comm-'+r.typeId+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    const d={id,date:new Date().toISOString().slice(0,10),eventName:'',packageName:r.label+(inputs().brand?' | '+inputs().brand:''),
      contactName:$('emailContactName').value,company:$('emailCompany').value,recipientEmail:$('emailRecipient').value,
      brandProject:$('emailBrand').value,subject:r.subject,packageLink:$('emailLink').value,modelIds:ids,models:names_,
      includePhotos:ids.length>0,includeStats:ids.length>0,includeSources:ids.length>0,modelExtras:{},
      generatedPhotoMode:'live-gallery',generatedPhotoModeVersion:3,html:'',notes:'',...fields(r)};
    s.drafts=s.drafts||[];s.drafts.push(d);
    await persistWorkspaceSafe(true);
    await loadDraft(id);
  });
  loadEditor();
}
return {TYPES,CANVA,render,byId,names,mount};
});
