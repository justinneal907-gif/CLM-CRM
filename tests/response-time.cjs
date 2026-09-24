const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const response=fs.readFileSync(path.join(root,'assets','crm-response-time.js'),'utf8');
const tracking=fs.readFileSync(path.join(root,'assets','crm-open-tracking.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

new Function(response);
new Function(tracking);

assert.match(response,/responseMinutes/);
assert.match(response,/emailResponseTimeMinutes/);
assert.match(response,/first human reply/i);
assert.doesNotMatch(response,/latestInboundPreview/);
assert.doesNotMatch(response,/latestReplySignals/);
assert.doesNotMatch(response,/Export email data CSV/);
assert.match(tracking,/Response time:/);
assert.match(index,/crm-response-time\.js\?v=20260924-1/);
assert.doesNotMatch(index,/crm-email-intelligence\.js/);

console.log('response-time-only email metric smoke test passed');
