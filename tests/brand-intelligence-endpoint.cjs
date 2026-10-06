const assert=require('node:assert/strict'),fs=require('node:fs');
const env={};let handler,calls=0;
globalThis.CLMBrandIntelligence=require('../assets/brand-intelligence-core.js');
globalThis.Deno={env:{get:k=>env[k]},serve:fn=>handler=fn};
(async()=>{
 await import('../supabase/functions/brand-intelligence/index.ts');
 const request=(body={},token='')=>new Request('https://example.com',{method:'POST',headers:{origin:'https://justinneal907-gif.github.io',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handler(request())).status,503);
 env.CLM_RESEARCH_TOKEN='a'.repeat(40);env.PARALLEL_API_KEY='test-key';
 assert.equal((await handler(request())).status,401);
 assert.equal((await handler(request({brand:'Galia Lahav',jobType:'Invalid'},env.CLM_RESEARCH_TOKEN))).status,400);
 const p=JSON.parse(fs.readFileSync('assets/data/brand-intelligence.json'))[0];
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(p),annotations:p.sources.map(s=>({type:'url_citation',url:s.url}))}]}]}));};
 let response=await handler(request({brand:'Galia Lahav',jobType:'Runway'},env.CLM_RESEARCH_TOKEN));assert.equal(response.status,200);assert.equal((await response.json()).brand,'Galia Lahav');assert.equal(calls,1);
 globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(p),annotations:[]}]}]}));
 assert.equal((await handler(request({brand:'Galia Lahav'},env.CLM_RESEARCH_TOKEN))).status,502);
 const bad=new Request('https://example.com',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'});assert.equal((await handler(bad)).status,403);
 console.log('Passed: endpoint fails closed without secrets, rejects unauthenticated/bad-origin calls, validates input, accepts cited provider fixture, rejects missing citation trail. Live provider was not called.');
})().catch(e=>{console.error(e);process.exitCode=1});
