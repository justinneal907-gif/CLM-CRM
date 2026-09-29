# CLM CRM Claude Handoff

## What to give Claude

Give Claude this repository and the browser export produced by `claude-export.html`.

Repository:
https://github.com/justinneal907-gif/CLM-CRM

Live site:
https://justinneal907-gif.github.io/CLM-CRM/

Baseline commit at handoff:
672eefc798d5ef4372a2bd4583310b73218a2ccd

The repository contains the application source and seeded/archive data. The browser export contains the user's live persisted CRM workspace and locally stored media. Both are required for a complete transfer.

## Critical context

This is a browser based agency CRM for Chez Les Mannequins. It manages models, contacts, submissions, bookings, tasks, packages, email drafts, Gmail integration, email open signals, response tracking, model responses, package photo selections, and package generation.

The most important unresolved issue at handoff is photo recovery. The user previously had saved drafts/packages containing a very large number of model images. A September 29 gallery cleanup/deduplication sequence caused many saved draft image selections to disappear from the visible drafts. Several recovery commits restored archived gallery material but did not restore the user's expected saved draft state. Do not assume the current visible UI is the authoritative historical state. Treat the exported IndexedDB workspace, every non-primary workspace backup record, archived photo-library JSON files, historical draft sources, and Git history as recovery evidence.

Do not delete or deduplicate photo records until the user confirms the recovered drafts are correct. Prefer non-destructive migrations and snapshots before any repair.

## User workflow requirements

When selecting models for fashion shows, inspect the show's prior casts, putting the most weight on the most recent show on Models.com. Compare skin tone, hair length, build, facial structure, and the overall casting pattern against the agency roster and recent submission history. Avoid repeatedly submitting models who are unavailable or poorly matched.

CRM draft copy should not use dashes.

The user wants the CRM to stay fast even with many model images. Do not solve performance problems by deleting historical images or destructive deduplication. Use lazy loading, IndexedDB/blob storage, thumbnails, pagination/virtualization, and non-destructive references instead.

Gmail draft creation and email tracking are important workflows. Preserve current contact, draft, submission, and tracking data while repairing performance or media handling.

## Data architecture

### Repository seeded/static data

Primary application:
- `index.html`

Core roster and archive data:
- `assets/data/core-roster.js`
- `assets/data/milan-archive.js`
- `assets/data/nyfw-casting-leads.html`
- `assets/data/photo-library-restore-20260918-part-01.json`
- `assets/data/photo-library-restore-20260918-part-02.json`
- `assets/data/photo-library-restore-20260918-part-03.json`
- `assets/data/photo-library-restore-20260918-part-04.json`
- `assets/data/photo-library-restore-20260918-part-05.json`
- `assets/data/photo-library-restore-20260918-part-06.json`
- `assets/data/photo-library-restore-20260918-part-07.json`

Recovery data:
- `recovery/paris-drafts.json`
- `recovery/index.html`

Media and roster assets:
- `assets/models/`
- `package-app/roster.js`

Runtime modules:
- `assets/crm-media-store.js`
- `assets/crm-email-sync.js`
- `assets/crm-gmail-throttle.js`
- `assets/crm-model-responses.js`
- `assets/crm-model-signals.js`
- `assets/crm-open-tracking.js`
- `assets/crm-response-time.js`
- `assets/model-signals-core.js`
- `assets/squarespace-model-signals.js`

Tests:
- `tests/`

### Browser persisted data

IndexedDB database:
- Database: `jn-agency-crm`
- Current version: `2`
- Workspace store: `workspace`
- Primary workspace key: `primary`
- Media store: `media`

Important workspace backup key that may exist:
- `backup-before-gallery-repair-20260929`

The browser export intentionally reads every record in every object store so future or recovery keys are not missed.

Known legacy/fallback localStorage keys:
- `jn-agency-crm-copy-v2`
- `jn-agency-crm-copy-v1`
- `justinAgencyCRM.v4`
- `justinAgencyCRM.customPhotos.v1`
- `jn-agency-crm-indexeddb-migrated-v1`
- `clm.crm.gmailOAuthClientId.v1`
- `clm.crm.gmailSentSyncIds.v1`
- `clm.crm.optimizedRemoteMedia.v1`
- `clm.gmail.quotaCooldownUntil.v1`
- `clm.gmail.nextRequestAt.v1`
- keys under `clm.gmail.background.`
- `pfwMaliaReineAvailabilitySeedVersion`

The export page captures CRM-prefixed localStorage values but excludes obvious token, password, secret, and session keys.

### Gmail/auth data

Do not transfer Gmail access tokens or session credentials in a handoff file. Reconnect the user's Work Gmail account through the normal OAuth flow. The configured work mailbox in the CRM is:
`justin.neal.chezlesmannequins@gmail.com`

The OAuth client ID is configuration, not an access token, and may be present in the browser export. Claude should never ask the user to paste an access token into source code.

## Photo recovery strategy for Claude

1. Make a byte-for-byte copy of the user's exported JSON before changing anything.
2. Inspect every `workspace` store record, not just `primary`.
3. Compare `drafts[*].photoSelections`, `drafts[*].packagePhotos`, active `draft.photoSelections`, active `draft.packagePhotos`, `photoLibrary`, `customPhotos`, and model photo arrays.
4. Decode and inventory every exported `media` store Blob record.
5. Compare draft IDs against the static Milan, Paris, Bridal, Callie, additional CRM, and recovered draft sources.
6. Use Git history around September 29, especially commits before and after gallery deduplication, to determine exactly when draft image arrays changed.
7. Build a non-destructive recovery preview/report first. For each draft show current image count, recoverable historical image count, source of recovery, and proposed final count.
8. Only after user confirmation should recovered arrays be written back.
9. Keep image identity/reference aliases; do not collapse distinct saved selections merely because image bytes or URLs are duplicated unless the user explicitly wants that.
10. Preserve current draft text, recipients, model order, contact data, submission history, and manual edits while restoring photos.

## Recent September 29 media/recovery commit sequence

Relevant commit messages include:
- Move CRM media to blobs and lazy load archived data
- Deduplicate gallery media by image content and reuse identical uploads
- Restore all photo gallery entries by reverting content deduplication
- Make gallery cleanup non destructive and preserve saved drafts
- Recover missing package photos without overwriting draft edits
- Restore archived photo library parts 1 through 7
- Restore archived model photos without changing drafts
- Restore all archived photos without modifying drafts
- Restore saved draft image selections from pre-cleanup backup

Use Git history rather than assuming the latest repair is correct.

## Recommended first task for Claude

Do not make another repair immediately. First ingest:
1. the full Git repository,
2. the browser export JSON,
3. this handoff document.

Then produce a recovery audit that identifies the exact data source containing the largest historical photo set for each saved draft and explains why the currently visible draft differs from it. After that, make a reversible migration with a backup and verification counts.
