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
assert.match(tracker,/openTrackingLastDetectedAt/);
assert.match(tracker,/Latest detected:/);
assert.match(tracker,/sendTrackingId=randomHex/);
assert.doesNotMatch(tracker,/await resetCounter\(d\.openTrackingId\)/);
assert.match(tracker,/Gmail did not confirm whether this message sent/);
assert.match(tracker,/send-uncertain/);
assert.match(tracker,/Notification\.requestPermission/);
assert.match(tracker,/serviceWorker\.register/);
assert.match(tracker,/showNotification/);
assert.match(tracker,/new Notification\(/);
assert.match(tracker,/Enable open alerts/);
assert.match(tracker,/Test alert/);
assert.match(tracker,/checkOpens\(false,true\)/);
assert.match(tracker,/if\(r\.status===401\)/);
assert.match(tracker,/Create or update this package as a Work Gmail draft first/);
assert.doesNotMatch(tracker,/if\(d\.submittedAt\)throw new Error\('This package is already marked as submitted\.'\)/);
assert.match(tracker,/patchTracker/);
assert.match(tracker,/priorForDraft/);

assert.match(index,/linkedDraftId/);
assert.match(index,/method==='PUT'/);
assert.match(index,/response\.status===404/);

assert.match(sync,/if\(s\.gmailMessageId\)return false/);
assert.match(sync,/findDraftForMessage\(subject,to,messageId\)/);

assert.doesNotMatch(loader,/crm-open-tracking\.js/);
assert.doesNotMatch(loader,/crm-email-sync\.js/);
assert.match(index,/crm-open-tracking\.js\?v=20260924-11/);
assert.match(index,/crm-email-sync\.js\?v=20260924-1/);
assert.match(index,/GMAIL_SESSION_KEY/);
assert.match(index,/sessionStorage\.setItem\(GMAIL_SESSION_KEY/);
assert.match(index,/restoreWorkGmailSession/);
assert.match(index,/startGmailSessionKeeper/);
assert.match(index,/clm:workspace-ready/);
assert.match(index,/gmail\.readonly/);
assert.match(index,/sendTrackedDraftBtn/);
assert.match(index,/testOpenNotificationsBtn/);
assert.match(index,/clmReloadEmailRuntime/);
assert.match(index,/__clmEmailSyncLoaded/);
assert.match(index,/__clmOpenTrackingLoaded/);
assert.doesNotMatch(sync,/initTokenClient/);
assert.match(sync,/__clmEmailSyncLoaded/);
assert.match(sync,/initWhenReady/);
assert.match(tracker,/__clmOpenTrackingLoaded/);
assert.match(tracker,/clmTestOpenNotification/);
assert.match(tracker,/initWhenReady/);

console.log('open tracking and Gmail send consistency smoke test passed');
