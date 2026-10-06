# Brand Intelligence implementation

## Status

Implemented on `feature/brand-intelligence`, integrated with production commit `c18946e`, preserving its nine Miami Fashion Week drafts. The original rollback snapshot is `7d9ce80`. The production application is `index.html` on GitHub Pages. Its roster, submissions and draft documents live in the browser, with existing IndexedDB/localStorage persistence. The separate Supabase submission manager currently has zero workspace, model and package records. This feature therefore reads the production `db` without moving or duplicating it.

The `brand-intelligence` Supabase Edge Function is deployed to project `coipdgmfuervnuqnfiud`. Live research requires two administrator-provided secrets before it can operate. Deployment alone does not make live research available. No database tables, migrations, RLS policies, existing records, model media, Gmail routines or email templates were changed.

## Setup needed for live research

In Supabase project settings / Edge Function secrets:

1. Set `PARALLEL_API_KEY` to a Parallel API credential with Responses API access.
2. Set `CLM_RESEARCH_TOKEN` to a randomly generated private token of at least 32 characters. Do not use the Supabase public key.
3. In the CRM Brand Intelligence connection settings, enter that access token. It is stored in sessionStorage for the current tab, never in the repository or research export. After saving, the password field is cleared for safety; the status below it confirms whether a token is saved in this tab. The research endpoint is already configured.
4. Run Refresh research, inspect the sourced results, and verify the latest collection and casting information. Finish a real-provider acceptance test before calling the feature complete.

The connected Work mode Parallel Search integration supplied initial research, but it is not a reusable API credential for the deployed application. Provider cost and usage should be controlled in the Parallel account. The function permits at most two concurrent calls and twenty calls per hour per warm worker; this is not a distributed account-wide quota. Add a durable rate limiter if sharing access across agents.

## Package workflow

Enter a brand in the existing package builder. Brand Intelligence displays saved research with sources, evidence labels, collection/season, research date and confidence. Analyze Brand reuses fresh research for the current brand, requested season and job type; Refresh research forces a new source check. Review saved intelligence never calls the provider. Changing the brand selects its own research; changing the job changes the ranking. Requirements are scoped to the current package and brand. They travel in the existing draft snapshot as inert `brandIntelligenceContext` metadata, including when an unsaved package gains its saved ID, is copied or is reopened.

The panel exposes all nine job types, date ranges, exact agency division and location, local-only bookings and client-confirmed height/body measurement ranges in centimeters. An explicit unavailable date overlap, inactive record, incompatible local-only requirement or known measurement conflict excludes a model. Unknown location, travel, dates and measurements remain visible as needing confirmation. Existing availability notes are not automatically interpreted as confirmed restrictions.

Recommended models use existing IDs and the existing `addToEmail` operation. No photos are renamed, moved or reassigned. Existing selected models retain their order; additions append through the existing package API. Research and review operations never generate email body text.

## Research and scoring

Research storage key: `clm.brand-intelligence.v1`. This intentionally separates research from the CRM's large photo-bearing workspace. It includes latest profiles, a cache indexed by canonical brand / requested season / job type, explicitly approved aliases, legacy package job contexts, portfolio assessments, future model descriptor records and adjustable weights. New job requirements use the existing CRM package persistence. Exports are separate from the existing CRM backup. Import accepts a profile or restores profile records from an exported backup; validated aliases and assessments are also restored while current connection and package settings are retained. Malformed storage is preserved for recovery export instead of being silently overwritten.

The endpoint uses Parallel's current Responses API for multi-step web research and structured output at medium reasoning effort. It prioritizes the latest models.com show, official collections, runway publications, campaigns and agency references. It rejects malformed results, wrong-brand or wrong-job responses and sources absent from the provider citation trail. Provider HTTP errors, request timeouts and response validation failures return distinct safe messages, while server logs record the failure stage without recording credentials or provider response content. Failed refreshes retain existing research. This validates source provenance, not every semantic claim; agent review is still required. Research is limited to public brand data: the roster and private submission history are not uploaded. The endpoint fails closed without its private token or provider key. CORS restricts the allowed browser origin.

Every finding has a Verified, Observed, Inferred or Unknown label and source IDs. Unknown claims need no citation. Images stay on source websites as reference links. Initial profiles for Arava Polak, Nardos and Galia Lahav were researched in Work mode on 2026-10-06. They explicitly flag missing casting data and historical collections. No models.com show identity or measurement was fabricated. The attached Milan calendar identifies the September 22–28, 2026 event for SS27; it was not treated as proof of current casting requirements or future availability.

Weights: collection presentation 30, relevant casting experience 20, job suitability 15, garment compatibility 15, portfolio suitability 10, submission freshness 10. Unknown components earn zero points against the full denominator, and evidence coverage is shown alongside the score. Scores are evidence points, never booking probabilities. Job suitability initially uses the existing CRM portfolio categories as low-confidence inference. No appearance analysis is performed. Collection, casting and portfolio assessments require a human-entered reason and source URL, scoped to season and job. They can be recorded for any eligible model, not only the top eight.

Submission counts use stable model IDs first with an exact normalized-name fallback for older records; exact brand/project identities and explicitly approved aliases avoid substring matches. Recent submissions reduce priority but do not ban the model. The panel exposes the recorded outcomes and events. There are no learned booking predictions. No demographic traits, face embeddings or skin tone enter ranking.

## Files

- `index.html`: restore the removed advisor area as Brand Intelligence; route two existing actions to the new panel; load the two feature scripts and independent panel stylesheet.
- `assets/brand-intelligence-core.js`: pure validation, eligibility, history and scoring functions.
- `assets/crm-brand-intelligence.js`: package panel, isolated persistence, import/export, assessments and research connection.
- `assets/crm-brand-intelligence.css`: compact collapsible settings and recommendation cards.
- `assets/data/brand-intelligence.json`: three dated source-backed starter profiles.
- `supabase/functions/brand-intelligence/index.ts`, `supabase/config.toml`: authenticated provider adapter. Deployment includes the shared core file at its repository-relative path.
- `tests/brand-intelligence*.cjs`: unit, full DOM integration, endpoint and optional Chromium acceptance tests.

## Verification

Passed:

- Unit tests with the actual repository roster and all three starter brands.
- Date-overlap exclusions, travel, missing measurements, aliases, exact brand history, recency penalties, evidence coverage and no model-media mutations.
- Full application DOM integration using jsdom, loading the actual local runtime assets and awaiting full workspace initialization (CSS disabled in this DOM harness): three panels, add-to-package, preserved existing user copy, stable model associations, refresh failure, refresh success without duplicate records, and persisted reload, separate job caches, saved package requirements, preserved Miami draft records and unreadable research recovery. No uncaught application JavaScript exceptions in this harness.
- Endpoint tests with a mocked provider: missing secrets, authentication, CORS, invalid job, mismatched returned job, valid citation trail, rejection of missing citations, provider authorization failure and timeout reporting without secret leakage.
- Existing `preview-send.cjs` test.

Incomplete / blocked:

- Live provider calls require the two secrets above. Fixture-based endpoint tests are not evidence of live research success.
- Chromium is unavailable and its download failed in this environment. The Playwright desktop acceptance test is included but has not run. jsdom does not establish rendered desktop layout or browser performance.
- Existing `preview-authority.cjs` fails at `db.drafts[0].previewHtml`; existing `email-package-integrity.cjs` fails because its harness lacks `uniformEmailPhotoSizes`. Both fail identically on untouched commit `7d9ce80`. These unrelated harnesses were not rewritten.
- The private current browser workspace is not available in the filesystem. Tests use real repository roster records and synthetic submission/booking fixtures, not a claim of testing the user's current private Gmail or browser records.

Run from repository root with Node 24 and test dependencies:

```sh
node tests/brand-intelligence.cjs
node tests/brand-intelligence-dom.cjs
node --experimental-strip-types tests/brand-intelligence-endpoint.cjs
```

For optional Chromium acceptance, install Playwright and its browser, serve the repository on `127.0.0.1:8765`, then run `node tests/brand-intelligence-browser.cjs`. Browser/provider traffic is mocked in that test.

## Rollback and next phase

Use production commit `c18946e` as the current pre-release baseline so rollback retains the later Miami drafts. Reverting only the feature changes removes the UI and scripts without modifying CRM data. Keep the separate research storage key to preserve research. The Edge Function is independent of the CRM and can be removed separately.

Next: complete live provider and real desktop acceptance after secret setup; introduce reviewed portfolio descriptors and garment/presentation similarity with provenance. Any visual embedding work should compare styling, garments and demonstrated work, exclude protected-trait inference, preserve original media IDs, and remain optional. Add shared authenticated persistence only when the production CRM has a real shared workspace identity. A new disconnected Supabase roster would not solve that requirement.
