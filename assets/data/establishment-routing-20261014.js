/* Use Calvin Wilson for future Establishment Casting submissions, not Anita Bitton. */
(function(){
const R=window.CLMDailyResearch;if(!R)return;
const contact={id:'establishment-calvin',name:'Calvin Wilson (Establishment Casting)',email:'info@establishmentnewyork.com',source:'https://models.com/agency/Establishment-Casting/info',scope:'Calvin Wilson is a verified Establishment Casting director. This is the published studio inbox, not a verified direct email. Calvin co-cast Ulla Johnson S/S27, but the latest Bottega Veneta show credits Anita. Confirm responsibility before sending.',verifiedAt:'2026-10-14'};
if(!R.casters.some(x=>x.id===contact.id))R.casters.push(contact);
for(const lead of R.leads){
if(!['brand-bottega','bg-20261014-ulla-johnson'].includes(lead.id))continue;
lead.casterId=contact.id;
lead.email=contact.email;
lead.contactName=contact.name;
lead.contactSource=contact.source;
lead.contactVerification=contact.scope;
lead.action=lead.id==='brand-bottega'?'Contact Calvin Wilson via the verified Establishment office address for future Bottega research. Confirm assignment: latest show credited Anita, while Calvin has earlier Bottega casting credits.':'Contact Calvin Wilson through the verified Establishment office address for future Ulla Johnson projects. Calvin co-cast the latest show. Already submitted to Anita on October 14: review previous correspondence before a new send.';
}
R.version='20261014-establishment-calvin-1';R.verifiedAt='2026-10-14';
})();
