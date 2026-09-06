# Login as location user (Seedly add-on)

Install this into a licensed **Seedly 5.7.x or 5.8.x** folder. Agency owners can open a location as that location’s user without sharing a password.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)

## Install

1. Unzip this folder somewhere you can find it.
2. Open a terminal in **your Seedly CRM folder** (the one that already has `apps`, `convex`, and `package.json`).
3. Run:

```
node /path/to/login-as-0.1.0/bin/install.mjs --seedly .
```

The installer copies add-on files, merges them next to Dispatch / other add-ons, and inserts overlay + banner hooks into your Seedly checkout. It never deploys.

4. Then, from the Seedly folder:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

5. Deploy the website as you usually do. If you changed the backend, also run `npx convex deploy` from the Seedly folder (that is a live deploy — only do it when you mean to).

## After install

- Turn **Login as location user** on for the client plan (Admin → Plans → Add-ons).
- Sign in as an agency owner. Enroll two-factor authentication on **your** account.
- Open the account menu → **Login as location user**, pick a user in your agency, and use the banner to switch back.

## Uninstall

From the Seedly folder:

```
node /path/to/login-as-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Then publish again. Empty leftover `loginAs*` tables in Convex if you are removing this for good.
