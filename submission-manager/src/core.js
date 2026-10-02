export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) { try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch { return ''; } }
export function richText(value) {
  return String(value||'').split(/(\[[^\]\n]+\]\(https:\/\/[^\s)]+\))/g).map(part=>{const m=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);return m&&safeURL(m[2])?`<a href="${escapeHTML(safeURL(m[2]))}" target="_blank" rel="noopener noreferrer">${escapeHTML(m[1])}</a>`:escapeHTML(part).replace(/\n/g,'<br>');}).join('');
}
export function subject(p) { return [p.event.trim(),p.brand.trim()].filter(Boolean).join(' | '); }
export function recipients(text) { const values=[...new Set(String(text).split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean))]; if(!values.length||values.length>50||values.some(x=>!/^([^\s<>@,;]+)@([^\s<>@,;]+)\.([^\s<>@,;]+)$/.test(x))) throw Error('Enter 1 to 50 valid recipient email addresses, separated by commas or new lines.'); return values; }
export function renderPackage(p) {
 const b=p.body||{}, width=Math.min(600,Math.max(160,Number(b.photoWidth)||360));
 const models=(b.models||[]).map(m=>`<section style="margin:28px 0"><h2 style="font:22px Georgia,serif;margin:0 0 8px">${safeURL(m.profile_url)?`<a style="color:inherit" href="${escapeHTML(safeURL(m.profile_url))}">${escapeHTML(m.name)}</a>`:escapeHTML(m.name)}</h2>${b.measurements!==false?`<p style="font-size:13px">${escapeHTML(m.measurements)}</p>`:''}${(m.selectedMedia||[]).map(x=>{const u=safeURL(x.url); if(!u)return '';return x.type==='video'?`<p><a href="${escapeHTML(u)}">${escapeHTML(x.label||'View video')}</a></p>`:`<a href="${escapeHTML(u)}"><img src="${escapeHTML(u)}" width="${width}" alt="${escapeHTML(m.name)}" style="display:block;max-width:100%;height:auto;margin:10px 0" loading="lazy"></a>`;}).join('')}${m.textEnabled!==false&&m.text?`<p>${richText(m.text)}</p>`:''}</section>`).join('');
 return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;background:#fff;color:#191b19;font:15px/1.6 Arial,sans-serif"><main style="max-width:680px;margin:auto">${b.intro?`<div>${richText(b.intro)}</div>`:''}${models}${b.closing?`<div>${richText(b.closing)}</div>`:''}</main></body></html>`;
}
export function base64UTF8(s) { const bytes=new TextEncoder().encode(s); let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary); }
export function mime(p,to) { recipients(to);const html=renderPackage(p);return `To: ${to}\r\nSubject: =?UTF-8?B?${base64UTF8(subject(p))}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64UTF8(html).match(/.{1,76}/g).join('\r\n')}`; }
export function newPackage(w) { return {workspace_id:w,event:'',brand:'',body:{recipients:'',intro:'',closing:'',photoWidth:360,measurements:true,models:[]}}; }
export function snapshot(m) { return {id:m.id,name:m.name,measurements:m.measurements,profile_url:m.profile_url,selectedMedia:(m.media||[]).slice(0,1),text:'',textEnabled:true}; }
export function normalizeImport(rows) {
 if(!Array.isArray(rows)||rows.length>2000)throw Error('Choose a roster JSON array with at most 2,000 models.');
 return rows.map(m=>{
 const name=String(m.name||'').trim(); if(!name)throw Error('Every model needs a name.');
 const market=String(m.market||m.location||'');
 if(name.toLowerCase()==='molly'&&!/new york/i.test(market))return null;
 const raw=m.media||[m.photoUrl,...(m.photos||[])].filter(Boolean).map(x=>typeof x==='string'?{url:x}:x);
 const media=[...new Map(raw.map(x=>({...x,url:safeURL(x.url||x.src||'')})).filter(x=>x.url).map(x=>[x.url,{id:crypto.randomUUID(),url:x.url,type:x.type==='video'?'video':'image',label:String(x.label||'')}])).values()];
 return {name,market,measurements:String(m.measurements||''),profile_url:safeURL(m.profile_url||m.profileUrl||''),media,texts:Array.isArray(m.texts)?m.texts.map(t=>({id:crypto.randomUUID(),label:String(t.label||'Text'),text:String(t.text||'')})):[]};
 }).filter(Boolean);
}
