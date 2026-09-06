# HighLevel import

## What it is

A Seedly add-on that moves a GoHighLevel location into the current Seedly location after a dry-run review. Read-only against GHL. It does not write back.

## Who it is for

Licensed Seedly 5.7.x or 5.8.x owners leaving GoHighLevel.

## What they get

- Sidebar **Import** row
- Connect with a GHL Private Integration Token (read-only scopes)
- Scan, map custom fields, choose entities, pause / resume / cancel
- Roll back that import job
- Plan toggle: **HighLevel import** (`ghl_import`) under Admin → Plans → Add-ons

Pack: `node scripts/pack.mjs ghl-import` → `dist/ghl-import-0.1.0.zip`.

Buyer install: owners use [INSTALL.md](../packages/ghl-import/INSTALL.md). Agents use [AGENTS.md](../packages/ghl-import/AGENTS.md). Also [README](../packages/ghl-import/README.md) and [Factory](factory.md).

## What it is not

- Not a CRM
- Not a live two-way sync
- Does not bring phone numbers, A2P, email domains, Stripe, or live GHL workflows (those come over as drafts)
- Does not import GoSeedly or Dispatch

## Phase

0 — on the shelf.

## Packaging

Zip only (`packages/ghl-import`).

## Depends on

Seedly 5.7.x or 5.8.x. Merges next to Dispatch / GoSeedly if those are installed.
