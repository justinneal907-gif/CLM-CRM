const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {aggregate,normalizeBatch}=require('../assets/model-signals-core.js');
const packages=[{id:'p1',modelIds:['m1','m2'],sentAt:'2026-01-01T00:00:00Z'},{id:'p2',modelIds:['m1'],sentAt:'2026-01-01T00:00:00Z'},{id:'draft',modelIds:['m1']}];
const base={event_name:'model_view',submission_id:'p1',model_id:'m1',visitor_id:'v1',session_id:'s1',timestamp:'2026-01-02T00:00:00Z',exclusion_verified:true};
let r=aggregate(packages,[base,base,{...base,event_name:'model_interaction'},{...base,session_id:'s2'},
 {...base,traffic_type:'internal',session_id:'s3'},{...base,staff:true,session_id:'s4'},{...base,bot:true},
 {...base,submission_id:'draft'},{...base,exclusion_verified:false},{...base,model_id:'other'},
 {...base,timestamp:'2025-01-01T00:00:00Z'}]);
assert.equal(r.rejected,7);
const m=r.models.find(x=>x.modelId==='m1');
assert.equal(m.submitted,2);assert.equal(m.visited,1);assert.equal(m.visitRate,0.5);assert.equal(m.sessions,2);assert.equal(m.repeatVisitors,1);assert.equal(m.interactedSessions,1);
assert.equal(r.models.find(x=>x.modelId==='m2').sessions,0);
assert.throws(()=>normalizeBatch({schema:'clm-model-signals-v1',events:[]}),/verified/);
assert.equal(normalizeBatch({schema:'clm-model-signals-v1',office_filter_active:true,staff_exclusion_verified:true,events:[base]}).length,1);
// Execute the real Squarespace script with controlled time, consent and events.
const script=fs.readFileSync('assets/squarespace-model-signals.js','utf8');
function page({consent=true,staff=false,office=true,visible=true,bot=false}={}){
 let now=1000,tick;const listeners={},events=[],local=new Map(staff?[['clm_staff_device_v1','1']]:[]),session=new Map();
 const store=m=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)});
 const ctx={window:{CLM_MODEL_SIGNALS_CONFIG:{measurementId:'G-TEST',officeExclusionVerified:office,hasAnalyticsConsent:()=>consent},gtag:(...x)=>events.push(x),addEventListener(){}},
  location:{search:'?clm_submission='+('a'.repeat(32))+'&clm_model=m1&clm_position=1'},URLSearchParams,
  localStorage:store(local),sessionStorage:store(session),navigator:{userAgent:'Test browser',webdriver:bot},
  document:{visibilityState:visible?'visible':'hidden',addEventListener:(name,fn)=>listeners[name]=fn},
  crypto:require('node:crypto').webcrypto,Date:{now:()=>now},setInterval:fn=>{tick=fn;return 1},clearInterval(){}};
 vm.createContext(ctx);vm.runInContext(script,ctx);
 return {ctx,events,local,step(ms){now+=ms;tick()},act(trusted=true){listeners.pointerdown({isTrusted:trusted})}};
}
for(const options of [{consent:false},{staff:true},{office:false},{visible:false},{bot:true}]){
 const p=page(options);p.step(4000);assert.equal(p.events.length,0);
 if(options.consent===false)assert.equal(p.local.has('clm_visitor_v1'),false);
}
const p=page();p.step(1000);assert.equal(p.events.length,0);p.step(1000);assert.equal(p.events[0][1],'model_view');
p.act(false);assert.equal(p.events.length,1);p.act();assert.equal(p.events[1][1],'model_interaction');p.act();assert.equal(p.events.length,2);
p.ctx.window.clmSetStaffDevice(true);assert.equal(p.local.get('clm_staff_device_v1'),'1');
// Run the real CRM link preparer against fixture DOM anchors.
const crm=fs.readFileSync('assets/crm-model-signals.js','utf8').replace('  init();','');
const anchors=[{href:'https://www.chezlesmannequins.com/women/test',getAttribute(){return this.href}},
 {href:'https://www.instagram.com/test',getAttribute(){return this.href}}];
const holder={innerHTML:'',querySelectorAll:()=>anchors};
const db={settings:{modelSignalsEnabled:true},draft:{subject:'Test'},drafts:[{id:'draft1'}],activeDraftId:'draft1',models:[]};
const c={window:{},document:{createElement:()=>holder,querySelector:()=>null},db,crypto:require('node:crypto').webcrypto,URL,Date,
 selectedModels:()=>[{id:'m1',profile:anchors[0].href}],persistWorkspaceSafe(){}};
vm.createContext(c);vm.runInContext(crm,c);c.window.clmPrepareModelSignals('html');
let id=db.draft.modelSignalSubmissionId;assert.equal(new URL(anchors[0].href).searchParams.get('clm_submission'),id);assert.equal(anchors[1].href,'https://www.instagram.com/test');
c.window.clmPrepareModelSignals('html');assert.equal(db.draft.modelSignalSubmissionId,id);
c.window.clmMarkModelSignalSent(db.draft,{gmailMessageId:'sent'});c.window.clmPrepareModelSignals('html');assert.notEqual(db.draft.modelSignalSubmissionId,id);
id=db.draft.modelSignalSubmissionId;c.window.clmPrepareModelSignals('html',true);assert.notEqual(db.draft.modelSignalSubmissionId,id);
db.settings.modelSignalsEnabled=false;assert.equal(c.window.clmPrepareModelSignals('unchanged'),'unchanged');
console.log('Model signals passed: staff/office/consent gates, visibility, interactions, imports, attribution, repeats, denominator, link scope and resend IDs.');
