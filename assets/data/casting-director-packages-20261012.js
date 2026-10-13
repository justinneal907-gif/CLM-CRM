/* CASTING DIRECTOR PACKAGES | 2026-10-12
 * Additive, non-destructive: creates only new saved package records.
 * No model record, photo gallery, custom photo, or media library is edited.
 * Canva copied designs remain separate; a Canva editor URL is not a verified
 * public recipient-view link and is NEVER auto-inserted into the email body.
 * Gmail messages are not created or sent here.
 * This runs only once per workspace: deleting a draft does not resurrect it.
 */
(function(){
'use strict';
const SPECS=[
  {
    "key": "shawn-dezan",
    "name": "Shawn Dezan",
    "firstName": "Shawn",
    "office": "R3-MGMT",
    "email": "hello@r3-mgmt.com",
    "contactRoute": "R3-MGMT official representative inbox",
    "previous": 0,
    "models": [
      "new-york-women-erin-connors",
      "new-york-women-maja-stockwell",
      "new-york-women-june-ramadhan"
    ],
    "id": "DAHXzsPnTfQ",
    "url": "https://www.canva.com/d/sE1_Nc3bBfGHdyd",
    "works": "DKNY, Donna Karan Summer 2026, Sandy Liang S/S 2027, fashion editorial",
    "source": "https://models.com/people/shawn-dezan",
    "reason": "Erin: polished fashion portraits and distinctive natural ginger hair; Maja: tall directional runway proportions; June: younger directional silhouette. Suitable for Shawn's mix of DKNY, Donna Karan and Sandy Liang, pending book and availability review."
  },
  {
    "key": "jennifer-starr",
    "name": "Jennifer Starr",
    "firstName": "Jennifer",
    "office": "Jennifer Starr Casting",
    "email": "jennifer@jenniferstarr.net",
    "contactRoute": "Direct public email on Jennifer Starr's official contact page",
    "previous": 0,
    "models": [
      "new-york-women-erin-connors",
      "london-women-ambre-prognitz",
      "new-york-women-callie-steg"
    ],
    "id": "DAHXztIwhxY",
    "url": "https://www.canva.com/d/99XCVQ_ruebSbeH",
    "works": "DKNY Spring 2026, Ralph Lauren fragrance, 7 For All Mankind, Calvin Klein",
    "source": "https://models.com/people/jennifer-starr",
    "reason": "Erin: refined luxury/commercial crossover; Ambre: classic fashion proportions and can travel from London; Callie: tall versatile commercial and fashion look. Reflects Jennifer's casting range from fragrance to denim and ready-to-wear."
  },
  {
    "key": "franziska-bachofen-echt",
    "name": "Franziska Bachofen-Echt",
    "firstName": "Franziska",
    "office": "JE SUIS CASTING",
    "email": "info@jesuiscasting.com",
    "contactRoute": "Public JE SUIS CASTING studio contact, previously used in work Gmail",
    "previous": 2,
    "models": [
      "new-york-women-agang",
      "new-york-women-maja-stockwell",
      "new-york-women-ni-simone"
    ],
    "id": "DAHXzhMAiPY",
    "url": "https://www.canva.com/d/4WUvwzNWr7PYqSP",
    "works": "Dior Alps 2026, Dior Men Winter 2026, Ottolinger S/S 2027, Dazed",
    "source": "https://models.com/agency/je-suis-casting",
    "reason": "Agang: narrow editorial runway proportions; Maja: dramatic 6-foot-plus shape; Ni: lean high-fashion new-face silhouette. More directional than commercial, appropriate to Dior and Ottolinger."
  },
  {
    "key": "emilie-astrom",
    "name": "Emilie Åström",
    "firstName": "Emilie",
    "office": "RAW Studio Casting",
    "email": "ea@rawstudio-casting.com",
    "contactRoute": "Direct email on RAW Studio official contact page",
    "previous": 1,
    "models": [
      "new-york-women-agang",
      "new-york-women-erin-connors",
      "site-women-81-iyanu"
    ],
    "id": "DAHXziJdg4s",
    "url": "https://www.canva.com/d/36k33U1jMmCXPx-",
    "works": "Dior Beauty – Dior Addict, Guerlain fragrances, Cartier, Lacoste, Tommy Hilfiger",
    "source": "https://rawstudio-casting.com/portfolio/",
    "reason": "Agang: high-fashion beauty/editorial; Erin: memorable naturally ginger beauty profile; Iyanu: tall fashion and beauty potential. Excludes Callie because she was already sent to Emilie for a Paris go-see on September 25, 2026."
  },
  {
    "key": "davian-lain",
    "name": "DaVian Lain",
    "firstName": "DaVian",
    "office": "DaVian Lain Casting",
    "email": "DaVianLainStudios@gmail.com",
    "contactRoute": "Direct casting-inquiries email on DaVian Lain's official website",
    "previous": 0,
    "models": [
      "new-york-women-mary-timms",
      "new-york-women-june-ramadhan",
      "new-york-women-ni-simone"
    ],
    "id": "DAHXzlEtVAA",
    "url": "https://www.canva.com/d/3wTEc6-64kEOEVe",
    "works": "Vogue, Harper's Bazaar, ELLE, Marie Claire, GQ; current fashion editorial",
    "source": "https://models.com/people/davian-lain",
    "reason": "Mary: poised fashion editorial; June: versatile lean look for fashion storytelling; Ni: fresh directional book. Target flexible editorial and commercial fashion work without assuming a currently open job."
  },
  {
    "key": "david-chen",
    "name": "David Chen",
    "firstName": "David",
    "office": "David Chen Casting / The Wall Group",
    "email": "infoNY@thewallgroup.com",
    "contactRoute": "Official New York general inbox at The Wall Group; confirm routing to David",
    "previous": 0,
    "models": [
      "new-york-women-erin-connors",
      "new-york-women-june-ramadhan",
      "new-york-women-agang"
    ],
    "id": "DAHXzvmCfKY",
    "url": "https://www.canva.com/d/mBTsWhUsb4C060U",
    "works": "Self-Portrait Spring 2027 lookbook, Diane von Furstenberg S/S 2027, La Mer and Westman Atelier casting clients",
    "source": "https://models.com/people/david-chen",
    "reason": "Erin: beauty and polished lookbook candidate; June: tight luxury sample measurements; Agang: runway-to-editorial fashion. Dave has active Self-Portrait lookbook and beauty brand history."
  },
  {
    "key": "katherine-mateo",
    "name": "Katherine Mateo",
    "firstName": "Katherine",
    "office": "Katherine Mateo Casting",
    "email": "",
    "contactRoute": "No independently confirmed booking mailbox; use official portfolio/contact channel",
    "previous": 0,
    "models": [
      "new-york-women-agang",
      "new-york-women-rachel-stone",
      "new-york-women-ni-simone"
    ],
    "id": "DAHXzp8RH9Q",
    "url": "https://www.canva.com/d/TF3ldTvQ6-x5Hkr",
    "works": "Advisry S/S 2027, Who Decides War, Luar, Hanifa, Pyer Moss",
    "source": "https://models.com/people/katherine-mateo",
    "reason": "Agang: casting-friendly fashion proportions; Rachel: alternative editorial character; Ni: newer lean fashion look. Geared to Katherine's streetwear/artistic casting aesthetic."
  },
  {
    "key": "dionne-cochrane",
    "name": "Dionne Cochrane",
    "firstName": "Dionne",
    "office": "Cochrane Casting",
    "email": "",
    "contactRoute": "Public website contact channel only; no direct studio email independently verified",
    "previous": 0,
    "models": [
      "site-women-81-iyanu",
      "new-york-women-mary-timms",
      "new-york-women-ni-simone"
    ],
    "id": "DAHXzqIZF-U",
    "url": "https://www.canva.com/d/krDWulFm4PZZ3CW",
    "works": "Pat McGrath, Glossier, Pattern Beauty, Kiehl's, SheaMoisture, Ulta Beauty",
    "source": "https://models.com/people/dionne-cochrane",
    "reason": "Iyanu, Mary and Ni give a strong beauty/editorial shortlist. Verify current digitals and hair specifications before pitching for hair-care roles: do not assume individual hair texture or eligibility without evidence."
  },
  {
    "key": "daniel-peddle",
    "name": "Daniel Peddle",
    "firstName": "Daniel",
    "office": "The Secret Gallery",
    "email": "casting@thesecretgalleryinc.com",
    "contactRoute": "Direct general casting inbox on The Secret Gallery official website",
    "previous": 0,
    "models": [
      "new-york-women-maja-stockwell",
      "new-york-women-rachel-stone",
      "new-york-women-agang"
    ],
    "id": "DAHXzv2aeN8",
    "url": "https://www.canva.com/d/9nwMKZB8HZWmp1g",
    "works": "Comme des Garçons, Givenchy, 3.1 Phillip Lim; 2026 Playlovewin campaign",
    "source": "https://models.com/people/Daniel-Peddle",
    "reason": "Maja and Agang supply unconventional runway presence; Rachel provides alternative editorial energy. Relevant to Daniel's discovery-led, art-direction-focused fashion casting."
  },
  {
    "key": "oliver-ress",
    "name": "Oliver Ress",
    "firstName": "Oliver",
    "office": "RAW Studio Casting",
    "email": "or@rawstudio-casting.com",
    "contactRoute": "Direct email on RAW Studio official contact page, shared office with Emilie Åström",
    "previous": 0,
    "models": [
      "new-york-women-erin-connors",
      "new-york-women-june-ramadhan",
      "new-york-women-mary-timms"
    ],
    "id": "DAHXzvdDE9U",
    "url": "https://www.canva.com/d/TAkUA5kPQavLmh_",
    "works": "RAW Studio campaigns for Dior Beauty, Chanel Coco Crush, Cartier, Lacoste and editorial",
    "source": "https://models.com/people/Oliver-Ress",
    "reason": "Erin, June and Mary provide varied fashion/beauty profiles; note Oliver and Emilie now share RAW Studio—review whether a second note to this office is necessary."
  }
];
const normalizeName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

/* Verified-contact brand drafts | 2026-10-13
 * ADD ONLY. Does not write to models, model galleries, photo libraries,
 * draft photo selections, saved extras, submissions, or existing packages.
 * Do not regenerate if a user deletes the draft after import.
 * The Thom Browne record is intentionally UNSENDABLE until a current public
 * casting-director email is independently verified.
 */
function addVerifiedBrandDrafts20261013(data){
  if(!data||typeof data!=='object')return data;
  data.recovery=data.recovery||{};
  if(data.recovery.verifiedBrandDrafts20261013===1)return data;
  data.drafts=Array.isArray(data.drafts)?data.drafts:[];
  const byId=new Map((data.models||[]).map(m=>[m.id,m]));
  const specs=[
    {
      key:'bottega-veneta',
      brand:'Bottega Veneta',
      contact:'Anita Bitton',
      company:'Establishment Casting',
      email:'anita@establishmentnewyork.com',
      greeting:'Hi Anita,',
      modelIds:['new-york-women-seven-wright','new-york-women-ni-simone','new-york-women-mob-e'],
      message:'I wanted to share a new selection of our models for consideration for upcoming Bottega Veneta projects. Their materials are below. Please let me know if you would like to see any of them for a casting or fitting.',
      contactEvidence:'https://theagents.club/the-establishment-new-york',
      castingEvidence:'https://models.com/work/bottega-veneta-bottega-veneta--ss-2026-campaign',
      prior:'Anita received a Chanel package September 20 and Zimmermann package September 21. These are additional, not repeated models.'
    },
    {
      key:'courreges',
      brand:'Courrèges',
      contact:'Julia Lange',
      company:'Art Partner / Julia Lange',
      email:'info@artpartner.com',
      greeting:'Hi Julia,',
      modelIds:['new-york-women-ni-simone','new-york-women-mob-e','new-york-women-seven-wright'],
      message:'I wanted to follow up with additional model options for possible future Courrèges projects. Their materials are below. Please let me know if you would like to see any of them for a casting or fitting.',
      contactEvidence:'https://www.artpartner.com/julia-lange',
      castingEvidence:'https://www.artpartner.com/julia-lange',
      prior:'A Courrèges SS27 package was already sent September 21 to Julia Lange and Mathilde Curel featuring Claudia, Maja, Rachel, Agang, and Sophia Pippen. This is an optional follow-up, not a first contact. Art Partner email is a verified company inbox, NOT a Julia-only personal mailbox.'
    },
    {
      key:'dkny',
      brand:'DKNY',
      contact:'Jennifer Starr',
      company:'Jennifer Starr Casting',
      email:'jennifer@jenniferstarr.net',
      greeting:'Hi Jennifer,',
      modelIds:['new-york-women-june-ramadhan','new-york-women-erin-connors','new-york-women-janel-cheatham'],
      message:'I wanted to share additional options for upcoming DKNY commercial fashion projects. Their materials are below. Please let me know if you would like to see any of them for a casting or fitting.',
      contactEvidence:'https://www.jenniferstarr.net/',
      castingEvidence:'https://models.com/work/dkny-dkny-spring-2026/2789741',
      prior:'Jennifer received Callie and Maja in an October 13 go-see email. This package contains different models. Erin is included only for the documented commercial fashion advertising category.'
    },
    {
      key:'thom-browne',
      brand:'Thom Browne',
      contact:'',
      company:'Thom Browne (casting contact pending independent verification)',
      email:'',
      greeting:'Hi Thom Browne Team,',
      modelIds:['new-york-women-seven-wright','new-york-women-claudia-lucchini','new-york-women-sal-soliman'],
      message:'I wanted to introduce a selection of our models for consideration for future Thom Browne fashion projects. Their materials are below. Please let me know if you would like to see any of them for a casting or fitting.',
      contactEvidence:'NOT VERIFIED',
      castingEvidence:'https://models.com/work/thom-browne-thom-browne-fw-26-show/2741957',
      prior:'HOLD. Sivan Currie has verified Thom Browne show credits, but her address from prior outgoing mail lacks independent public confirmation as a casting contact. No director email or recipient is entered. Do not send until verified.'
    }
  ];
  let created=0;
  for(const spec of specs){
    const id='verified-brand-20261013-'+spec.key;
    if(data.drafts.some(d=>d&&d.id===id))continue;
    if(spec.modelIds.some(modelId=>!byId.has(modelId))){
      console.warn('[CLM 2026-10-13] Saved brand draft skipped; model ID is missing:',spec.key);
      continue;
    }
    const models=spec.modelIds.map(modelId=>byId.get(modelId).name);
    data.drafts.push({
      id,date:'2026-10-13',purpose:'submission',eventName:'Campaign Casting',
      packageName:'Campaign Casting | '+spec.brand,
      contactId:'',contactName:spec.contact,company:spec.company,
      recipientEmail:spec.email,brandProject:spec.brand,
      subject:spec.brand+' | Upcoming Model Consideration',
      packageLink:'',
      initialMessage:spec.greeting+'\\n\\n'+spec.message,
      includeStats:true,includePhotos:true,includeSources:true,
      models,modelIds:[...spec.modelIds],modelExtras:{},
      generatedPhotoMode:'live-gallery',generatedPhotoModeVersion:3,
      html:'',
      castingBriefRaw:'General agency introduction only. No active casting, rates, usage, dates, or deadlines verified.',
      parsedBrief:{project:spec.brand,location:'Unconfirmed'},
      brief:spec.brand+' general casting introduction. Confirm project details prior to any availability commitment.',
      researchStatus:spec.email?'Verified public professional contact; proactive, not an open job':'HOLD: no independently verified casting recipient email',
      source:'Casting credit: '+spec.castingEvidence,
      contactEvidence:spec.contactEvidence,
      castingEvidence:spec.castingEvidence,
      selectionRationale:'Selected new or previously under-presented models for this director; verify current digitals, availability and fit before sending.',
      notes:'CONTACT: '+(spec.email||'NOT VERIFIED, LEAVE RECIPIENT EMPTY')+'\\nSOURCE: '+spec.contactEvidence+'\\nCASTING: '+spec.castingEvidence+'\\nHISTORY: '+spec.prior+'\\nExisting CRM gallery, saved images and model texts remain authoritative. Public package link not yet verified; no Gmail draft has been created.'
    });
    created++;
  }
  data.recovery.verifiedBrandDrafts20261013=1;
  data.recovery.verifiedBrandDrafts20261013Created=created;
  return data;
}

window.addCastingDirectorPackages20261012=function(data){
  if(!data||typeof data!=='object')return data;
  data=addVerifiedBrandDrafts20261013(data);
  data.recovery={...(data.recovery||{})};
  if(data.recovery.castingDirectorPackages20261012===1)return data;
  data.drafts=Array.isArray(data.drafts)?data.drafts:[];
  const modelById=new Map((data.models||[]).map(m=>[m.id,m]));
  let created=0;
  for(const spec of SPECS){
    const id='casting-director-20261012-'+spec.key;
    if(data.drafts.some(d=>d&&d.id===id))continue;
    const modelIds=spec.models.filter(modelId=>modelById.has(modelId));
    if(modelIds.length!==3){console.warn('[CLM Casting Director] Skipping incomplete model selection',spec.name);continue;}
    const models=modelIds.map(modelId=>modelById.get(modelId).name);
    const naturalList=models.slice(0,2).join(', ')+', and '+models[2];
    const initialMessage='Hi '+spec.firstName+',\n\nI wanted to send '+naturalList+' for upcoming fashion, luxury, or beauty projects you may be casting. Their materials are below. Please let me know if you would like to see anyone for a casting or go-see.';
    data.drafts.push({
      id,
      date:'2026-10-12',
      eventName:'Fashion, Luxury & Beauty Casting',
      packageName:'Casting Director | '+spec.name,
      purpose:'submission',
      contactId:'',
      contactName:spec.name,
      company:spec.office,
      recipientEmail:spec.email,
      brandProject:'Casting Director | '+spec.name,
      packageLink:'',
      initialMessage,
      subject:'CLM Model Package | '+spec.name,
      includeStats:true,
      includePhotos:true,
      includeSources:true,
      models,
      modelIds,
      modelExtras:{},
      // The CRM reads its existing, user-saved gallery and text when opened.
      // Do not set previewHtml or photoSelections; never store generated gallery images.
      generatedPhotoMode:'live-gallery',
      generatedPhotoModeVersion:3,
      html:'',
      castingBriefRaw:'Proactive model introduction, not a confirmed open casting. Ask director about upcoming dates, fees, usage, and talent requirements.',
      parsedBrief:{project:'Fashion / luxury / beauty – '+spec.name,location:'Not confirmed'},
      brief:'Casting research: '+spec.works+'. Public casting status, dates, fees and usage are unconfirmed.',
      source:'Models.com: '+spec.source,
      modelsComSource:spec.source,
      canvaDesignId:spec.id,
      canvaEditUrl:spec.url,
      canvaLinkVerifiedPublic:false,
      researchStatus:'Verified industry credits; proactive contact, not confirmed paid booking',
      selectionPlanVersion:1,
      selectionRationale:spec.reason,
      notes:'CASTING: '+spec.name+' / '+spec.office+'\n2025–2026 and recent work: '+spec.works+'\nMATCH: '+spec.reason+'\nCONTACT: '+spec.contactRoute+(spec.email?' — '+spec.email:' — EMAIL NOT VERIFIED')+'\nPAST OUTREACH: '+spec.previous+' known work-Gmail direct sends (search by person/studio); this is not a comprehensive historical delivery audit.\nCANVA (EDIT ONLY, NOT PUBLIC SUBMISSION): '+spec.url+'\nThis is a duplicate of the full 48-page regular CLM Roster, not yet reduced to these three models. Tailor/hide unrelated pages and verify recipient public-view access before sending.\nNo confirmed active casting, compensation, usage, or shoot dates. Do not send without agent review.'
    });
    created++;
  }
  data.recovery.castingDirectorPackages20261012=1;
  data.recovery.castingDirectorPackagesCreatedOn='2026-10-12';
  data.recovery.castingDirectorPackagesCreatedCount=created;
  return data;
};
})();
