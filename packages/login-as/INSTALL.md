# Login as location user — install guide (for owners)

This guide is for a licensed **Seedly 5.8** owner. You do not need to be a programmer. If an assistant is doing the install, give them [AGENTS.md](AGENTS.md).

This zip lets an agency owner open a location as that location’s user. A banner shows who you are acting as. This zip is not a CRM.

## Before you start

- Seedly 5.8 is already running. You know the **Seedly folder** (`apps`, `convex`, and `package.json`).
- This add-on is unzipped (`login-as-0.1.0` with a `bin` folder inside).
- You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

In Terminal, go to the **Seedly folder** (not the unzipped add-on):

```
node /path/to/login-as-0.1.0/bin/install.mjs --seedly .
```

On a Mac: type `node `, drag the unzipped folder onto the window, then type `/bin/install.mjs --seedly .` and press Return.

**What you should see:** `Installed login-as`. That only copies files and adds a few hooks. It does not publish the live site. If you see `login-as seam gap`, this Seedly build does not have the expected auth or dashboard files — stop and do not edit files by hand.

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

1. **Admin → Plans** → edit the plan → under **Add-ons** turn on **Login as location user** → save.
2. Sign in as an **agency owner**. Turn on two-factor authentication on **your** account first.
3. Open the account menu (your avatar) → **Login as location user**.
4. Search for a user in your agency and select them. The bar at the top says who you are acting as. Use **switch to my account** or sign out to stop.

## Check / remove

```
node /path/to/login-as-0.1.0/bin/doctor.mjs --seedly .
node /path/to/login-as-0.1.0/bin/uninstall.mjs --seedly . --yes
```

You want `ok` on every doctor line. After uninstall, publish again.
