# Chez Les Mannequins — Standalone Client Package App

This app is intentionally independent of the CRM.

## Files
- `admin.html` — private package builder / local roster manager
- `index.html` — client-facing package viewer
- `roster.js` — snapshot of the agency roster at build time
- `CNAME` — intended production hostname

## Intended production URLs
- Builder: https://packages.chezlesmannequins.com/admin.html
- Client package: https://packages.chezlesmannequins.com/#p=...

## How sharing works
The builder serializes only the selected package data into the URL fragment. Modern browsers gzip the payload before Base64URL encoding it. The client page decodes the package locally. No CRM, database, login, or API is required to open a package.

Because URL fragments are not sent in HTTP requests, the package payload is not transmitted to the static host. Anyone who possesses a package URL can view it, so links should still be treated as private.

## Roster behavior
The initial roster is a copied snapshot and does not read from the CRM at runtime. Edits made in the builder are stored in that browser's localStorage. The Manage Roster dialog supports JSON export/import for backup or moving the roster to another browser.

## Deployment note
The current CLM-CRM repository is already its own GitHub Pages application. For a true custom subdomain, deploy this `package-app` directory as the root of a separate static hosting target and map `packages.chezlesmannequins.com` to it. Do not repoint the CRM's existing Pages site.
