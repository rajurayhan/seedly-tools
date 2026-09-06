# SeedlyPin — install guide (for owners)

This guide is for a licensed **Seedly 5.7 or 5.8** owner. You do not need to be a programmer. If an assistant is doing the install, give them [AGENTS.md](AGENTS.md).

This zip lets staff drop a Pin on the page they are looking at. Screenshots and diagnostics stay in your Seedly. This zip is not a CRM.

## Before you start

- Seedly 5.7 or 5.8 is already running. You know the **Seedly folder** (`apps`, `convex`, and `package.json`).
- This add-on is unzipped (`seedly-pin-0.1.0` with a `bin` folder inside).
- You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

In Terminal, go to the **Seedly folder** (not the unzipped add-on):

```
node /path/to/seedly-pin-0.1.0/bin/install.mjs --seedly .
```

On a Mac: type `node `, drag the unzipped folder onto the window, then type `/bin/install.mjs --seedly .` and press Return.

**What you should see:** `Installed seedly-pin`. That only copies files and adds a few hooks. It does not publish the live site. If you see `seedly-pin seam gap`, this Seedly build does not have the expected dashboard or settings files — stop and do not edit files by hand.

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

## 4. Turn it on

1. Sign in as an **agency owner**.
2. Open **Settings → Pins**.
3. Turn **SeedlyPin** on. Choose which roles can drop a pin and which roles can triage.
4. Open a location. Use **Drop Pin**. Open **Pins** in the sidebar to assign and close tickets.

There is no switch under Admin → Plans. This is agency-wide.

If Cursor or Claude should read pins, install **SeedlyMCP** as well, then run that zip’s `bin/sync-tools.mjs`.

## Check / remove

```
node /path/to/seedly-pin-0.1.0/bin/doctor.mjs --seedly .
node /path/to/seedly-pin-0.1.0/bin/uninstall.mjs --seedly . --yes
```

You want `ok` on every doctor line. After uninstall, publish again.
