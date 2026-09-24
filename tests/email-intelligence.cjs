const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const intel=fs.readFileSync(path.join(root,'assets','crm-email-intelligence.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

new Function(intel);

assert.match(intel,/__clmEmailIntelligenceLoaded/);
assert.match(intel,/gmail\/v1\/users\/me\/threads/);
assert.match(intel,/humanReplyCount/);
assert.match(intel,/responseLatencyMinutes/);
assert.match(intel,/latestInboundUnread/);
assert.match(intel,/bounceCount/);
assert.match(intel,/autoReplyCount/);
assert.match(intel,/latestReplySignals/);
assert.match(intel,/latestInboundPreview/);
assert.match(intel,/participantEmails/);
assert.match(intel,/recipientDomain/);
assert.match(intel,/Export email data CSV/);
assert.match(intel,/clmSyncEmailIntelligence/);
assert.match(index,/crm-email-intelligence\.js\?v=20260924-1/);

console.log('email intelligence smoke test passed');
