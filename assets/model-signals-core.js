/* Pure model-visit aggregation. No email-open counts are used. */
(function(root){
  'use strict';
  function aggregate(packages,events){
    const sent=packages.filter(p=>p.sentAt),byId=new Map(sent.map(p=>[p.id,p]));
    const models=new Map(),seen=new Set();let rejected=0;
    for(const p of sent)for(const id of p.modelIds||[]){
      if(!models.has(id))models.set(id,{modelId:id,submitted:new Set(),visited:new Set(),sessions:new Set(),visitors:new Map(),interactions:new Set(),lastAt:''});
      models.get(id).submitted.add(p.id);
    }
    for(const event of events){
      const p=byId.get(event.submission_id),when=Date.parse(event.timestamp);
      if(!p||!p.modelIds.includes(event.model_id)||!['model_view','model_interaction'].includes(event.event_name)||
        event.exclusion_verified!==true||event.staff===true||event.traffic_type==='internal'||event.bot===true||
        !Number.isFinite(when)||when<Date.parse(p.sentAt)||when>Date.now()+300000||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(event.visitor_id||'')||!/^[a-zA-Z0-9_-]{1,100}$/.test(event.session_id||'')){rejected++;continue}
      const key=[event.event_name,event.submission_id,event.model_id,event.visitor_id,event.session_id].join('|');
      if(seen.has(key))continue;seen.add(key);
      const m=models.get(event.model_id),session=[p.id,event.visitor_id,event.session_id].join('|');
      m.visited.add(p.id);m.sessions.add(session);
      const visitor=p.id+'|'+event.visitor_id;
      if(!m.visitors.has(visitor))m.visitors.set(visitor,new Set());
      m.visitors.get(visitor).add(event.session_id);
      if(event.event_name==='model_interaction')m.interactions.add(session);
      if(!m.lastAt||when>Date.parse(m.lastAt))m.lastAt=event.timestamp;
    }
    return {rejected,models:[...models.values()].map(m=>({modelId:m.modelId,submitted:m.submitted.size,visited:m.visited.size,
      sessions:m.sessions.size,uniqueVisitors:m.visitors.size,repeatVisitors:[...m.visitors.values()].filter(s=>s.size>1).length,
      interactedSessions:m.interactions.size,visitRate:m.submitted.size?m.visited.size/m.submitted.size:null,lastAt:m.lastAt}))};
  }
  function normalizeBatch(batch){
    if(batch?.schema!=='clm-model-signals-v1'||batch.office_filter_active!==true||batch.staff_exclusion_verified!==true||!Array.isArray(batch.events))
      throw new Error('Use a CLM event export with verified office and staff exclusions. Unverified traffic is not counted.');
    if(batch.events.length>50000)throw new Error('Import at most 50,000 events at a time.');
    return batch.events.map(e=>({event_name:e.event_name,submission_id:e.submission_id,model_id:e.model_id,
      position:e.position,visitor_id:e.visitor_id,session_id:e.session_id,timestamp:e.timestamp,staff:e.staff===true,
      traffic_type:e.traffic_type,bot:e.bot===true,exclusion_verified:true}));
  }
  const api={aggregate,normalizeBatch};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CLMModelSignals=api;
})(typeof window==='undefined'?globalThis:window);
