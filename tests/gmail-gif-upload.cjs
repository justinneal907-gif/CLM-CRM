const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('index.html','utf8');
 // A large GIF attachment exercises MIME construction without a browser DOM.
 const gif=Buffer.concat([Buffer.from('GIF89a'),Buffer.alloc(8*1024*1024,17)]);
 const payload=gif.toString('base64');
 const ctx={Blob,TextEncoder,Date,btoa:v=>Buffer.from(v,'binary').toString('base64'),WORK_EMAIL:'sender@example.com',AGENT_CC:'agency@example.com',gmailPlainText:()=> 'Model package',gmailInlineDataImages:()=>({html:'<img src="cid:gif-test">',parts:[{mime:'image/gif',payload,cid:'gif-test',filename:'model.gif'}]})};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function gmailBase64Utf8('),source.indexOf('function gmailPlainText(')),ctx);
 vm.runInContext(source.slice(source.indexOf('function buildGmailDraftRaw('),source.indexOf('async function gmailDraftRequest(')),ctx);
 const blob=ctx.buildGmailDraftRaw('recipient@example.com','Animated package','', '',true);
 assert(blob instanceof Blob);assert.equal(blob.type,'message/rfc822');
 const mime=await blob.text();assert.match(mime,/Content-Type: image\/gif/);assert.match(mime,/src="cid:gif-test"/);
 const match=mime.match(/Content-Disposition: inline; filename="model.gif"\r\n\r\n([\s\S]*?)\r\n--/);
 assert.deepEqual(Buffer.from(match[1].replace(/\s/g,''),'base64'),gif);
 const raw=ctx.buildGmailDraftRaw('recipient@example.com','Animated package','');assert(raw.length>blob.size);
 console.log('8 MB GIF preserved byte-for-byte in direct MIME upload; no outer base64 encoding.');
})().catch(e=>{console.error(e);process.exitCode=1});
