# HighLevel import — install guide (for owners)

This guide is for a licensed **Seedly 5.7 or 5.8** owner. You do not need to be a programmer. If an assistant is doing the install, give them [AGENTS.md](AGENTS.md).

This zip adds a sidebar **Import** row so a location can move a GoHighLevel book in after a dry-run review. It reads from HighLevel. It does not write back. This zip is not a CRM.

## Before you start

- Seedly 5.7 or 5.8 is already running. You know the **Seedly folder** (`apps`, `convex`, and `package.json`).
- This add-on is unzipped (`ghl-import-0.1.0` with a `bin` folder inside).
- You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

In Terminal, go to the **Seedly folder** (not the unzipped add-on):

```
node /path/to/ghl-import-0.1.0/bin/install.mjs --seedly .
```

On a Mac: type `node `, drag the unzipped folder onto the window, then type `/bin/install.mjs --seedly .` and press Return.

**What you should see:** `Installed ghl-import`. That only copies files. It does not publish the live site.

## 2. Refresh packages

Still in the Seedly folder:

```
npx pnpm install
```

Optional check before you publish:

```
npx pnpm --filter @seedly-crm/web typecheck
```

## 3. Publish

Publish the website the way you already do. This add-on also changes the backend. When you mean to update the live backend, run `npx convex deploy` from the Seedly folder. That is a live publish — only do it when you are ready.

## 4. Turn it on and import

1. **Admin → Plans** → edit the plan → under **Add-ons** turn on **HighLevel import** → save.
2. Open a location. Use the **Import** item in the sidebar.
3. Use a GoHighLevel **Private Integration Token** with **read-only** scopes. Do not tick Write.

## Check / remove

```
node /path/to/ghl-import-0.1.0/bin/doctor.mjs --seedly .
node /path/to/ghl-import-0.1.0/bin/uninstall.mjs --seedly . --yes
```

After uninstall, publish again. Empty leftover `ghl*` tables in Convex before the next backend publish if you are removing this for good.

Shared owner steps for any zip: [../../docs/install-owners.md](../../docs/install-owners.md).
