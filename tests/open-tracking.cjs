const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const tracker=fs.readFileSync(path.join(root,'assets','crm-open-tracking.js'),'utf8');
const sync=fs.readFileSync(path.join(root,'assets','crm-email-sync.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const loader=fs.readFileSync(path.join(root,'assets','models','sophia-extra-photo-2.js'),'utf8');

// Syntax smoke tests for the standalone add-ons.
new Function(tracker);
new Function(sync);

assert.match(tracker,/Send tracked draft/);
assert.match(tracker,/X-CLM-Tracking-State/);
assert.match(tracker,/data-clm-open-track/);
assert.match(tracker,/countapi\.mileshilliard\.com\/api\/v1/);
assert.match(tracker,/gmail\/v1\/users\/me\/drafts\/send/);
assert.match(tracker,/openTrackingFirstDetectedAt/);
assert.match(tracker,/sendTrackingId=randomHex/);
assert.doesNotMatch(tracker,/await resetCounter\(d\.openTrackingId\)/);
assert.match(tracker,/Tracked send failed\. Nothing was sent/);
assert.match(tracker,/if\(r\.status===401\)/);
assert.match(tracker,/Create or update this package as a Work Gmail draft first/);
assert.doesNotMatch(tracker,/if\(d\.submittedAt\)throw new Error\('This package is already marked as submitted\.'\)/);

assert.match(index,/linkedDraftId/);
assert.match(index,/method==='PUT'/);
assert.match(index,/response\.status===404/);

assert.match(sync,/if\(s\.gmailMessageId\)return false/);
assert.match(sync,/findDraftForMessage\(subject,to,messageId\)/);

assert.match(loader,/crm-open-tracking\.js\?v=20260923-3/);
assert.match(loader,/crm-email-sync\.js\?v=20260923-2/);

console.log('open tracking and Gmail send consistency smoke test passed');
