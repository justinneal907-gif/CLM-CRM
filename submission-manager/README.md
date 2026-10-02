# Chez Les Submission Manager

A separate multi-user package builder. Production frontend: https://justinneal907-gif.github.io/CLM-CRM/submission-manager-live/

Supabase project: **Chez Les Submission Manager**, `coipdgmfuervnuqnfiud`.
This directory and `../submission-manager-live` are independent of the existing CRM and older package-app. No CRM storage keys, packages, recovery migrations, or email rules are modified.

## First use

1. In Supabase → Authentication → URL Configuration, set the Site URL to the frontend above, and add that exact URL as an allowed redirect URL. This makes signup confirmation return to the builder. Without this setting, confirmation can still succeed but redirect to the project's old default URL; return to the builder to sign in.
2. Open the builder, create your account, confirm your email and sign in.
3. Create the agency workspace. Coworkers should join this workspace using your single-use invite code from **Settings & team**, rather than creating a separate workspace. Invite codes expire after two days; only workspace admins can create them.
4. In **Models**, import a current JSON roster export or review the included 55-model snapshot from the existing standalone builder. Snapshot import is optional and explicit. It excludes legacy boards and non-New York Mollys. Imports add new models only and never overwrite existing models. They do not import packages, contacts, email history, or browser-only CRM edits.
5. Create models, add image/GIF URLs or upload media, and author reusable text inserts. In a package select a text insert, customize it or disable it. Embed links with `[label](https://example.com/media)`.
6. Build a package, choose photos/videos, reorder models, add your own copy and recipients, save, refresh the preview, and create mailbox drafts.

## Connect Gmail

Use an existing Google OAuth **Web application** client that authorizes this origin, or create one in Google Cloud. Enable Gmail API and configure the consent screen. Add authorized JavaScript origin `https://justinneal907-gif.github.io`. When in testing mode, add the agents as OAuth test users. Production usage may require Google's verification for the requested Gmail scope.

Paste the public client ID in **Settings & team**, save it, then click **Connect Gmail**. Each agent chooses their own account. More than one account can be connected in the same session. Scopes: `gmail.compose` and `userinfo.email`. Google does not offer a draft-only Gmail scope; this app calls only draft creation, never send endpoints.

## Connect Outlook / Microsoft 365

Register an application in Microsoft Entra ID with the appropriate supported account types for your team (organizational and personal accounts if both are needed). Add **Single-page application** redirect URI `https://justinneal907-gif.github.io/CLM-CRM/submission-manager-live/auth.html`. Use delegated `User.Read` and `Mail.ReadWrite` permissions, and obtain tenant admin consent if your organization requires it. Paste its public application/client ID in Settings. Do not enter a client secret.

Connections are short-lived, stored only in memory, and cleared on logout or page reload. Users reconnect when tokens expire. Credentials are never shared through Supabase. Mailbox provider restrictions, consent, and app registration must be completed before real draft creation works. No provider client IDs were supplied during implementation, so no actual mailbox draft was created or tested.

## Draft behavior

- Subject is exactly `Event | Brand`. No date, suffix, model package prefix, model region, or gender is added.
- Opening and closing text are blank until an agent authors them. The application does not generate email body copy.
- Each recipient gets a separate editable draft in each selected mailbox. The application never sends email.
- Every request reserves `(package, version, user, mailbox, recipient)` before contacting a provider. Repeated requests for the same saved version are blocked.
- A dropped connection is marked uncertain; check the mailbox before deliberately saving a new version and retrying. The reservation prevents automatic duplicate creation. Created draft IDs remain in your personal draft history.
- Provider drafts are snapshots; subsequent app edits do not silently overwrite edits made in Gmail or Outlook. Save a new package version to request a new draft.
- HTML and one-recipient EML export are available without OAuth. EML opening behavior depends on your email client.

## Access and data

All application tables have RLS and explicit authenticated grants. Models, templates and packages are shared only inside a workspace. Draft history is visible only to its creator. Server-side version increments plus conditional updates prevent stale edits from overwriting newer work. Model media/text is snapshotted into packages, so roster edits do not repopulate or overwrite selections.

The `clm-media` bucket intentionally serves public portfolio media for email rendering. Anyone with a media URL can view it; do not upload confidential files. Upload permissions are restricted by workspace membership, files are limited to 15 MB, and only supported image/video MIME types are accepted. Removing a model's media reference does not delete the underlying file or break existing package snapshots. No arbitrary HTML is accepted from text editors; text and labels are escaped, and links are HTTPS-only. GIFs use URLs instead of loading binary media into MIME or localStorage.

Use a current CRM export to move browser-only data. The included snapshot is not a live CRM sync. There is no automatic roster selection, campaign rehydration, or recovery job.

## Squarespace

The frontend runs on GitHub Pages; Supabase hosts authentication, the database and media. Supabase is not a general static frontend host. Add this to a Squarespace code/embed block:

```html
<iframe
  src="https://justinneal907-gif.github.io/CLM-CRM/submission-manager-live/"
  title="Chez Les Submission Manager"
  style="width:100%;height:1000px;border:0"
  allow="clipboard-write">
</iframe>
<p><a href="https://justinneal907-gif.github.io/CLM-CRM/submission-manager-live/" target="_blank" rel="noopener">Open Submission Manager in its own window</a></p>
```

Browser privacy settings and OAuth popups may interfere with an iframe. Use the direct app link for sign-in and mailbox connections when needed. Squarespace page protection is optional convenience; Supabase authentication and RLS enforce access independently. No Squarespace page was modified during implementation.

## Development and deployment

```sh
cd submission-manager
npm ci
npm test
npm run dev
npm run build
```

The build writes `../submission-manager-live/`. Commit the source, lockfile, and generated build together to the existing Pages repository. No server secret is shipped to the browser. `src/config.js` contains only the project's public URL and publishable key.

`database/schema.sql` was deployed once as the Supabase migration `clm_submission_manager_initial`. Do not reapply it to an initialized database. Future schema changes should be new reviewed migrations.

Validation: eight core tests cover subject format, blank copy, safe links, text toggles, snapshots, recipients, Unicode MIME/GIFs, and import filtering. Live database transaction tests verify workspace isolation, blocked cross-workspace writes and version increments, with test rows rolled back. Supabase security advisors returned no warnings.
