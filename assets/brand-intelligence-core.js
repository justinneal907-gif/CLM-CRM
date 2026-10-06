/* Pure decision support. No media writes, demographic ranking, or email generation. */
(function(root){
'use strict';
const WEIGHTS={visual:30,casting:20,job:15,measurements:15,portfolio:10,freshness:10};
const JOBS=['Runway','Presentation','Bridal Week / Bridal Market','Lookbook','E-commerce','Editorial','Showroom','Fit model','General submission'];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function key(name,aliases={}){const n=norm(name);return Object.hasOwn(aliases,n)?aliases[n]:n;}
function locationKey(s){const n=norm(s),aliases={nyc:'new york','new york city':'new york','new york ny':'new york','los angeles ca':'los angeles',la:'los angeles',milano:'milan','miami fl':'miami'};return Object.hasOwn(aliases,n)?aliases[n]:n;}
function url(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function validate(p){
 if(!p||typeof p!=='object'||!norm(p.brand)||!Array.isArray(p.sources)||!Array.isArray(p.claims))throw Error('Research requires brand, sources and claims.');
 if(!Number.isFinite(Date.parse(p.researchedAt))||Date.parse(p.researchedAt)>Date.now()+86400000)throw Error('Invalid research date.');
 if(p.sources.length>40||p.claims.length>80)throw Error('Research is too large.');
 const sources=p.sources.map((s,i)=>({id:String(s.id||i),url:url(s.url),title:String(s.title||'Source').slice(0,300),publishedAt:String(s.publishedAt||''),accessedAt:String(s.accessedAt||p.researchedAt),kind:String(s.kind||'reference'),summary:String(s.summary||'').slice(0,1400)}));
 if(sources.some(s=>!s.url)||new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('Sources need unique IDs and valid HTTPS URLs.');
 const ids=new Set(sources.map(s=>s.id));
 const claims=p.claims.map(c=>{if(!['Brand Profile','Casting Intelligence','Current Collection'].includes(c.section))throw Error('Invalid finding section.');if(!['Verified','Observed','Inferred','Unknown'].includes(c.status))throw Error('Invalid evidence label.');const refs=(c.sourceIds||[]).map(String);if(refs.some(id=>!ids.has(id))||(c.status!=='Unknown'&&!refs.length))throw Error('Each finding needs a supporting source.');return {section:String(c.section||'Brand Profile').slice(0,80),label:String(c.label||'Finding').slice(0,120),value:String(c.value||'Unknown').slice(0,1600),status:c.status,sourceIds:refs};});
 const descriptors=(p.visualDescriptors||[]).slice(0,30).map(d=>{if(!['garment','styling','presentation','movement','work'].includes(d.kind)||!['Verified','Observed','Inferred'].includes(d.status)||!(d.sourceIds||[]).length||(d.sourceIds||[]).some(id=>!ids.has(String(id))))throw Error('Portfolio descriptors require supported work evidence.');return {kind:d.kind,value:String(d.value||'').slice(0,400),status:d.status,sourceIds:d.sourceIds.map(String)};});
 return {schemaVersion:1,brand:String(p.brand).slice(0,160),officialWebsite:url(p.officialWebsite),season:String(p.season||'Unknown').slice(0,160),jobType:JOBS.includes(p.jobType)?p.jobType:'General submission',researchedAt:p.researchedAt,confidence:['Low','Medium','High'].includes(p.confidence)?p.confidence:'Low',sources,claims,visualDescriptors:descriptors,referenceSources:(p.referenceSources||[]).slice(0,20).map(s=>({url:url(s.url),label:String(s.label||'Visual reference').slice(0,200)})).filter(s=>s.url)};
}
function validateContext(c){
 if(!c||!JOBS.includes(c.jobType))throw Error('Choose a supported job type.');
 const start=day(c.start),end=day(c.end);if((c.start&&!start)||(c.end&&!end)||(start&&end&&start>end))throw Error('Invalid booking date range.');
 const ranges={};for(const label of ['height','bust','waist','hip','chest','inseam']){const r=c.ranges?.[label];if(!r)continue;const min=r.min==null?null:Number(r.min),max=r.max==null?null:Number(r.max);if((min!=null&&(!Number.isFinite(min)||min<=0))||(max!=null&&(!Number.isFinite(max)||max<=0))||(min!=null&&max!=null&&min>max))throw Error('Invalid '+label+' range.');if(min!=null||max!=null)ranges[label]={min,max};}
 return {jobType:c.jobType,start,end,season:String(c.season||'').slice(0,160),location:String(c.location||'').slice(0,160),division:String(c.division||'').slice(0,160),localOnly:!!c.localOnly,ranges};
}
function measurement(m,label){
 const text=String(m.stats||m.measurements||'');const part=text.split('|').find(x=>norm(x.split(':')[0])===label||(label==='hip'&&norm(x.split(':')[0])==='hips'));if(!part)return null;
 const raw=part.slice(part.indexOf(':')+1);let x=raw.match(/(\d+(?:\.\d+)?)\s*cm/i);if(x)return +x[1];
 if(label==='height'){x=raw.match(/(\d+)\s*['’′]\s*(\d+(?:\.\d+)?)/);if(x)return (+x[1]*12 + +x[2])*2.54;}
 x=raw.match(/(\d+(?:\.\d+)?)\s*(?:in|["”’′'])/i);return x?+x[1]*2.54:null;
}
function day(s){const value=String(s||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))return '';return new Date(value).toISOString().slice(0,10)===value?value:'';}
function eligibility(m,c={}){
 const excluded=[],pending=[];if(m.activeBoard===false||m.archived===true)excluded.push('Inactive model');
 const start=day(c.start),end=day(c.end)||start,from=day(m.statusFrom),to=day(m.statusTo);
 const overlaps=start&&(!from||end>=from)&&(!to||start<=to);
 if(['Booked','Unavailable','Traveling'].includes(m.availabilityStatus)){if(overlaps)excluded.push(m.availabilityStatus+' during booking dates');else if(!start||(!from&&!to))pending.push('Confirm availability dates');}
 if(!start)pending.push('Booking dates not confirmed');
 if(m.availabilityStatus==='Available'&&start&&((from&&from>start)||(to&&to<end)))pending.push('Availability confirmation does not cover these dates');
 if(m.availabilityStatus!=='Available'&&!excluded.some(x=>x.includes('booking dates')))pending.push('Availability: '+(m.availabilityStatus||'Unknown'));
 if(c.division&&norm(c.division)!==norm(m.division)) {if(m.division)excluded.push('Different required division');else pending.push('Division unknown');}
 if(c.location&&!m.location)pending.push('Location unknown');
 if(c.location&&m.location&&locationKey(c.location)!==locationKey(m.location)){
  if(c.localOnly&&m.location)excluded.push('Local-only booking: different location');
  else if(m.canTravel===false)excluded.push('Travel required but unavailable');
  else if(m.canTravel!==true)pending.push('Location / travel needs confirmation');
 }
 for(const [label,r] of Object.entries(c.ranges||{})){
  if(!['height','bust','waist','hip','chest','inseam'].includes(label))continue;
  const v=measurement(m,label);if(v===null)pending.push(label+' measurement missing');
  else if((r.min!=null&&v<r.min)||(r.max!=null&&v>r.max))excluded.push(label+' outside confirmed client range');
 }
 return {status:excluded.length?'Ineligible':pending.length?'Needs confirmation':'Eligible',excluded,pending:[...new Set(pending)]};
}
function history(m,brand,submissions,aliases={},now=Date.now()){
 const rows=submissions.filter(s=>(s.modelIds||[]).length?(s.modelIds||[]).includes(m.id):((s.models||[]).some(n=>norm(n)===norm(m.name))));
 const same=rows.filter(s=>[s.company,s.project,s.brand].some(b=>b&&key(b,aliases)===key(brand,aliases)));
 const recent=rows.filter(s=>{const t=Date.parse(s.date);return Number.isFinite(t)&&t<=now&&now-t<=30*86400000;});
 const recentSame=same.filter(s=>recent.includes(s));
 return {count:same.length,recent:recent.length,recentSame:recentSame.length,last:same.map(s=>day(s.date)).filter(Boolean).sort().at(-1)||'',events:[...new Set(same.map(s=>s.project).filter(Boolean))],outcomes:same.map(s=>({date:s.date,status:s.status||'Submitted',event:s.project||''}))};
}
function jobScore(m,job){
 const niches=[m.niche,m.secondaryNiche].filter(Boolean);
 const expected={Runway:['Luxury / Runway'],Presentation:['Luxury / Runway','Fashion-Commercial'],'Bridal Week / Bridal Market':['Luxury / Runway','Fashion-Commercial'],Lookbook:['Fashion-Commercial','High Fashion / Editorial'],'E-commerce':['Commercial / Lifestyle','Fashion-Commercial'],Editorial:['High Fashion / Editorial'],Showroom:['Fashion-Commercial','Luxury / Runway']};
 if(!expected[job]||!niches.length)return null;
 return {value:niches.some(n=>expected[job].includes(n))?75:40,reason:'Inferred from existing CRM portfolio category: '+niches.join(', '),confidence:'Low'};
}
function rank(models,profile,context,submissions=[],assessments={},aliases={},weights=WEIGHTS,now=Date.now()){
 return models.map(m=>{
  const e=eligibility(m,context),h=history(m,profile.brand,submissions,aliases,now),parts={};
  const review=assessments[m.id]||{};
  // Assessments are explicitly reviewed, source-backed job evidence, never generated from faces.
  for(const k of ['visual','casting','portfolio']) {const a=review[k];if(a&&a.season===profile.season&&a.jobType===context.jobType&&a.value!==null&&Number.isFinite(a.value)&&a.value>=0&&a.value<=100&&a.reason&&url(a.sourceUrl))parts[k]={value:a.value,reason:a.reason,sourceUrl:url(a.sourceUrl),confidence:'Low'};}
  const j=jobScore(m,context.jobType);if(j)parts.job=j;
  const ranges=Object.keys(context.ranges||{});if(ranges.length&&ranges.every(k=>measurement(m,k)!==null)&&!e.excluded.some(s=>s.includes('client range')))parts.measurements={value:100,reason:'Meets the confirmed garment ranges entered for this job'};
  parts.freshness={value:Math.max(0,100-h.recentSame*30-h.recent*3),reason:h.count?`${h.count} submissions to this brand; ${h.recentSame} in 30 days. ${h.recent} total recent submissions.`:`No submission to this brand recorded; ${h.recent} total in 30 days. History may be incomplete.`};
  let total=0,available=0,possible=0;for(const [k,w] of Object.entries(weights)){if(!(w>=0&&Number.isFinite(w)))continue;possible+=w;if(parts[k]){available+=w;total+=parts[k].value*w;}}
  const coverage=possible?Math.round(available/possible*100):0;
  // Report earned points against all weights: unknown dimensions never become 100% fit.
  const score=possible?Math.round(total/possible):0;
  return {model:m,eligibility:e,history:h,parts,score,coverage,confidence:coverage>=80&&profile.confidence==='High'?'Medium':'Low',unknown:Object.keys(WEIGHTS).filter(k=>!parts[k]),concerns:[...e.pending,...(h.recentSame?['Deprioritized for recent submissions to this brand']:[])]};
 }).sort((a,b)=>(a.eligibility.status==='Ineligible')-(b.eligibility.status==='Ineligible')||b.score-a.score||a.model.name.localeCompare(b.model.name));
}
function stale(p,season='',now=Date.now()){return now-Date.parse(p.researchedAt)>30*86400000||(season&&norm(season)!==norm(p.season));}
const api={WEIGHTS,JOBS,norm,key,locationKey,url,validate,validateContext,measurement,eligibility,history,rank,stale};
if(typeof module==='object')module.exports=api;else root.CLMBrandIntelligence=api;
})(typeof window==='object'?window:globalThis);
