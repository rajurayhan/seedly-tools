# SeedlyPin (Seedly add-on)

Install this into a licensed **Seedly 5.7.x or 5.8.x** folder. Staff drop Pins inside the CRM. Tickets and screenshots stay in their Convex.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)

## Install

1. Unzip this folder somewhere you can find it.
2. Open a terminal in **your Seedly CRM folder** (the one that already has `apps`, `convex`, and `package.json`).
3. Run:

```
node /path/to/seedly-pin-0.1.0/bin/install.mjs --seedly .
```

The installer copies add-on files, merges them next to Dispatch / other add-ons, and inserts the Drop Pin control plus a Pins tab in Agency Settings. It never deploys.

4. Then, from the Seedly folder:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

5. Deploy the website as you usually do. If you changed the backend, also run `npx convex deploy` from the Seedly folder (that is a live deploy — only do it when you mean to).

## After install

- Sign in as an agency owner. Open **Settings → Pins**. Turn SeedlyPin on. Choose who can drop a pin and who can triage.
- Open a location. Use **Drop Pin** (bottom-right). Pins appear under **Pins** in the location sidebar.
- If you also have SeedlyMCP, run that zip’s `bin/sync-tools.mjs` after install so Cursor / Claude get pin tools.

## Uninstall

From the Seedly folder:

```
node /path/to/seedly-pin-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Then publish again. Empty leftover `seedlyPin*` tables in Convex if you are removing this for good.
