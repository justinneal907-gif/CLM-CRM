# Model-page signals — setup and limits

The CRM integration is installed but collection is **off by default**. There is no live GA4 connection. Until website setup and the first event import are complete, the panel says **Not connected**, not zero visits.

## What this version implements

- Adds opaque submission IDs, model IDs and display positions to direct agency portfolio links in new formatted Gmail drafts, once enabled. It does not tag Instagram, Canva, search pages, or arbitrary third-party links.
- Records `model_view` only after at least two continuous seconds visible with consent. Records `model_interaction` after a trusted pointer or keyboard event following that view. A trusted event is stronger evidence than an image request, not proof of a particular human.
- A client-side staff-device exclusion and known-automation checks suppress these custom events. Office-network exclusion is performed by GA4's active internal-traffic filter, not by browser JavaScript.
- Imports verified, event-level JSON to show model visits by package, sessions, repeat visitors across sessions, interaction sessions and package visit rate. Repeat imports are deduplicated.
- Gmail send confirmation or sent-mail sync marks a package sent. Draft/pre-send events do not qualify. Existing open counters remain separate.

## Required access and installation

Requires Squarespace code-injection access and GA4 property administration. No account, property ID or office IP address was available when this code was prepared.

1. Use the site's existing GA4 installation; do not install a duplicate Google tag. Note its `G-...` measurement ID. If it uses Tag Manager rather than a global `gtag` function, adapt the emitter to that deployment before activation.
2. In GA4, define internal traffic for the office public IPv4 and IPv6 addresses/ranges. Test the rule against an office visit, then activate the **Exclude internal traffic** filter. Active filtering permanently removes incoming matching data. A changing office IP requires updating the rule. Test from an external network as a control.
3. Configure the script below through Squarespace footer code injection after the existing Google tag. Set `hasAnalyticsConsent` to a function reading your site's actual consent state. The sample returns false intentionally: do not replace it with unconditional true. The custom script does not initialize Google consent mode or override the website's consent manager.

```html
<script>
window.CLM_MODEL_SIGNALS_CONFIG = {
  measurementId: 'G-REPLACE_WITH_YOUR_PROPERTY',
  officeExclusionVerified: false,
  hasAnalyticsConsent: function () { return false; } // integrate with your consent manager
};
</script>
<script src="https://justinneal907-gif.github.io/CLM-CRM/assets/squarespace-model-signals.js?v=20260923-1" defer></script>
```

4. After testing the office exclusion, set `officeExclusionVerified: true`. Mark **every staff browser/device**, including the ones used by agent@, by visiting `https://www.chezlesmannequins.com/?clm_staff=1`. The installed script confirms that browser is excluded. Storage must be available. Incognito, another browser, cleared storage or another device needs its own exclusion. The marker only suppresses these custom signals, not other analytics on the site. To remove a marker deliberately, run `clmSetStaffDevice(false)` on the agency site.
5. Verify that denied consent, a hidden page and marked staff browsing produce no custom events, while an external consented visit produces `model_view` and an interaction produces `model_interaction`. Office traffic should be absent from production GA4 data after filtering. Filter-test mode is not exclusion.
6. Only after those checks, enable submission IDs in **Packages & Leads → Model-page signals**. Create a fresh formatted Gmail draft and inspect its portfolio links before sending. No email is sent by this setup.

### Attribution limit

The same links go to the recipient and agency CC. The website cannot identify the mailbox that clicked. Office and marked-device exclusions reduce internal traffic but **cannot guarantee** exclusion of agent@ on an unmarked external device. Do not describe this as recipient-verified engagement. The existing CC workflow is unchanged. Cookie clearing, cross-device use and sophisticated bots affect counts. A normal Gmail open does not produce a model-page event.

## Importing data into the CRM

This version has a manual event import, not automated GA4 polling. BigQuery event export is the supported source; aggregated GA4 report CSVs lack the session/event detail this importer needs. If BigQuery is not linked, completing that connection or adding an authenticated GA4 reporting bridge is still required.

Use `analytics/export-model-signals.sql` against your own GA4 export dataset. Replace the dataset placeholder and choose the date range. Export query rows as JSON, then use `python scripts/wrap-model-signals.py rows.json verified-signals.json --office-filter-verified --staff-exclusion-verified` **only after checking those exclusions**. The wrapper accepts a JSON array or newline-delimited JSON. Import the result in the CRM's Model-page signals panel. Do not commit exports containing visitor data to GitHub.

Payload shape:

```json
{
  "schema": "clm-model-signals-v1",
  "office_filter_active": true,
  "staff_exclusion_verified": true,
  "events": [
    {
      "event_name": "model_view",
      "submission_id": "32-character-ID-from-the-email-link",
      "model_id": "existing-CRM-model-ID",
      "visitor_id": "anonymous-browser-ID",
      "session_id": "anonymous-session-ID",
      "timestamp": "2026-09-23T21:00:00.000Z",
      "traffic_type": ""
    }
  ]
}
```

Unknown submissions/models, pre-send events, known internal/staff/bot events and malformed events are excluded. Visit rate uses **sent packages containing the model** as its denominator, not delivered emails or recipients; it is not email CTR. Imported data is historical through the export's cutoff, not live. Fields are stored with your existing browser CRM data and its backups.

## References

- [GA4 internal traffic filtering](https://support.google.com/analytics/answer/10104470)
- [Google tag event API](https://developers.google.com/tag-platform/gtagjs/reference)
- [GA4 BigQuery export schema](https://support.google.com/analytics/answer/7029846)
- [Squarespace code injection](https://support.squarespace.com/hc/en-us/articles/205815908-Customize-parts-of-your-site-with-code-injection)
