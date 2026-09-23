const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const tracker=fs.readFileSync(path.join(root,'assets','crm-open-tracking.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'assets','models','sophia-extra-photo-2.js'),'utf8');

// Syntax smoke test.
new Function(tracker);

assert.match(tracker,/Send tracked draft/);
assert.match(tracker,/X-CLM-Tracking-State/);
assert.match(tracker,/data-clm-open-track/);
assert.match(tracker,/countapi\.mileshilliard\.com\/api\/v1/);
assert.match(tracker,/gmail\/v1\/users\/me\/drafts\/send/);
assert.match(tracker,/openTrackingFirstDetectedAt/);
assert.match(tracker,/sendTrackingId=randomHex/);
assert.doesNotMatch(tracker,/await resetCounter\(d\.openTrackingId\)/);
assert.match(tracker,/Tracked send failed\. Nothing was sent/);
assert.match(loader,/crm-open-tracking\.js\?v=20260923-2/);

console.log('open tracking module smoke test passed');
