/* Package-scoped research. Reads existing roster IDs; media and email logic stay in the CRM. */
(function () {
  'use strict';
  const B = window.CLMBrandIntelligence;
  const KEY = 'clm.brand-intelligence.v1';
  const DEFAULT_ENDPOINT = 'https://coipdgmfuervnuqnfiud.supabase.co/functions/v1/brand-intelligence';
  const initialState = () => ({
    endpoint: DEFAULT_ENDPOINT, profiles: {}, researchCache: {}, aliases: {'galia lahav bridal': 'galia lahav'},
    contexts: {}, assessments: {}, modelPortfolioProfiles: {}, weights: {...B.WEIGHTS}
  });
  let state = initialState(), loadError = '', originalRaw = '', message = '', busy = false, bootPromise;
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brand = () => normalizedBrandName();
  const brandKey = () => B.key(brand(), state.aliases);
  const scope = () => JSON.stringify([db.activeDraftId || 'working', brandKey()]);
  const assessmentKey = () => JSON.stringify([brandKey(), context().jobType]);
  const object = v => v && typeof v === 'object' && !Array.isArray(v);

  function readState(raw) {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !object(parsed.profiles)) throw Error('Unsupported research backup.');
    const next = initialState();
    if (object(parsed.aliases)) for (const [alias, target] of Object.entries(parsed.aliases)) {
      if (B.norm(alias) !== alias || B.norm(target) !== target || alias === target) throw Error('Invalid brand alias.');
      next.aliases[alias] = target;
    }
    for (const [key, p] of Object.entries(parsed.profiles)) {
      const value = B.validate(p);
      if (key !== B.key(value.brand, next.aliases)) throw Error('A brand identity in the backup does not match its profile.');
      next.profiles[key] = value;
    }
    if (Object.keys(next.aliases).some(a=>Object.hasOwn(next.profiles,a))) throw Error('A brand alias conflicts with an independent profile.');
    if (object(parsed.researchCache)) for (const [cacheKey, p] of Object.entries(parsed.researchCache)) {
      const identity=JSON.parse(cacheKey),value=B.validate(p);
      if(!Array.isArray(identity)||identity.length!==3||identity[0]!==B.key(value.brand,next.aliases)||identity[2]!==value.jobType)throw Error('Invalid cached research identity.');
      next.researchCache[cacheKey]=value;
    }
    if (object(parsed.contexts)) for (const [key, c] of Object.entries(parsed.contexts)) next.contexts[key] = B.validateContext(c);
    if (object(parsed.assessments)) next.assessments = parsed.assessments;
    if (object(parsed.modelPortfolioProfiles)) next.modelPortfolioProfiles = parsed.modelPortfolioProfiles;
    if (object(parsed.weights)) {
      for (const key of Object.keys(B.WEIGHTS)) {
        const n = parsed.weights[key];
        if (!Number.isFinite(n) || n < 0) throw Error('Invalid saved ranking weights.');
        next.weights[key] = n;
      }
      if (!Object.values(next.weights).some(n => n > 0)) throw Error('All ranking weights are zero.');
    }
    if (parsed.endpoint) {
      next.endpoint = B.url(parsed.endpoint);
      if (!next.endpoint) throw Error('Invalid saved research connection.');
    }
    return next;
  }
  try {
    originalRaw = localStorage.getItem(KEY) || '';
    if (originalRaw) state = readState(originalRaw);
  } catch (e) {
    state = initialState();
    loadError = 'Saved research could not be read. Export the recovery copy, then import a valid backup. ' + e.message;
  }
  function persist() {
    if (loadError) throw Error(loadError);
    const value = JSON.stringify({...state, version: 1});
    if (value.length > 1800000) throw Error('Research storage is full. Export a backup before adding more research.');
    localStorage.setItem(KEY, value);
  }
  function context() {
    const pb = db.draft?.parsedBrief || {};
    const event = el('emailEvent')?.value || db.draft?.eventName || '';
    const saved = db.draft?.brandIntelligenceContext;
    const stored = saved?.brandKey === brandKey() ? saved.context : state.contexts[scope()];
    return {
      jobType: /bridal/i.test(event) ? 'Bridal Week / Bridal Market' : /fashion week|runway/i.test(event) ? 'Runway' : 'General submission',
      start: pb.shootDate || '', end: pb.shootDate || '', location: pb.location || '', division: '', season: '', ranges: {},
      ...(stored || {})
    };
  }
  function researchScope(k=brandKey(),c=context()){return JSON.stringify([k,B.norm(c.season),c.jobType]);}
  function profile() {const cached=state.researchCache[researchScope()];return cached||(Object.hasOwn(state.profiles,brandKey())?state.profiles[brandKey()]:null);}
  function rows() {
    const p = profile();
    return p ? B.rank(db.models, p, context(), db.submissions || [], state.assessments[assessmentKey()] || {}, state.aliases, state.weights) : [];
  }
  function link(url, label) {
    return B.url(url) ? `<a href="${esc(B.url(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  }
  function field(label, id, value, type = 'text') {
    return `<label class="bi-field">${esc(label)}<input id="${id}" type="${type}" value="${esc(value)}"></label>`;
  }
  function download(value, filename) {
    const a = document.createElement('a'), u = URL.createObjectURL(new Blob([value], {type: 'application/json'}));
    a.href = u; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async function act(fn) {
    const before = structuredClone(state);
    const draftContext = structuredClone(db.draft?.brandIntelligenceContext || null);
    const active = typeof activeDraftRecord === 'function' ? activeDraftRecord() : null;
    const activeContext = structuredClone(active?.brandIntelligenceContext || null);
    try { await fn(); }
    catch (e) {
      state = before; message = e.message;
      if (db.draft) { if (draftContext) db.draft.brandIntelligenceContext = draftContext; else delete db.draft.brandIntelligenceContext; }
      if (active) { if (activeContext) active.brandIntelligenceContext = activeContext; else delete active.brandIntelligenceContext; }
    }
    render();
  }
  async function storeContext(c) {
    const value = B.validateContext(c);
    // This inert metadata travels with the existing package snapshot on save/copy/reload.
    db.draft.brandIntelligenceContext = {brandKey: brandKey(), context: value};
    const active = typeof activeDraftRecord === 'function' ? activeDraftRecord() : null;
    if (active) active.brandIntelligenceContext = structuredClone(db.draft.brandIntelligenceContext);
    if (!await persistWorkspaceSafe(true)) throw Error('Job requirements could not be saved to the package.');
    message = 'Job requirements saved.';
  }
  function settingsHtml(c) {
    const tokenSaved = !!sessionStorage.getItem(KEY+'.token');
    return `<details class="bi-settings"><summary>Job requirements</summary>
      <p>Use confirmed client requirements. Unknown availability stays visible for confirmation.</p>
      ${field('Collection / season', 'biSeason', c.season)}
      <div class="bi-columns">${field('Booking start','biStart',c.start,'date')}${field('Booking end','biEnd',c.end,'date')}</div>
      ${field('Booking location','biLocation',c.location)}${field('Required agency division','biDivision',c.division)}
      <label><input id="biLocal" type="checkbox" ${c.localOnly?'checked':''}> Local models only</label>
      ${['height','bust','waist','hip','chest','inseam'].map(k => `<div class="bi-columns">${field('Minimum '+k+' cm','biMin-'+k,c.ranges?.[k]?.min??'','number')}${field('Maximum '+k+' cm','biMax-'+k,c.ranges?.[k]?.max??'','number')}</div>`).join('')}
      <button type="button" class="btn" id="biSaveContext">Apply requirements</button>
    </details><details class="bi-settings"><summary>Ranking and brand aliases</summary>
      <p>Unknown dimensions earn no points. Adjust the relative importance of each dimension.</p>
      <div class="bi-columns">${Object.entries(state.weights).map(([k,v])=>field(k,'biWeight-'+k,v,'number')).join('')}</div>
      <button type="button" class="btn" id="biSaveWeights">Save weights</button>
      ${field('Confirmed alternative name for this brand','biAlias','')}
      <button type="button" class="btn" id="biSaveAlias">Save alias</button>
    </details><details class="bi-settings"><summary>Research connection</summary>
      <p>Your provider key stays on the server. Enter the private CRM access token here. Research sends only the brand, season and job type.</p>
      ${field('HTTPS research endpoint','biEndpoint',state.endpoint||'','url')}${field('CRM access token (this tab only)','biToken','','password')}
      <p class="bi-token-status" role="status">${tokenSaved?'Access token saved for this tab. The password field is blank after saving; the token stays until you close this tab.':'No access token saved in this tab yet.'}</p>
      <button type="button" class="btn" id="biSaveEndpoint">Save connection</button>${tokenSaved?'<button type="button" class="btn" id="biClearToken">Clear this tab’s token</button>':''}
    </details>`;
  }
  function cardHtml(r, i) {
    return `<article class="bi-card"><div><b>${i+1}. ${esc(r.model.name)}</b> <span class="pill">${r.score}/100</span></div>
      <div class="tiny">${esc(r.eligibility.status)} · ${r.coverage}% evidence coverage · ${r.confidence} confidence</div>
      <div class="tiny">${esc(r.model.location||'Location unknown')} / ${esc(r.model.division||'Division unknown')}</div>
      <details><summary>Reasons and concerns</summary><p>${esc(r.model.stats||r.model.measurements||'Measurements unknown')}<br>Travel: ${r.model.canTravel===true?'Confirmed':r.model.canTravel===false?'No':'Unknown'}</p>
      <ul>${Object.entries(r.parts).map(([k,a])=>`<li>${esc(k)}: ${a.value}/100 · ${esc(a.reason)} ${a.sourceUrl?link(a.sourceUrl,'Evidence'):''}</li>`).join('')}</ul>
      <p>Unknown dimensions: ${esc(r.unknown.join(', ')||'None')}<br>${esc(r.concerns.join('; '))}</p></details>
      <div class="actions"><button type="button" class="btn" data-bi-add="${esc(r.model.id)}" ${selected.includes(r.model.id)?'disabled':''}>${selected.includes(r.model.id)?'Already in package':'Add to package'}</button>
      <button type="button" class="btn" data-bi-review="${esc(r.model.id)}">Assess portfolio</button></div></article>`;
  }
  function researchHtml(p, c) {
    let html = `<h3>${esc(p.brand)}</h3><p>${link(p.officialWebsite,'Official website')} · ${esc(p.season)}<br>Research context: ${esc(p.jobType)}<br>Researched ${esc(p.researchedAt.slice(0,10))} · ${esc(p.confidence)} research confidence${B.stale(p,c.season)?'<br><b>Refresh advised: this research is older than 30 days or relates to a different season.</b>':''}</p>`;
    for (const section of ['Brand Profile','Casting Intelligence','Current Collection']) {
      html += `<details ${section==='Brand Profile'?'open':''}><summary>${section}</summary>${p.claims.filter(x=>x.section===section).map(x=>`<p><b>${esc(x.label)}</b> <span class="pill">${x.status}</span><br>${esc(x.value)} ${x.sourceIds.map(id=>{const s=p.sources.find(s=>s.id===id);return link(s.url,'['+s.id+']');}).join(' ')}</p>`).join('')||'<p>Unknown: no supported findings.</p>'}</details>`;
    }
    html += `<details><summary>Sources (${p.sources.length}) and visual references</summary>${p.sources.map(s=>`<p>${link(s.url,s.id+'. '+s.title)}<br>${esc(s.kind)} · ${esc(s.publishedAt||'Publication date unknown')}<br>${esc(s.summary)}</p>`).join('')}${p.referenceSources.map(s=>`<p>${link(s.url,s.label)}</p>`).join('')}${p.visualDescriptors.map(d=>`<p>${esc(d.kind)}: ${esc(d.value)} <span class="pill">${esc(d.status)}</span></p>`).join('')}</details>`;
    return html;
  }
  function render() {
    const host = el('brandLookSuggestion'); if (!host) return;
    const p = profile(), c = context(), ranked = rows(), eligible = ranked.filter(r=>r.eligibility.status!=='Ineligible');
    host.classList.add('bi-panel');
    host.innerHTML = `<div aria-live="polite">${esc(loadError||message||'Research and portfolio decision support')}</div>
      <label class="bi-field">Job type <select id="biJob">${B.JOBS.map(j=>`<option ${c.jobType===j?'selected':''}>${esc(j)}</option>`).join('')}</select></label>
      ${settingsHtml(c)}
      ${!brand()?'<p>Enter a brand to begin.</p>':!p?'<p>No saved research for this brand. Analyze Brand uses your research service, or import a reviewed profile.</p>':researchHtml(p,c)}`;
    if (p) {
      host.insertAdjacentHTML('beforeend', `<h4>Recommended models</h4><p class="tiny">Evidence points out of 100, with missing dimensions shown separately. A shortlist with low coverage needs portfolio review.</p>
        ${eligible.length?eligible.slice(0,8).map(cardHtml).join(''):'<p>No eligible models for these requirements.</p>'}
        <details><summary>Review another eligible model</summary><label class="bi-field">Model<select id="biReviewModel">${eligible.map(r=>`<option value="${esc(r.model.id)}">${esc(r.model.name)}</option>`).join('')}</select></label><button type="button" class="btn" id="biReviewAny" ${eligible.length?'':'disabled'}>Assess portfolio</button></details>
        <details><summary>Excluded / ineligible (${ranked.length-eligible.length})</summary>${ranked.filter(r=>r.eligibility.status==='Ineligible').map(r=>`<p>${esc(r.model.name)}: ${esc(r.eligibility.excluded.join('; '))}</p>`).join('')}</details>
        <details><summary>Previously submitted</summary>${ranked.filter(r=>r.history.count).map(r=>`<p>${esc(r.model.name)}: ${r.history.count} total, last ${esc(r.history.last||'date unknown')}<br>${esc(r.history.outcomes.map(o=>[o.date,o.event,o.status].filter(Boolean).join(' · ')).join('; '))}</p>`).join('')||'<p>No matching history recorded. The client may have seen models through other channels.</p>'}</details>`);
    }
    host.insertAdjacentHTML('beforeend', `<details><summary>Import / export research</summary><p>Import one sourced profile or restore a research backup. Existing profiles are kept unless the backup contains newer research for the same brand.</p><input id="biImport" type="file" accept="application/json"><button type="button" class="btn" id="biExport">Export research backup</button>${loadError?'<button type="button" class="btn" id="biRecoveryExport">Export unreadable recovery copy</button>':''}</details><div id="biReview"></div>`);
    bindControls(c);
    const analyze = el('brandWebSearchBtn');
    if (analyze) { analyze.textContent = busy?'Researching…':'Analyze Brand'; analyze.disabled = busy; }
    let refresh = el('biRefreshResearch');
    if (!refresh && analyze) { refresh = document.createElement('button'); refresh.id='biRefreshResearch'; refresh.type='button'; refresh.className='btn'; analyze.after(refresh); }
    if (refresh) { refresh.textContent='Refresh research'; refresh.disabled=busy||!brand(); refresh.onclick=()=>analyzeBrand(true); }
  }
  function bindControls(c) {
    el('biJob').onchange = () => act(()=>storeContext({...c,jobType:el('biJob').value}));
    el('biSaveContext').onclick = () => act(async()=>{
      const ranges={};
      for(const k of ['height','bust','waist','hip','chest','inseam']) {
        const min=el('biMin-'+k).value,max=el('biMax-'+k).value;
        if(min||max) ranges[k]={min:min?Number(min):null,max:max?Number(max):null};
      }
      await storeContext({...c,start:el('biStart').value,end:el('biEnd').value,season:el('biSeason').value.trim(),location:el('biLocation').value.trim(),division:el('biDivision').value.trim(),localOnly:el('biLocal').checked,ranges});
    });
    el('biSaveEndpoint').onclick = () => act(()=>{
      const endpoint=B.url(el('biEndpoint').value);if(!endpoint)throw Error('Enter a valid HTTPS endpoint.');
      const token=el('biToken').value.trim();
      if(endpoint!==state.endpoint)sessionStorage.removeItem(KEY+'.token');
      state.endpoint=endpoint;if(token)sessionStorage.setItem(KEY+'.token',token);
      persist();message=token?'Access token saved for this tab.':sessionStorage.getItem(KEY+'.token')?'Connection saved; this tab’s access token is still available.':'Endpoint saved. Paste the private CRM access token to enable research.';
    });
    if(el('biClearToken'))el('biClearToken').onclick=()=>act(()=>{sessionStorage.removeItem(KEY+'.token');message='Access token cleared from this tab.';});
    el('biSaveWeights').onclick=()=>act(()=>{
      const w=Object.fromEntries(Object.keys(B.WEIGHTS).map(k=>[k,Number(el('biWeight-'+k).value)]));
      if(Object.values(w).some(v=>!Number.isFinite(v)||v<0)||!Object.values(w).some(v=>v>0))throw Error('Use nonnegative weights and at least one positive value.');
      state.weights=w;persist();
    });
    el('biSaveAlias').onclick=()=>act(()=>{
      const a=B.norm(el('biAlias').value),k=brandKey();
      if(!a||!k||a===k)throw Error('Enter a different, confirmed alias.');
      if(Object.hasOwn(state.profiles,a)||Object.hasOwn(state.aliases,a))throw Error('This name has its own research or alias. It was not merged.');
      state.aliases[a]=k;persist();
    });
    el('brandLookSuggestion').querySelectorAll('[data-bi-add]').forEach(b=>b.onclick=()=>act(()=>{
      const r=rows().find(r=>r.model.id===b.dataset.biAdd);
      if(!r||r.eligibility.status==='Ineligible')throw Error('Eligibility changed. Review the shortlist.');
      addToEmail(r.model.id);message='Added '+r.model.name+' to the current package.';
    }));
    if(el('biReviewAny'))el('biReviewAny').onclick=()=>review(el('biReviewModel').value);
    el('brandLookSuggestion').querySelectorAll('[data-bi-review]').forEach(b=>b.onclick=()=>review(b.dataset.biReview));
    el('biImport').onchange=e=>importResearch(e.target.files[0]);
    el('biExport').onclick=()=>download(JSON.stringify({...state,version:1},null,2),'brand-intelligence-backup.json');
    if(el('biRecoveryExport'))el('biRecoveryExport').onclick=()=>download(originalRaw,'brand-intelligence-recovery.json');
  }
  async function importResearch(file) {
    if(!file)return;
    const before=structuredClone(state),errorBefore=loadError;
    try {
      if(file.size>1800000)throw Error('Research import exceeds 1.8 MB.');
      const raw=JSON.parse(await file.text());
      if(raw.version===1&&raw.profiles) {
        const incoming=readState(JSON.stringify(raw));
        for(const [key,p] of Object.entries(incoming.profiles)) {
          if(!Object.hasOwn(state.profiles,key)||Date.parse(p.researchedAt)>=Date.parse(state.profiles[key].researchedAt))state.profiles[key]=p;
        }
        for(const [key,p] of Object.entries(incoming.researchCache)){if(!state.researchCache[key]||Date.parse(p.researchedAt)>=Date.parse(state.researchCache[key].researchedAt))state.researchCache[key]=p;}
        for(const [alias,target] of Object.entries(incoming.aliases)) {
          if(!Object.hasOwn(state.profiles,alias)&&!Object.hasOwn(state.aliases,alias))state.aliases[alias]=target;
        }
        state.assessments={...incoming.assessments,...state.assessments};
        state.modelPortfolioProfiles={...incoming.modelPortfolioProfiles,...state.modelPortfolioProfiles};
        message='Research restored. Your current connection and job settings were retained.';
      } else {
        const p=B.validate(raw);
        if(B.key(p.brand,state.aliases)!==brandKey())throw Error('Imported brand does not match the current brand.');
        state.profiles[brandKey()]=p;if(p.jobType===context().jobType)state.researchCache[researchScope()]=p;message='Reviewed profile imported.';
      }
      if(loadError) { localStorage.setItem(KEY+'.recovery',originalRaw); loadError=''; }
      readState(JSON.stringify({...state,version:1}));
      persist();
    } catch(e) {state=before;loadError=errorBefore;message=e.message;}
    render();
  }
  function review(id) {
    const p=profile(),c=context(),k=assessmentKey(),m=db.models.find(m=>m.id===id),host=el('biReview');if(!m||!p)return;
    host.innerHTML=`<h4>Portfolio assessment: ${esc(m.name)}</h4><p>Assess documented garment presentation, styling and job skills. Include a supporting portfolio or show link.</p>
      <label class="bi-field">Dimension<select id="biDimension"><option value="visual">Current collection presentation</option><option value="casting">Relevant casting experience</option><option value="portfolio">Portfolio suitability</option></select></label>
      ${field('Assessment 0 to 100','biValue','','number')}${field('Reason grounded in work samples','biReason','')}${field('Supporting source URL','biSource','','url')}
      <button type="button" class="btn" id="biSaveReview">Save assessment</button>`;
    el('biSaveReview').onclick=()=>act(()=>{
      const v=el('biValue').value,value=Number(v),sourceUrl=B.url(el('biSource').value),reason=el('biReason').value.trim();
      if(!v||!Number.isFinite(value)||value<0||value>100||!sourceUrl||!reason)throw Error('Enter a score, reason and HTTPS source.');
      state.assessments[k]||={};state.assessments[k][id]||={};
      state.assessments[k][id][el('biDimension').value]={value,sourceUrl,reason,season:p.season,jobType:c.jobType,reviewedAt:new Date().toISOString()};
      persist();message='Portfolio assessment saved for '+m.name+'.';
    });
  }
  async function bootstrap() {
    if(bootPromise)return bootPromise;
    bootPromise=(async()=>{
      try {
        const res=await fetch('assets/data/brand-intelligence.json');if(!res.ok)throw Error('Starter research unavailable.');
        for(const raw of await res.json()) {
          const p=B.validate(raw),k=B.key(p.brand,state.aliases);if(!Object.hasOwn(state.profiles,k))state.profiles[k]=p;
        }
        if(!loadError)persist();
      } catch(e) {message=e.message;}
      render();
    })();return bootPromise;
  }
  async function analyzeBrand(force=false) {
    await bootstrap();
    const name=brand(),k=brandKey(),c=context();
    if(!name)return act(()=>{throw Error('Enter a brand first.');});
    if(busy)return;
    if(loadError)return render();
    const saved=profile();
    if(!force&&saved&&!B.stale(saved,c.season)&&saved.jobType===c.jobType) {message='Showing saved research. Use Refresh research for a new source check.';render();return;}
    if(!state.endpoint) {message='Configure a research connection or import a sourced profile.';render();return;}
    busy=true;message='Researching current sources…';render();
    try {
      const res=await fetch(state.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(sessionStorage.getItem(KEY+'.token')||'')},body:JSON.stringify({brand:name,season:c.season,jobType:c.jobType}),signal:AbortSignal.timeout(90000)});
      if(!res.ok){const error=await res.json().catch(()=>({}));throw Error(error.error||'Research service failed ('+res.status+'). Saved research was retained.');}
      const p=B.validate(await res.json());if(B.key(p.brand,state.aliases)!==k)throw Error('The service returned a different brand. Saved research was retained.');if(p.jobType!==c.jobType)throw Error('The service returned research for a different job type. Saved research was retained.');
      const old=state.profiles[k],cacheKey=researchScope(k,c),oldCache=state.researchCache[cacheKey];state.profiles[k]=p;state.researchCache[cacheKey]=p;
      try{persist();}catch(e){if(old)state.profiles[k]=old;else delete state.profiles[k];if(oldCache)state.researchCache[cacheKey]=oldCache;else delete state.researchCache[cacheKey];throw e;}
      message='Research saved for '+name+'.';
    } catch(e) {message=e.name==='TimeoutError'?'Research timed out. Saved research was retained.':e.message;}
    finally {busy=false;render();}
  }
  window.clmRenderBrandIntelligence=render;
  window.clmAnalyzeBrand=()=>analyzeBrand(false);
  window.clmRefreshBrandIntelligence=()=>analyzeBrand(true);
  const research=el('brandWebSearchBtn');if(research)research.onclick=()=>analyzeBrand(false);
  const suggest=el('suggestLookBtn');if(suggest){suggest.textContent='Review saved intelligence';suggest.onclick=()=>{bootstrap();render();};}
  render();bootstrap();
})();
