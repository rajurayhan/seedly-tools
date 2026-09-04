# HighLevel import (Seedly add-on)

Install this into a licensed **Seedly 5.8.x** folder. It adds a sidebar **Import** row so a location can move a GoHighLevel book in after a dry-run review.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)

## Install

1. Unzip this folder somewhere you can find it.
2. Open a terminal in **your Seedly CRM folder** (the one that already has `apps`, `convex`, and `package.json`).
3. Run:

```
node /path/to/ghl-import-0.1.0/bin/install.mjs --seedly .
```

Use the real path to the unzipped folder. The installer copies the add-on files, merges them next to Dispatch / GoSeedly if those are already installed, and records the add-on in `.modules.json`. It never deploys.

4. Then, from the Seedly folder:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

5. Deploy the website as you usually do. If you changed the backend, also run `npx convex deploy` from the Seedly folder (that is a live deploy - only do it when you mean to).

## After install

- Turn **HighLevel import** on for the client plan (Admin → Plans → Add-ons).
- Open a location and use the **Import** item in the sidebar.
- Use a GoHighLevel Private Integration Token with **read-only** scopes. Do not tick Write.

## Uninstall

From the Seedly folder:

```
node /path/to/ghl-import-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Empty leftover `ghl*` tables in Convex before the next backend deploy if you are removing the add-on for good.

## Health check

```
node /path/to/ghl-import-0.1.0/bin/doctor.mjs --seedly .
```
