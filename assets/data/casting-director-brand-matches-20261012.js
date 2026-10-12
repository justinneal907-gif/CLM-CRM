/* BRAND-SELECTION PATCH, 2026-10-12
 * Update only generated unedited casting-director packages.
 * No gallery state, model records, photo libraries, custom photos,
 * existing preview documents, or unrelated packages are modified.
 * All briefs are proactive; no brand casting, rate or deadline is confirmed.
 */
(function(){
'use strict';
const PAIRINGS=[
  {
    "key": "shawn-dezan",
    "brand": "Sandy Liang",
    "work": "Sandy Liang S/S 27 runway show, 13 September 2026",
    "source": "https://models.com/people/shawn-dezan",
    "modelIds": [
      "new-york-women-june-ramadhan",
      "new-york-women-ni-simone",
      "new-york-women-erin-connors"
    ],
    "rationale": "June (5'9, 30-23-33) and Ni (5'9, 29-23-32) match the compact, lean directional range of Sandy Liang's recent young-model cast; Erin (5'11, natural ginger hair) brings an individualistic fashion portrait. Prioritize youthful playful styling and clear runway digitals."
  },
  {
    "key": "jennifer-starr",
    "brand": "DKNY",
    "work": "DKNY Spring 2026 advertising, May 2026",
    "source": "https://models.com/people/jennifer-starr",
    "modelIds": [
      "new-york-women-erin-connors",
      "new-york-women-callie-steg",
      "london-women-ambre-prognitz"
    ],
    "rationale": "Erin (5'11) supplies modern city-ready fashion/denim; Callie (6'1) brings a tall sporty commercial silhouette; Ambre (5'11) offers classic ready-to-wear proportions and can travel from London. Fashion-commercial rather than extreme runway casting."
  },
  {
    "key": "franziska-bachofen-echt",
    "brand": "Dior",
    "work": "Dior Alps 2026 Campaign, published 18 September 2026",
    "source": "https://models.com/people/franziska-bachofen-echt",
    "modelIds": [
      "new-york-women-agang",
      "new-york-women-claudia-lucchini",
      "new-york-women-maja-stockwell"
    ],
    "rationale": "Agang (5'11, 30-25-33) and Claudia (5'10, 30-23-32) have lean luxury campaign proportions; Maja's 6'2 height gives a sculptural, directional alternative. Select images with polished high-fashion tailoring and strong clean digitals, not casual lifestyle shots."
  },
  {
    "key": "emilie-astrom",
    "brand": "Dior Beauty",
    "work": "Dior Beauty A SPRING GLOW editorial, March 2026",
    "source": "https://models.com/people/emilie-astrom",
    "modelIds": [
      "new-york-women-erin-connors",
      "site-women-81-iyanu",
      "new-york-women-agang"
    ],
    "rationale": "Erin's naturally ginger beauty profile, Iyanu's elegant 6'0 fashion/beauty proportions and Agang's 5'11 editorial lines provide three distinct portrait looks. Send clean close-ups and skin-focused imagery; verify current beauty headshots first."
  },
  {
    "key": "davian-lain",
    "brand": "Mondrian Collection",
    "work": "Mondrian Collection June 2025 fashion advertising; DaVian credited as fashion editor/stylist, NOT verified as casting director on that production",
    "source": "https://models.com/people/davian-lain",
    "modelIds": [
      "new-york-women-mary-timms",
      "new-york-women-june-ramadhan",
      "new-york-women-ni-simone"
    ],
    "rationale": "Mary (5'10, 30-20-33), June (5'9, 30-23-33) and Ni (5'9, 29-23-32) have the clean, slim fashion proportions associated with Mondrian's 2025 campaign; their variety suits an editorial-style campaign. This is a styling/creative relationship, not a confirmed brand casting route."
  },
  {
    "key": "david-chen",
    "brand": "Self-Portrait",
    "work": "Self-Portrait 'A night out' August 2025 credited to David Chen; brand continues campaigns/lookbooks through 2026",
    "source": "https://models.com/people/david-chen",
    "modelIds": [
      "new-york-women-erin-connors",
      "new-york-women-mary-timms",
      "new-york-women-june-ramadhan"
    ],
    "rationale": "Erin (5'11, 32-23-35) suits elegant ready-to-wear; Mary (5'10, 30-20-33) fits a narrow sample silhouette; June (5'9, 30-23-33) has wearable occasionwear/lookbook proportions. Prioritize polished, feminine, posed fashion photography."
  },
  {
    "key": "katherine-mateo",
    "brand": "Adidas Originals x Avirex",
    "work": "Adidas Originals x Avirex October 2025 campaign credited in Models.com",
    "source": "https://models.com/people/katherine-mateo",
    "modelIds": [
      "new-york-women-callie-steg",
      "new-york-women-agang",
      "new-york-women-rachel-stone"
    ],
    "rationale": "Callie (6'1) has a tall sport-fashion frame and a prior Nike connection; Agang (5'11) is a strong lean streetwear runway candidate; Rachel (5'10) contributes alternative/editorial energy. Avoid an overly polished bridal aesthetic; emphasize urban casual movement."
  },
  {
    "key": "dionne-cochrane",
    "brand": "Glossier",
    "work": "Glossier is listed among Cochrane Casting's official beauty clients; no current Glossier job verified",
    "source": "https://cochranecasting.com/about",
    "modelIds": [
      "new-york-women-ni-simone",
      "site-women-81-iyanu",
      "new-york-women-erin-connors"
    ],
    "rationale": "Ni (5'9), Iyanu (6'0) and Erin (5'11, naturally ginger) make a varied natural-beauty shortlist. Glossier-oriented selections depend primarily on authentic skin-focused close-ups, expression and current digitals rather than runway height."
  },
  {
    "key": "daniel-peddle",
    "brand": "Playlovewin The Family",
    "work": "Playlovewin The Family 2026 Campaign, 2 September 2026; casting Daniel Peddle, designer Phillip Lim",
    "source": "https://models.com/people/Daniel-Peddle",
    "modelIds": [
      "new-york-women-agang",
      "new-york-women-rachel-stone",
      "new-york-women-erin-connors"
    ],
    "rationale": "Agang (5'11, 30-25-33), Rachel (5'10, 32-24.5-33.5) and Erin (5'11, 32-23-35) are within a practical portrait/lookbook height range and offer distinct, characterful editorials suited to a family/individuality-led fashion campaign. Current campaign cast includes Tess Breeden and Kati Nescher."
  },
  {
    "key": "oliver-ress",
    "brand": "Cartier",
    "work": "Panthère de Cartier: Always On campaign, November 2025; Cartier Fall 2025 lookbook",
    "source": "https://models.com/people/Oliver-Ress",
    "modelIds": [
      "new-york-women-erin-connors",
      "new-york-women-mary-timms",
      "new-york-women-june-ramadhan"
    ],
    "rationale": "Erin supplies distinctive beauty close-ups; Mary (5'10) has a refined narrow fashion silhouette; June (5'9) is versatile for jewelry portrait and product shots. Choose hands, necklines, clean facial closeups; confirm those images exist. Oliver shares RAW Studio with Emilie, so avoid an identical simultaneous pitch."
  }
];
window.updateCastingDirectorBrandSelections20261012=function(data){
  if(!data||typeof data!=='object')return data;
  data.recovery=data.recovery||{};
  if(data.recovery.castingDirectorBrandSelections20261012===1)return data;
  const models=new Map((data.models||[]).map(m=>[m.id,m]));
  const skipped=[];
  let updated=0;
  for(const spec of PAIRINGS){
    const id='casting-director-20261012-'+spec.key;
    const d=(data.drafts||[]).find(x=>x&&x.id===id);
    if(!d)continue;
    // Do not overwrite intentional changes or an existing Gmail draft/send.
    if(d.gmailDraftId||d.gmailMessageId||d.providerId||Object.prototype.hasOwnProperty.call(d,'previewHtml')||
       Object.keys(d.userOverrides||{}).length||d.selectionPlanVersion!==1){
      skipped.push(id);
      continue;
    }
    if(spec.modelIds.some(id=>!models.has(id))){skipped.push(id+' (model missing)');continue;}
    const selected=spec.modelIds.map(id=>models.get(id));
    const names=selected.map(m=>m.name);
    const intro='Hi '+d.contactName.split(/\s+/)[0]+',\n\nI wanted to send '+names.slice(0,2).join(', ')+', and '+names[2]+' for consideration for upcoming projects involving '+spec.brand+'. Their materials are below. Please let me know if you would like to see any of them for a casting or go-see.';
    // Only package fields updated, using models' EXISTING gallery and saved extras.
    Object.assign(d,{
      packageName:'Campaign Casting | '+spec.brand+' | '+d.contactName,
      eventName:'Campaign Casting',
      company:spec.brand,
      brandProject:spec.brand,
      subject:spec.brand+' | Upcoming Model Consideration',
      initialMessage:intro,
      modelIds:[...spec.modelIds],
      models:[...names],
      selectionRationale:spec.rationale,
      selectionPlanVersion:2,
      brandResearchSource:spec.source,
      brandCastingEvidence:spec.work,
      brief:'Models.com casting-credit or official client-list research: '+spec.work+' Prior work is not proof of a current paid opening.',
      castingBriefRaw:'Proactive submission for possible future '+spec.brand+' work. Confirm open casting, fees, usage, dates, location and travel before committing models.',
      parsedBrief:{project:spec.brand,location:'Unknown'},
      researchStatus:'Brand matched to past casting/creative credit — no open paid role confirmed',
      notes:'BRAND: '+spec.brand+'\nCASTING DIRECTOR: '+d.contactName+'\nVERIFIED PRIOR WORK: '+spec.work+'\nSOURCE: '+spec.source+'\nSELECTED MODELS: '+names.join(', ')+'\nWHY THEY FIT: '+spec.rationale+'\nCONTACT: '+(d.recipientEmail||'Not verified')+'\nCANVA: '+(d.canvaEditUrl||'See the separate Canva copy')+' (editing copy only; public access unverified)\nThis Canva copy still contains the 48-page regular roster; select/hide the non-matching models before sending. No currently open paid casting, rate, usage, dates or deadline has been confirmed. Do not send without review.'
    });
    updated++;
  }
  data.recovery.castingDirectorBrandSelections20261012=1;
  data.recovery.castingDirectorBrandSelectionsUpdatedCount=updated;
  data.recovery.castingDirectorBrandSelectionsSkippedIds=skipped;
  return data;
};
})();
