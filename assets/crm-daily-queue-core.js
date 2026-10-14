/* Daily evidence accounting. No media, gallery or email mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CLMDailyQueueCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const kinds=['package','job','followup','gosee','shoot','brand'];
const norm=v=>String(v||'').trim().toLowerCase();
const emails=v=>(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]).filter(e=>!e.endsWith('@chezlesmannequins.com')&&e!=='justin.neal.chezlesmannequins@gmail.com');
function day(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.href:'';}catch{return '';}}
function shootReady(s){return Boolean(s&&s.date&&s.time&&s.location&&s.team&&s.terms&&s.delivery&&s.modelConfirmed&&s.teamConfirmed);}
function sentEvidence(s){if(s?.channel==='platform')return Boolean(s.evidenceVerified&&s.confirmationId&&safeUrl(s.evidenceUrl));return Boolean(s&&emails(s.email||s.recipient).length&&(s.gmailMessageId||s.evidenceVerified&&safeUrl(s.gmailUrl||s.evidenceUrl)));}
function count({date,models=[],entries=[],submissions=[],drafts=[]}){
 const packages=new Set(),followups=new Set(),gosees=new Set(),jobs={},shoots=new Set(),outreach={};
 for(const m of models){jobs[m.id]=new Set();outreach[m.id]=new Set();}
 const receipts=[];
 for(const s of submissions){if(s.date!==date||!sentEvidence(s))continue;const d=drafts.find(d=>d.id===s.draftId);const q=entries.find(q=>q.id===(s.queueId||d?.queueId)||q.draftId&&q.draftId===s.draftId);receipts.push({...s,kind:q?.kind||'package',opportunityId:q?.opportunityId||q?.id||s.project||s.subject,eligible:q?.eligible,liveVerified:q?.liveVerified,modelIds:s.modelIds?.length?s.modelIds:q?.modelIds||[]});}
 for(const q of entries)for(const receipt of q.receipts||[]){if(receipt.date===date&&sentEvidence(receipt))receipts.push({...receipt,kind:q.kind,opportunityId:q.opportunityId||q.id,eligible:q.eligible,liveVerified:q.liveVerified,modelIds:receipt.modelIds||q.modelIds||[]});}
 for(const s of receipts){const to=emails(s.email||s.recipient);const key=norm(s.opportunityId)+'|'+to.slice().sort().join(',');
 if(s.kind==='followup'){to.forEach(e=>followups.add(e));continue;}
 if(s.kind==='shoot'){continue;}
 if(s.channel!=='platform'&&(s.kind==='package'||s.kind==='brand'))packages.add(key);
 for(const id of s.modelIds||[]){if(!jobs[id])continue;if(s.kind==='job'&&s.eligible===true&&s.liveVerified===true)jobs[id].add(norm(s.opportunityId));else outreach[id].add(key);if(s.kind==='gosee')gosees.add(id+'|'+to.join(','));}
 }
 for(const q of entries)if(q.kind==='shoot'&&q.confirmedOn===date&&shootReady(q.shoot))shoots.add(q.id);
 return {packages:packages.size,followups:followups.size,gosees:gosees.size,shoots:shoots.size,jobs:Object.fromEntries(Object.entries(jobs).map(([k,v])=>[k,v.size])),outreach:Object.fromEntries(Object.entries(outreach).map(([k,v])=>[k,v.size]))};
}
function validateImport(data){if(!data||data.version!==1||!Array.isArray(data.entries)||data.entries.length>2000)throw Error('Use a version 1 daily queue file with at most 2,000 entries.');const ids=new Set();return data.entries.map(q=>{if(!q||typeof q.id!=='string'||!q.id||ids.has(q.id)||!kinds.includes(q.kind)||typeof q.title!=='string')throw Error('Invalid or duplicate queue item.');ids.add(q.id);if(q.sources&&!Array.isArray(q.sources))throw Error('Sources must be a list.');if(q.modelIds&&!Array.isArray(q.modelIds))throw Error('Model IDs must be a list.');return {...q,sources:(q.sources||[]).map(safeUrl).filter(Boolean),status:['Review','Ready','Waiting','Blocked','Done'].includes(q.status)?q.status:'Review'};});}
return {day,norm,emails,safeUrl,count,shootReady,validateImport};
});
