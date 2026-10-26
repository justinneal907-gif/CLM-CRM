const assert=require('node:assert/strict');
const T=require('../assets/crm-comm-types.js');
assert.equal(T.TYPES.length,7);
// Go-see: exact wording from the sent email, no models, six Canva links.
let r=T.render('gosee',{contactName:'Dana Smith'});
assert.equal(r.subject,'Model Go-See(s)');
assert.match(r.body,/^Hi Dana,\n\nI hope you are well\. I am a model agent at Chez Les Mannequins \(CLM\)\. Would you be available to see any models on go-sees some time between November and January\?/);
assert.equal(r.noModels,true);assert.equal((r.footerHtml.match(/canva\.link/g)||[]).length,6);
assert.match(T.render('gosee',{timing:'December and February'}).body,/between December and February\?/);
assert.match(T.render('gosee',{}).body,/^Hi there,/);
// Submission
r=T.render('brand_submission',{contactName:'Alex Kim',brand:'Coach',models:['Callie','Maja']});
assert.equal(r.subject,'Coach | Campaign Casting');assert.match(r.body,/send Callie and Maja for any upcoming Coach campaign casting/);
assert.equal(r.purpose,'submission');assert.equal(r.noModels,false);assert.match(r.footerHtml,/chezlesmannequins\.com/);
assert.match(T.render('brand_submission',{brand:'Coach',link:'https://canva.link/x'}).footerHtml,/canva\.link\/x/);
// Celebrity intro falls back to brand team greeting
r=T.render('celebrity_intro',{brand:'Alo',models:['Sophia Pippen']});
assert.equal(r.subject,'Sophia Pippen Introduction | Alo');assert.match(r.body,/^Hi Alo Team,/);assert.match(r.body,/introduce Sophia Pippen/);
// TFP
r=T.render('tfp_photographer',{contactName:'Daniel'});
assert.equal(r.subject,'NYC Model Test Collaboration | Chez Les Mannequins');assert.match(r.body,/^Hi Daniel,\n\nI am Justin, an agent with Chez Les Mannequins\./);
assert.equal(T.render('tfp_beauty',{}).subject,'NYC Beauty Test Collaboration | Chez Les Mannequins');
// Shoot collab
r=T.render('shoot_collab',{contactName:'Kate',city:'Paris',models:['Ainoa']});
assert.equal(r.subject,'Paris Model Test Collaboration | Chez Les Mannequins');assert.match(r.body,/shoot in Paris for our model, Ainoa/);assert.match(r.body,/within the next two weeks/);
// Follow up
r=T.render('followup',{prevSubject:'Re: Honolulu Beauty Test Collaboration | Chez Les Mannequins',models:['Ainoa'],city:'Honolulu'});
assert.equal(r.subject,'Re: Honolulu Beauty Test Collaboration | Chez Les Mannequins');assert.match(r.body,/coordinating Ainoa's shoot in Honolulu/);assert.match(r.body,/next two weeks!/);assert.equal(r.purpose,'followup');
// Saved edits win; no dashes (em or en) in any generated copy
r=T.render('gosee',{contactName:'Dana'},{gosee:{subject:'Custom',body:'Hi {first},\n\nHello.'}});assert.equal(r.subject,'Custom');assert.equal(r.body,'Hi Dana,\n\nHello.');
for(const t of T.TYPES){const x=T.render(t.id,{contactName:'A',brand:'B',models:['C']});assert.ok(!/[–—]/.test(x.subject+x.body+x.footerHtml),t.id);assert.ok(x.startsWithGreeting,t.id);}
assert.throws(()=>T.render('nope'),/Unknown/);
console.log('PASS: communication type templates match sent mail wording, fill placeholders, honor saved edits, avoid dashes.');
