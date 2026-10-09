/* Models.com-qualified proactive opportunity drafts
   Created 2026-10-09.
   - Additive only: does not change model records, galleries, submissions, or Gmail.
   - Captures each selected model's CURRENT saved CRM gallery when the draft is first created.
   - Every client below was previously submitted to from the CLM work mailbox.
   - Every client has current/recent Models.com work. These are proactive casting windows,
     not claims of a public open casting unless a client later confirms one.
*/
(function(){
  const SPECS=[
    {
      id:'modelscom-20261009-burberry-campaign',
      priority:1,
      brand:'Burberry',
      contactName:'Shyra',
      recipientEmail:'shyra.gaillard@burberry.com',
      subject:'Burberry | Upcoming Campaign / Lookbook Models',
      modelIds:['new-york-women-erin-connors','london-women-ambre-prognitz','new-york-women-claudia-lucchini'],
      sourceUrl:'https://models.com/client/burberry',
      window:'Proactive now — Burberry has multiple 2026 advertising projects plus its S/S 27 show.',
      evidence:'Models.com lists Burberry Winter 2026, Autumn 2026, Escape to the Countryside, Athleisure and September 2026 work. Recent casting credits include Anita Bitton and Shyra Gaillard.',
      match:'UNUSUALLY STRONG: Erin is 5\'11, 32-23-35, shoe 9; recent Burberry model Luiza Perote is 5\'11, 32.5-23.5-35, shoe 9. Ambre is 5\'11, 32-25-35, shoe 9 and London-based.',
      intro:'Hi Shyra,\n\nI wanted to follow up with Erin, Ambre, and Claudia for upcoming Burberry campaign, lookbook, or seasonal content opportunities. Their materials are below.'
    },
    {
      id:'modelscom-20261009-nike-campaign',
      priority:2,
      brand:'Nike',
      contactName:'Noah',
      recipientEmail:'noah@1979services.com',
      subject:'Nike | Upcoming Model Consideration',
      modelIds:['new-york-women-callie-steg','new-york-women-agang','new-york-men-matt-rossi'],
      sourceUrl:'https://models.com/client/nike',
      window:'Proactive now — Nike has a high volume of 2026 advertising/lookbook work.',
      evidence:'Models.com lists NIKE x PSG, Nike SU26 Always On, NikeSKIMS Studio Stretch, Nike x Isamaya Run Forever and other 2026 projects. Noah Shelley is credited casting NikeSKIMS Studio Stretch.',
      match:'STRONG: Callie is 6\'1, 32-24-36.5 with a long athletic frame and has worked with Nike previously. Agang is a lean 5\'11, 30-25-33 option. Matt is 6\'1, chest 40, waist 29, hip 36 for mens athletic/lifestyle work.',
      intro:'Hi Noah,\n\nI wanted to put Callie back on your radar and also send Agang and Matt for upcoming Nike projects. Their materials are below.'
    },
    {
      id:'modelscom-20261009-fendi-campaign',
      priority:6,
      brand:'Fendi',
      contactName:'Julia, Tess, Mathilde',
      recipientEmail:'julia.lange@me.com',
      cc:'tess.wilcox@gmail.com, mathilde@jl-casting.com',
      subject:'Fendi | Upcoming Campaign / Lookbook Models',
      modelIds:['new-york-women-erin-connors','new-york-women-agang','new-york-women-claudia-lucchini'],
      sourceUrl:'https://models.com/client/fendi',
      window:'Proactive now — post-S/S 27 campaign/lookbook pipeline.',
      evidence:'Models.com shows Fendi S/S 27, My Peekaboo, Very Colibrì, Qixi, F/W 2026 Campaign and Resort 2027 Lookbook. Julia Lange and Tess Wilcox cast the F/W 2026 campaign and couture show.',
      match:'STRONG: Erin (5\'11, 32-23-35) is the closest measured CLM comparison to recent Fendi model Faith Johnson (5\'11.5, 35-inch hip; bust/waist not public). Agang and Claudia add narrower directional sample-size options.',
      intro:'Hi Julia, Tess, Mathilde,\n\nI wanted to follow up with Erin, Agang, and Claudia for upcoming Fendi campaign, lookbook, or special-project casting. Their materials are below.'
    },
    {
      id:'modelscom-20261009-max-mara-campaign',
      priority:9,
      brand:'Max Mara',
      contactName:'Piergiorgio',
      recipientEmail:'pg@dmfashionstudio.com',
      subject:'Max Mara | Upcoming Campaign / Lookbook Models',
      modelIds:['new-york-women-erin-connors','new-york-women-rachel-stone','london-women-ambre-prognitz'],
      sourceUrl:'https://models.com/client/maxmara',
      window:'Proactive now — Max Mara posted September 2026 campaign, lookbook and fragrance work immediately around S/S 27.',
      evidence:'Models.com lists the S/S 27 show, F/W 2026 campaign, F/W 2026 lookbook and fragrance campaign in September 2026. Piergiorgio Del Moro casts mainline runway; Barbara Nicoli & Leila Ananna recur on Weekend Max Mara.',
      match:'STRONG: Erin (5\'11, 32-23-35) is closest overall to recent Max Mara lookbook model Sandra Murray (5\'11, 29.5-22.5-34.5), especially height, waist and hip. Rachel and Ambre remain strong polished sample-size alternatives.',
      intro:'Hi Piergiorgio,\n\nI wanted to follow up with Erin, Rachel, and Ambre for upcoming Max Mara campaign or lookbook opportunities. Their materials are below.'
    },
    {
      id:'modelscom-20261009-acne-studios-campaign',
      priority:7,
      brand:'Acne Studios',
      contactName:'Piergiorgio',
      recipientEmail:'pg@dmfashionstudio.com',
      subject:'Acne Studios | Upcoming Campaign / Lookbook Models',
      modelIds:['new-york-women-claudia-lucchini','new-york-women-june-ramadhan','new-york-women-agang'],
      sourceUrl:'https://models.com/client/acne-studios',
      window:'Proactive now — Acne has recurring campaign and lookbook work throughout 2026.',
      evidence:'Models.com lists 30 Years of Acne Studios, the AW26 women lookbook, S/S 27 mens lookbook and multiple 2026 campaigns/lookbooks. Piergiorgio Del Moro and Evagria Sergeeva repeatedly cast the fashion work.',
      match:'STRONG: Claudia (5\'10, 30-23-32), June (5\'9, 30-23-33) and Agang (5\'11, 30-25-33) all have lean directional proportions consistent with recent Acne casting. Claudia also has Mugler/Rick Owens runway experience in her current book.',
      intro:'Hi Piergiorgio,\n\nI wanted to follow up with Claudia, June, and Agang for upcoming Acne Studios campaign or lookbook casting. Their materials are below.'
    },
    {
      id:'modelscom-20261009-loewe-campaign',
      priority:3,
      brand:'Loewe',
      contactName:'Ashley',
      recipientEmail:'ashleybrokaw@me.com',
      subject:'Loewe | Upcoming Campaign / Lookbook Models',
      modelIds:['new-york-women-june-ramadhan','new-york-women-claudia-lucchini','new-york-women-ni-simone'],
      sourceUrl:'https://models.com/client/loewe',
      window:'Proactive now — Loewe has frequent 2026 advertising, social and pre-collection work.',
      evidence:'Models.com lists the F/W 2026 Campaign, Summer Baskets, pre-collection, anniversary, Paula\'s Ibiza and other 2026 work. Ashley Brokaw cast both the S/S and F/W 2026 campaigns.',
      match:'UNUSUALLY STRONG: recent Loewe F/W campaign model Carin Herven is 5\'9, 30.5-23.5-33.5. June is 5\'9, 30-23-33 — within 0.5 inch at bust, waist and hip. Claudia and Ni add similarly narrow directional frames.',
      intro:'Hi Ashley,\n\nI wanted to follow up with June, Claudia, and Ni for upcoming Loewe campaign, pre-collection, or lookbook opportunities. Their materials are below.'
    },
    {
      id:'modelscom-20261009-chanel-campaign',
      priority:8,
      brand:'Chanel',
      contactName:'Anita',
      recipientEmail:'anita@establishmentnewyork.com',
      subject:'Chanel | Upcoming Campaign / Pre-Collection Models',
      modelIds:['new-york-women-claudia-lucchini','new-york-women-erin-connors','new-york-women-agang'],
      sourceUrl:'https://models.com/client/chanel',
      window:'Proactive now — Chanel has multiple 2026 campaigns and pre-collection projects.',
      evidence:'Models.com lists Chanel F/W 2026, Pre-Fall 2026, pre-collection and other 2026 advertising. Anita Bitton and Lorenzo Rotondo cast the S/S 2026 and Pre-Fall 2026 campaigns.',
      match:'STRONG: Claudia and Agang supply the long, narrow runway-to-campaign frame Chanel repeatedly uses; Erin is a 5\'11, 32-23-35 option with distinctive natural ginger coloring for beauty/portrait-led work.',
      intro:'Hi Anita,\n\nI wanted to follow up with Claudia, Erin, and Agang for upcoming Chanel campaign or pre-collection casting. Their materials are below.'
    },
    {
      id:'modelscom-20261009-miu-miu-campaign',
      priority:10,
      brand:'Miu Miu',
      contactName:'Ashley',
      recipientEmail:'ashleybrokaw@me.com',
      subject:'Miu Miu | Upcoming Campaign / Product Stories Models',
      modelIds:['new-york-women-claudia-lucchini','new-york-women-june-ramadhan','new-york-women-ni-simone'],
      sourceUrl:'https://models.com/client/miu-miu',
      window:'Proactive now — Miu Miu runs frequent campaign, product-story and special-project casting.',
      evidence:'Models.com lists Product Stories, Qixi, F/W 2026, Upcycled and L’Été 2026 work. Ashley Brokaw cast L’Été 2026 and other recent Miu Miu projects.',
      match:'STRONG/POSSIBLE: Claudia (5\'10, 30-23-32), June (5\'9, 30-23-33) and Ni (5\'9, 29-23-32) all meet the lean high-fashion proportion. Miu Miu also prioritizes character and individuality, so book presentation matters as much as measurements.',
      intro:'Hi Ashley,\n\nI wanted to follow up with Claudia, June, and Ni for upcoming Miu Miu campaign, product-story, or special-project casting. Their materials are below.'
    },
    {
      id:'modelscom-20261009-prada-campaign',
      priority:4,
      brand:'Prada',
      contactName:'Ashley',
      recipientEmail:'ashleybrokaw@me.com',
      subject:'Prada | Upcoming Campaign / Product Models',
      modelIds:['new-york-women-erin-connors','new-york-women-claudia-lucchini','new-york-women-agang'],
      sourceUrl:'https://models.com/client/prada',
      window:'Proactive now — Prada maintains recurring campaign, leather-goods, eyewear and seasonal casting.',
      evidence:'Models.com lists current 2026 Prada campaigns and product work; Ashley Brokaw cast the Prada Galleria 2026 campaign and current seasonal fashion work.',
      match:'STRONG: Erin (5\'11, 32-23-35) is the closest current CLM proportion match to recent Prada Galleria model Evelina Dragic (5\'11, 34.5-23-34.5). Claudia and Agang remain directional sample-size alternatives.',
      intro:'Hi Ashley,\n\nI wanted to follow up with Erin, Claudia, and Agang for upcoming Prada campaign or product-story casting. Their materials are below.'
    },
    {
      id:'modelscom-20261009-lacoste-campaign',
      priority:5,
      brand:'Lacoste',
      contactName:'William',
      recipientEmail:'info@wl-casting.com',
      subject:'Lacoste | Upcoming Campaign / E-commerce Models',
      modelIds:['new-york-women-june-ramadhan','new-york-women-callie-steg','new-york-women-agang','new-york-men-matt-rossi'],
      sourceUrl:'https://models.com/client/lacoste',
      window:'Proactive now — Lacoste has recent 2026 advertising, e-commerce, lookbook and sport-category work.',
      evidence:'Models.com lists Back to School (September), Slam Break (August), Alpine, S/S 26 campaign, underwear, key looks and e-commerce. William Lhoest repeatedly cast 2026 Lacoste projects.',
      match:'STRONG: June (5\'9, 30-23-33) is the closest measured CLM woman to recent Lacoste/Acne crossover model Asako Sato at 5\'9.5; Callie and Agang add taller sport-fashion options, and Matt is a 6\'1 mens athletic/lifestyle option.',
      intro:'Hi William,\n\nI wanted to follow up with June, Callie, Agang, and Matt for upcoming Lacoste campaign, e-commerce, or lookbook casting. Their materials are below.'
    }
  ];

  function fallbackGallery(data,m){
    const values=[];
    const add=v=>(Array.isArray(v)?v:[v]).forEach(x=>{
      const url=typeof x==='string'?x:(x&&typeof x==='object'?(x.url||x.src||''):'');
      if(url)values.push(url);
    });
    add(data.photoLibrary?.[m.id]);
    for(const key of ['photos','photoLibrary','portfolioPhotos','images'])add(m[key]);
    add(data.customPhotos?.[m.id]);add(m.photo);add(m.photoUrl);
    return [...new Set(values.filter(Boolean))];
  }

  window.addModelsComOpportunityDrafts20261009=function(data){
    data=data||{};
    data.drafts=Array.isArray(data.drafts)?data.drafts:[];
    data.recovery={...(data.recovery||{})};

    // Generated drafts must behave exactly like manually adding models:
    // no gallery snapshot, no package-generated photo cache, and no gallery writes.
    // Migrate each generated draft once; preserve explicit userOverrides photo selections.
    const migrateGeneratedDraft=draft=>{
      if(!draft||!String(draft.id||'').startsWith('modelscom-20261009-'))return;
      if(Number(draft.generatedPhotoModeVersion||0)>=2)return;
      const explicit=structuredClone(draft.userOverrides?.photoSelections||{});
      draft.photoSelections={};
      draft.packagePhotos={};
      if(Object.keys(explicit).length){
        draft.userOverrides=draft.userOverrides||{};
        draft.userOverrides.photoSelections=explicit;
      }else if(draft.userOverrides?.photoSelections){
        delete draft.userOverrides.photoSelections;
      }
      // Preserve edited preview copy. Only the accidental blank saved document is removed;
      // loadDraft refreshes model image blocks from the live gallery without rewriting text.
      if(Object.prototype.hasOwnProperty.call(draft,'previewHtml')&&!String(draft.previewHtml||'').trim())delete draft.previewHtml;
      draft.html='';
      draft.generatedPhotoMode='live-gallery';
      draft.generatedPhotoModeVersion=2;
      draft.previewNeedsGmailUpdate=true;
    };
    for(const draft of data.drafts)migrateGeneratedDraft(draft);
    migrateGeneratedDraft(data.draft);

    if(data.recovery.modelsComOpportunityDrafts20261009===1)return data;
    const models=new Map((data.models||[]).map(m=>[m.id,m]));

    for(const spec of SPECS){
      if(data.drafts.some(d=>d?.id===spec.id))continue;
      const modelIds=spec.modelIds.filter(id=>models.has(id));
      if(!modelIds.length)continue;
      const draft={
        id:spec.id,
        date:'2026-10-09',
        eventName:'Models.com Campaign Outreach',
        packageName:spec.brand+' | Current Campaign Opportunity',
        purpose:'submission',
        contactId:'',
        contactName:spec.contactName,
        company:spec.brand,
        recipientEmail:spec.recipientEmail||'',
        cc:spec.cc||'',
        brandProject:spec.brand+' — upcoming campaign / lookbook consideration',
        packageLink:'',
        brief:spec.window+' '+spec.evidence,
        initialMessage:spec.intro,
        subject:spec.subject,
        includeStats:true,
        includePhotos:true,
        includeSources:true,
        models:modelIds.map(id=>models.get(id)?.name).filter(Boolean),
        modelIds:[...modelIds],
        modelExtras:{},
        generatedPhotoMode:'live-gallery',
        generatedPhotoModeVersion:2,
        html:'',
        castingBriefRaw:'PROACTIVE WINDOW — '+spec.window+' No public casting deadline, shoot date, rate, or usage was published in the Models.com credits reviewed on October 9, 2026.',
        parsedBrief:{
          project:spec.brand,
          location:'Not public / travel may be required',
          nicheClues:['High Fashion / Editorial','Commercial / Lifestyle']
        },
        source:'Models.com: '+spec.sourceUrl+' • Prior CLM submission/contact history verified in work Gmail • Researched 2026-10-09',
        notes:'PRIORITY '+spec.priority+' • '+spec.match+'\n\n'+spec.evidence+'\n\nSTATUS: Research/recommendation draft only. This is a realistic proactive casting window inferred from current Models.com campaign cadence, not a claim that a public casting notice is open. Compensation, usage, shoot date and deadline are UNKNOWN until the client responds. Do not send without agent review.',
        selectionPlanVersion:1,
        selectionRationale:spec.match,
        researchStatus:'Models.com verified — proactive',
        modelsComSource:spec.sourceUrl
      };

      data.drafts.push(draft);
    }
    data.recovery.modelsComOpportunityDrafts20261009=2;
    data.recovery.modelsComOpportunityDraftsCreatedOn='2026-10-09';
    return data;
  };
})();