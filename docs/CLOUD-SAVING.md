# Private CRM cloud saving

The CRM keeps its working copy in the browser (IndexedDB `jn-agency-crm`). `assets/crm-cloud.js` mirrors that copy to the private Supabase project `coipdgmfuervnuqnfiud` so every browser that signs in sees the same packages.

## Using it

A small "Cloud saving" panel sits in the bottom right corner of the CRM. Sign in with the agency work account. The first sign in on a browser merges that browser's packages into the cloud copy and pulls in any packages the browser was missing. After that, every local save is pushed to the cloud about eight seconds later. "Save now" forces a sync.

## Rules that protect data

- Syncing only adds or updates. A package missing on one side is never treated as deleted.
- A package is removed only by an explicit deletion marker (`packageDeletionTimes`) that is newer than the package's last edit.
- When both sides hold the same package, the most recently edited copy wins (on a tie, the browser copy). Fields the winning copy lacks are filled from the other copy, so a slimmer copy never thins out a richer one.
- Lists of records with ids (models, contacts and so on) are unioned. Settings objects are merged with the browser's values winning.
- The open draft, current selection and active package stay local to each browser.
- Every commit stores the previous version of each changed part in `crm_cloud_history`.
- A cloud failure is shown in the panel and never blocks the editor or the local save.

## Storage layout

- `crm_cloud_state`: one row per owner with the revision number.
- `crm_cloud_parts`: one row per package (`draft:<id>`), one per model photo library (`gallery:<model id>`) and one per other workspace field (`<field>`).
- `crm_cloud_history`: previous values of changed parts, per revision.
- `crm_commit(p_expected, p_parts)`: the only write path. It checks the work account, locks the state row, rejects stale revisions with `CRM_CONFLICT`, records history, upserts the parts and increments the revision. The browser resolves a conflict by pulling, merging and retrying.

## Photos

Photos uploaded into the CRM live in the browser's media store and are referenced as `clm-media:<id>`. Each referenced photo is uploaded once to the private `clm-crm-private` bucket under the owner's folder; identical bytes are stored once. `cloudMediaManifest` maps every reference to its file and syncs like any other field. A browser that is missing a referenced photo downloads it into its own media store under the same id. Photos nothing refers to are not uploaded. Package photos referenced by URL sync as text.

`docs/private-cloud-schema.sql` records the database setup.
