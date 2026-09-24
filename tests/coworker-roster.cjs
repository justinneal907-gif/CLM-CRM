const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {window: {}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('package-app/roster.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('package-app/roster-updates.js', 'utf8'), context);

const snapshot = context.window.CLM_PACKAGE_ROSTER;
const updates = context.window.CLM_ROSTER_UPDATES;
const byId = new Map(snapshot.map(model => [model.id, {...model}]));
updates.forEach(model => byId.set(model.id, {...byId.get(model.id), ...model}));
const roster = [...byId.values()];

const eva = roster.find(model => model.name === 'Eva Kann');
assert(eva, 'Eva Kann should be present in the coworker roster');
assert.equal(eva.profileUrl, 'https://www.chezlesmannequins.com/main-board/eva');
assert.match(eva.measurements, /Height: 172\.5cm/);

const admin = fs.readFileSync('package-app/admin.html', 'utf8');
assert(admin.includes('roster-updates.js'), 'restricted app should load roster updates');
for (const privateFeature of ['GMAIL_OAUTH_CLIENT_ID', 'WORK_GMAIL_CONTACTS', 'RECOVERED_DRAFTS', 'PARIS']) {
  assert(!admin.includes(privateFeature), `restricted app leaked ${privateFeature}`);
}

console.log(`Restricted roster verified: ${roster.length} models, including Eva Kann.`);
