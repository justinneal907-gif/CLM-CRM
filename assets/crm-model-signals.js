/* Submission-aware Squarespace model links and explicitly imported GA4 results. */
(function(){
  'use strict';
  if(window.__clmModelSignalsLoaded)return;window.__clmModelSignalsLoaded=true;
  const q=s=>document.querySelector(s);
  function records(){return db.modelSignalPackages||(db.modelSignalPackages=[])}
  function save(){if(typeof persistWorkspaceSafe==='function')persistWorkspaceSafe(false)}
  window.clmPrepareModelSignals=function(html,forceNew=false,context=null){
    if(db.settings?.modelSignalsEnabled!==true)return html;
    const target=context||{id:db.activeDraftId,record:db.draft,models:typeof selectedModels==='function'?selectedModels():[]};
    const saved=(db.drafts||[]).find(d=>d.id===target.id);
    let id=target.record.modelSignalSubmissionId;
    const prior=records().find(p=>p.id===id);
    if(forceNew||!prior||prior.sentAt)id=crypto.randomUUID().replace(/-/g,'');
    const holder=document.createElement('div');holder.innerHTML=html;
    const linked=new Set();
    target.models.forEach((model,index)=>{
      let profile;try{profile=new URL(model.profile)}catch{return}
      if(!['chezlesmannequins.com','www.chezlesmannequins.com'].includes(profile.hostname)||profile.protocol!=='https:'||profile.pathname==='/search')return;
      holder.querySelectorAll('a[href]').forEach(a=>{
        let url;try{url=new URL(a.getAttribute('href'))}catch{return}
        if(url.origin!==profile.origin||url.pathname!==profile.pathname)return;
        url.searchParams.set('clm_submission',id);url.searchParams.set('clm_model',model.id);url.searchParams.set('clm_position',String(index+1));
        a.href=url.href;linked.add(model.id);
      });
    });
    if(!linked.size)id='';
    target.record.modelSignalSubmissionId=id;if(saved)saved.modelSignalSubmissionId=id;
    if(db.activeDraftId===target.id)db.draft.modelSignalSubmissionId=id;
    if(!linked.size){save();return html}
    const snapshot={id,draftId:target.id||'',subject:target.record.subject||'',brand:target.record.brandProject||target.record.company||'',modelIds:[...linked],createdAt:new Date().toISOString()};
    const existing=records().find(p=>p.id===id);if(existing)Object.assign(existing,snapshot);else records().push(snapshot);
    save();return holder.innerHTML;
  };
  window.clmMarkModelSignalSent=function(d,sub){
    const p=records().find(p=>p.id===d?.modelSignalSubmissionId);if(!p)return;
    p.sentAt=p.sentAt||d.submittedAt||new Date().toISOString();p.gmailMessageId=sub.gmailMessageId||d.gmailMessageId||'';
    sub.modelSignalSubmissionId=p.id;save();render();
  };
  function render(){
    const el=q('#modelSignalResults');if(!el)return;
    const imported=db.settings?.modelSignalsLastImport;
    const results=window.CLMModelSignals.aggregate(records(),db.modelSignalEvents||[]);
    el.innerHTML='';
    const status=document.createElement('p');status.className='muted';
    status.textContent=imported?'Last event import: '+new Date(imported).toLocaleString()+'. No live analytics connection.':
      'Not connected. No model-visit data has been imported. These are separate from email-open signals.';
    el.appendChild(status);
    if(!imported)return;
    const wrap=document.createElement('div');wrap.className='table-wrap';
    const table=document.createElement('table');table.innerHTML='<thead><tr><th>Model</th><th>Visited packages</th><th>Visit rate</th><th>Sessions</th><th>Repeat visitors</th><th>Interacted sessions</th></tr></thead>';
    const body=document.createElement('tbody');
    results.models.forEach(m=>{
      const row=document.createElement('tr');
      [db.models.find(x=>x.id===m.modelId)?.name||m.modelId,m.visited+' / '+m.submitted,Math.round(m.visitRate*100)+'%',m.sessions,m.repeatVisitors,m.interactedSessions].forEach(value=>{const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell)});
      body.appendChild(row);
    });table.appendChild(body);wrap.appendChild(table);el.appendChild(wrap);
    const note=document.createElement('p');note.className='muted';note.textContent='Visit rate = sent packages with a model-page visit ÷ tracked sent packages containing that model. It is not email CTR. Repeat visitors require different sessions within a package; device identity does not identify a person. '+results.rejected+' unverified, internal, unmatched or invalid events excluded.';el.appendChild(note);
    const packages=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Visits by package';packages.appendChild(summary);
    records().filter(p=>p.sentAt).forEach(p=>{const r=window.CLMModelSignals.aggregate([p],db.modelSignalEvents||[]);const line=document.createElement('p');line.textContent=(p.brand||p.subject||'Package')+': '+r.models.filter(m=>m.visited).map(m=>db.models.find(x=>x.id===m.modelId)?.name||m.modelId).join(', ');if(!r.models.some(m=>m.visited))line.textContent+='No visits in imported data';packages.appendChild(line)});el.appendChild(packages);
  }
  function init(){
    const anchor=q('#gmailApiPanel');if(!anchor||typeof db==='undefined')return setTimeout(init,200);
    const panel=document.createElement('details');panel.className='panel';panel.style.marginBottom='16px';
    panel.innerHTML='<summary><b>Model-page signals</b></summary><p>Squarespace visits and interactions, linked to each submission. Setup on the agency website is required.</p><p><a href="docs/model-signals-setup.md" target="_blank" rel="noopener">Setup instructions</a> · <a href="https://www.chezlesmannequins.com/?clm_staff=1" target="_blank" rel="noopener">Exclude this browser on the agency website</a></p><p class="muted">The staff link works only after the website script is installed. Office exclusion must cover your public IPv4 and IPv6 addresses. This cannot identify the agent@ mailbox on an unmarked device.</p><label><input id="enableModelSignals" type="checkbox"> Website script, consent and office/staff exclusions are installed and tested; add submission IDs to new Gmail draft links.</label><div class="actions" style="margin-top:12px"><label class="btn">Import verified event JSON<input id="modelSignalImport" type="file" accept="application/json" hidden></label></div><p id="modelSignalImportStatus" role="status"></p><div id="modelSignalResults"></div>';
    anchor.insertAdjacentElement('afterend',panel);
    q('#enableModelSignals').checked=db.settings?.modelSignalsEnabled===true;
    q('#enableModelSignals').addEventListener('change',e=>{db.settings=db.settings||{};db.settings.modelSignalsEnabled=e.target.checked;save();render()});
    q('#modelSignalImport').addEventListener('change',async e=>{
      try{
        const file=e.target.files[0];if(!file)return;if(file.size>15000000)throw new Error('File is too large. Split the export into smaller batches.');
        const incoming=window.CLMModelSignals.normalizeBatch(JSON.parse(await file.text()));
        const key=x=>[x.event_name,x.submission_id,x.model_id,x.visitor_id,x.session_id,x.timestamp].join('|');
        db.modelSignalEvents=[...new Map([...(db.modelSignalEvents||[]),...incoming].map(x=>[key(x),x])).values()];
        db.settings=db.settings||{};db.settings.modelSignalsLastImport=new Date().toISOString();save();render();
        q('#modelSignalImportStatus').textContent='Imported '+incoming.length+' event rows. Repeated imports do not multiply counts.';
      }catch(err){q('#modelSignalImportStatus').textContent=err.message}finally{e.target.value=''}
    });render();
  }
  init();
})();
