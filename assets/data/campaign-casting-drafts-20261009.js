/* Campaign casting director drafts, October 9 2026.
   Additive only. Does not modify model records, model galleries, photo selections,
   original Canva roster, any existing draft, submission record, or Gmail.
   No email body text is authored here. The CRM retains responsibility for
   rendering saved model text and photos when a draft is opened.
   Canva view links are not inserted into outgoing email until public access
   can be verified by the agent. Recipient is blank where not independently verified.
*/
(function(){
  const SPECS=[
  {
    "key": "burberry-caitlin",
    "brand": "Burberry",
    "contactName": "Caitlin Prosser",
    "recipientEmail": "",
    "featured": [
      "Ambre",
      "Agang",
      "Erin"
    ],
    "extra": [
      "Iyanu",
      "June",
      "Callie",
      "Mary",
      "Bianca"
    ],
    "designId": "DAHXjPlHLvo",
    "editUrl": "https://www.canva.com/d/iRPoRn2UU5jbQep",
    "viewUrl": "https://www.canva.com/d/677Q8T5DuZSAqJo",
    "source": "https://models.com/client/burberry",
    "featuredIds": [
      "london-women-ambre-prognitz",
      "new-york-women-agang",
      "new-york-women-erin-connors"
    ],
    "extraIds": [
      "site-women-81-iyanu",
      "new-york-women-june-ramadhan",
      "new-york-women-callie-steg",
      "new-york-women-mary-timms",
      "germany-women-bianca-eigenfeld-own"
    ]
  },
  {
    "key": "acne-evagria",
    "brand": "Acne Studios",
    "contactName": "Evagria Sergeeva",
    "recipientEmail": "evagria.serg@gmail.com",
    "featured": [
      "Rachel",
      "Agang",
      "June"
    ],
    "extra": [
      "Maja",
      "Iyanu",
      "Callie",
      "Ni",
      "Mary"
    ],
    "designId": "DAHXjMNavHI",
    "editUrl": "https://www.canva.com/d/hcHF4YpQThrD_QE",
    "viewUrl": "https://www.canva.com/d/1ktNrxy3C00LNOa",
    "source": "https://models.com/client/acne-studios",
    "featuredIds": [
      "new-york-women-rachel-stone",
      "new-york-women-agang",
      "new-york-women-june-ramadhan"
    ],
    "extraIds": [
      "new-york-women-maja-stockwell",
      "site-women-81-iyanu",
      "new-york-women-callie-steg",
      "new-york-women-ni-simone",
      "new-york-women-mary-timms"
    ]
  },
  {
    "key": "ferragamo-mischa",
    "brand": "Ferragamo",
    "contactName": "Mischa Notcutt",
    "recipientEmail": "hello@driverepresents.com",
    "featured": [
      "Agang",
      "Erin",
      "Mary"
    ],
    "extra": [
      "Iyanu",
      "June",
      "Callie",
      "Ambre",
      "Bianca"
    ],
    "designId": "DAHXjB08fII",
    "editUrl": "https://www.canva.com/d/FWuwBC7Z5MXMqTZ",
    "viewUrl": "https://www.canva.com/d/OEgos4eY2GLdMSz",
    "source": "https://models.com/client/ferragamo",
    "featuredIds": [
      "new-york-women-agang",
      "new-york-women-erin-connors",
      "new-york-women-mary-timms"
    ],
    "extraIds": [
      "site-women-81-iyanu",
      "new-york-women-june-ramadhan",
      "new-york-women-callie-steg",
      "london-women-ambre-prognitz",
      "germany-women-bianca-eigenfeld-own"
    ]
  },
  {
    "key": "diesel-mischa",
    "brand": "Diesel",
    "contactName": "Mischa Notcutt",
    "recipientEmail": "hello@driverepresents.com",
    "featured": [
      "Rachel",
      "June",
      "Agang"
    ],
    "extra": [
      "Maja",
      "Callie",
      "Ni",
      "Mary",
      "Elle"
    ],
    "designId": "DAHXjCriGLI",
    "editUrl": "https://www.canva.com/d/UfTvgWQhtCfIKnJ",
    "viewUrl": "https://www.canva.com/d/wF4qlWBk2m9q8fB",
    "source": "https://models.com/client/diesel",
    "featuredIds": [
      "new-york-women-rachel-stone",
      "new-york-women-june-ramadhan",
      "new-york-women-agang"
    ],
    "extraIds": [
      "new-york-women-maja-stockwell",
      "new-york-women-callie-steg",
      "new-york-women-ni-simone",
      "new-york-women-mary-timms",
      "los-angeles-women-elle-pickens"
    ]
  },
  {
    "key": "etro-simone",
    "brand": "Etro",
    "contactName": "Simone Bart Rocchietti",
    "recipientEmail": "",
    "featured": [
      "Ambre",
      "June",
      "Mary"
    ],
    "extra": [
      "Agang",
      "Iyanu",
      "Erin",
      "Bianca",
      "Elle"
    ],
    "designId": "DAHXjMwxiZk",
    "editUrl": "https://www.canva.com/d/1tJVPLsX8b3PXxQ",
    "viewUrl": "https://www.canva.com/d/wGqRUV-AWep-YW_",
    "source": "https://models.com/client/etro",
    "featuredIds": [
      "london-women-ambre-prognitz",
      "new-york-women-june-ramadhan",
      "new-york-women-mary-timms"
    ],
    "extraIds": [
      "new-york-women-agang",
      "site-women-81-iyanu",
      "new-york-women-erin-connors",
      "germany-women-bianca-eigenfeld-own",
      "los-angeles-women-elle-pickens"
    ]
  },
  {
    "key": "lacoste-william",
    "brand": "Lacoste",
    "contactName": "William Lhoest",
    "recipientEmail": "info@wl-casting.com",
    "featured": [
      "Agang",
      "June",
      "Callie"
    ],
    "extra": [
      "Iyanu",
      "Erin",
      "Mary",
      "Alex",
      "Raquel"
    ],
    "designId": "DAHXjCjonBk",
    "editUrl": "https://www.canva.com/d/bWyl4y325Juj-CZ",
    "viewUrl": "https://www.canva.com/d/B9fzT1rOUG57T6J",
    "source": "https://models.com/client/lacoste",
    "featuredIds": [
      "new-york-women-agang",
      "new-york-women-june-ramadhan",
      "new-york-women-callie-steg"
    ],
    "extraIds": [
      "site-women-81-iyanu",
      "new-york-women-erin-connors",
      "new-york-women-mary-timms",
      "london-men-alex-connor",
      "miami-women-raquel"
    ]
  },
  {
    "key": "valentino-rachel",
    "brand": "Valentino",
    "contactName": "Rachel Chandler",
    "recipientEmail": "contact@midland.agency",
    "featured": [
      "Iyanu",
      "Agang",
      "Mary"
    ],
    "extra": [
      "Maja",
      "Erin",
      "June",
      "Callie",
      "Rachel"
    ],
    "designId": "DAHXjNBsDXo",
    "editUrl": "https://www.canva.com/d/h13dTjcP4i87PQb",
    "viewUrl": "https://www.canva.com/d/TvwLHIR0iWJBxfv",
    "source": "https://models.com/client/valentino",
    "featuredIds": [
      "site-women-81-iyanu",
      "new-york-women-agang",
      "new-york-women-mary-timms"
    ],
    "extraIds": [
      "new-york-women-maja-stockwell",
      "new-york-women-erin-connors",
      "new-york-women-june-ramadhan",
      "new-york-women-callie-steg",
      "new-york-women-rachel-stone"
    ]
  },
  {
    "key": "prada-ashley",
    "brand": "Prada",
    "contactName": "Ashley Brokaw",
    "recipientEmail": "ashleybrokaw@me.com",
    "featured": [
      "Agang",
      "June",
      "Mary"
    ],
    "extra": [
      "Maja",
      "Iyanu",
      "Erin",
      "Callie",
      "Ambre"
    ],
    "designId": "DAHXjAZfCMA",
    "editUrl": "https://www.canva.com/d/IptobIjw6diohWg",
    "viewUrl": "https://www.canva.com/d/tl5L2ERS1-KM5_y",
    "source": "https://models.com/client/prada",
    "featuredIds": [
      "new-york-women-agang",
      "new-york-women-june-ramadhan",
      "new-york-women-mary-timms"
    ],
    "extraIds": [
      "new-york-women-maja-stockwell",
      "site-women-81-iyanu",
      "new-york-women-erin-connors",
      "new-york-women-callie-steg",
      "london-women-ambre-prognitz"
    ]
  },
  {
    "key": "max-mara-simone",
    "brand": "Max Mara",
    "contactName": "Simone Bart Rocchietti",
    "recipientEmail": "",
    "featured": [
      "Erin",
      "Ambre",
      "Bianca"
    ],
    "extra": [
      "Agang",
      "Iyanu",
      "June",
      "Mary",
      "Elle"
    ],
    "designId": "DAHXjN5ECXA",
    "editUrl": "https://www.canva.com/d/eXMVEdE3gJx1yVB",
    "viewUrl": "https://www.canva.com/d/X4OTyIQxgn9LzX4",
    "source": "https://models.com/client/maxmara",
    "featuredIds": [
      "new-york-women-erin-connors",
      "london-women-ambre-prognitz",
      "germany-women-bianca-eigenfeld-own"
    ],
    "extraIds": [
      "new-york-women-agang",
      "site-women-81-iyanu",
      "new-york-women-june-ramadhan",
      "new-york-women-mary-timms",
      "los-angeles-women-elle-pickens"
    ]
  }
];
  window.addCampaignCastingDirectorDrafts20261009=function(data){
    if(!data||typeof data!=='object')return data;
    if(!Array.isArray(data.drafts))data.drafts=[];
    const modelById=new Map((data.models||[]).map(m=>[m.id,m]));
    for(const spec of SPECS){
      const id='campaigncasting20261009_'+spec.key;
      if(data.drafts.some(d=>d&&d.id===id))continue;
      if(spec.featuredIds.some(modelId=>!modelById.has(modelId)))continue;
      const selected=spec.featuredIds.map(modelId=>modelById.get(modelId));
      data.drafts.push({
        id,
        date:'2026-10-09',
        eventName:'Campaign Casting',
        packageName:'Campaign Casting | '+spec.brand,
        purpose:'submission',
        contactId:'',
        contactName:spec.contactName,
        company:spec.brand,
        recipientEmail:spec.recipientEmail,
        cc:'',
        brandProject:spec.brand,
        packageLink:'',
        // A whitespace-only value suppresses the legacy bridal template copy.
        // The agent controls introductory email wording.
        initialMessage:' ',
        subject:spec.brand+' | Campaign Casting',
        includeStats:true,
        includePhotos:true,
        includeSources:true,
        models:selected.map(m=>m.name),
        modelIds:[...spec.featuredIds],
        modelExtras:{},
        generatedPhotoMode:'live-gallery',
        generatedPhotoModeVersion:3,
        html:'',
        castingBriefRaw:'Proactive campaign consideration. The casting window, job rate, usage, location and deadline are not confirmed.',
        parsedBrief:{project:spec.brand,location:'Not confirmed'},
        brief:'Campaign casting research and comparison on Models.com. Confirm availability, casting status, travel, usage and rates before sending.',
        source:'Models.com: '+spec.source,
        modelsComSource:spec.source,
        canvaDesignId:spec.designId,
        canvaEditUrl:spec.editUrl,
        canvaCandidateViewUrl:spec.viewUrl,
        canvaLinkVerifiedPublic:false,
        researchStatus:'Researched proactive campaign outreach',
        notes:'Featured models: '+spec.featured.join(', ')+'. Additional models in dedicated Canva deck: '+spec.extra.join(', ')+'. Canva editor: '+spec.editUrl+'. Canva candidate view link: '+spec.viewUrl+'. Check public view access in Canva before placing any share link in the email. '+(spec.recipientEmail?'Confirm the campaign contact is current before sending.':'Casting director identified but a direct recipient email is not verified. Add confirmed email before sending.')+' No body copy was composed. Models use the existing live CRM gallery and saved model material.',
        selectionRationale:'Featured: '+spec.featured.join(', ')+'. Canva includes 8 suitable models. Claudia and Lana are excluded.',
        selectionPlanVersion:1
      });
    }
    return data;
  };
})();