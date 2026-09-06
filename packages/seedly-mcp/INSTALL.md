# SeedlyMCP — install guide (for owners)

This guide is for a licensed **Seedly 5.7 or 5.8** owner. You do not need to be a programmer. If Cursor or Claude is doing the install for you, give them [AGENTS.md](AGENTS.md) instead.

SeedlyMCP lets an assistant on **your** computer (or Claude on the web) read and update **your** Seedly. Your contact book never goes to Sulus. This zip is not a CRM and will not run by itself.

## What you will have when you are done

- A **SeedlyMCP** switch under Admin → Plans → Add-ons
- An **MCP** item in a location’s sidebar with copy-paste setup
- Cursor / Claude Desktop talking to your Seedly with an API key you create
- Optional: Claude on the web signing in on your Seedly website

The assistant can look up contacts, conversations, calendars, tasks, deals, invoices, and estimates. It can create contacts, tasks, deals, and appointments. It **cannot** send texts, emails, invoices, or estimates. That is on purpose.

## Before you start

1. Seedly 5.7 or 5.8 is already running. You know the folder on your computer that has `apps`, `convex`, and `package.json`. That is the **Seedly folder**.
2. You have this add-on unzipped. Inside it you should see `bin`, `README.md`, and `INSTALL.md` (this file).
3. You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

Open Terminal. Go to your **Seedly folder** (not the unzipped add-on). Then run one line. Swap in the real path to the unzipped folder:

```
node /path/to/seedly-mcp-0.1.0/bin/install.mjs --seedly .
```

On a Mac: type `node `, drag the unzipped `seedly-mcp-0.1.0` folder onto the window, then type `/bin/install.mjs --seedly .` and press Return.

**What you should see:** a line that starts with `Installed seedly-mcp`. That only copies files onto your computer. It does **not** change the live website yet.

If you see `Not a Seedly checkout` you are in the wrong folder. Go to the folder that has both `apps` and `convex`.

If you see `Refusing` or a version error, this zip is only for Seedly 5.7 or 5.8. Do not continue on 5.6 or 5.9.

## 2. Refresh packages

Still in the Seedly folder:

```
npx pnpm install
```

This only updates packages on your computer. It does not publish.

Optional check (catches typing errors before you publish):

```
npx pnpm --filter @seedly-crm/web typecheck
```

If that prints errors, stop and send them to whoever helps you. Do not publish.

## 3. Publish

Do this the same way you published Seedly the first time.

1. Publish the **website** as you usually do (Vercel or your host).
2. This add-on also changes the **backend**. When you are ready for the live backend to match, run this from the Seedly folder:

```
npx convex deploy
```

That updates the live database side. Only run it when you mean to. A vague “go ahead” from earlier in a chat does not count — say yes to this step on purpose.

## 4. Turn it on

1. Sign in as an agency admin.
2. Open **Admin → Plans**.
3. Edit the plan your location uses.
4. Under **Add-ons**, turn on **SeedlyMCP**.
5. Save.

Open a location. You should see **MCP** in the sidebar. That page repeats the Cursor and Claude steps with your real website address.

## 5. Connect Cursor or Claude on your computer

This path does **not** use a Sulus login. The assistant talks straight to your Seedly.

1. In Seedly: **Settings → Integrations → API Keys → Create Key**.
2. Copy the key **once**. It looks like `sk_live_…`. Do not paste it into Slack or email.
3. In Cursor: open MCP / Integrations settings and add a server. Use your real paths and key:

```json
{
  "mcpServers": {
    "seedly": {
      "command": "node",
      "args": ["/FULL/PATH/TO/YOUR/SEEDLY/packages/seedly-mcp/server.mjs"],
      "env": {
        "SEEDLY_BASE_URL": "https://YOUR_DEPLOYMENT.convex.site",
        "SEEDLY_API_KEY": "sk_live_PASTE_ONCE"
      }
    }
  }
}
```

- `args` is the `server.mjs` file **inside your Seedly folder**.
- `SEEDLY_BASE_URL` is your Convex site address (ends in `.convex.site`), not the login page.
- Restart Cursor after you save.

The key stays in that setting. This page will not show it again.

## 6. Connect Claude on the web (optional)

Claude in a browser cannot see a program on your laptop. It calls **your public Seedly website**.

1. Finish step 3 (website + backend published).
2. In Claude: **Settings → Connectors → Add custom connector**.
3. URL:

```
https://YOUR_SEEDLY_LOGIN_SITE/seedly-mcp
```

Use the same https address people use to open your CRM, plus `/seedly-mcp`.
4. Claude will send you to **your** Seedly sign-in. Sign in and click **Allow**.
5. Claude’s return address that we allow is `https://claude.ai/api/mcp/auth_callback`.

If that sign-in cannot start, add the connector with a request header instead:

`Authorization: Bearer sk_live_…`

(that is Claude’s backup “static header” option). Create that key the same way as in step 5.

## After you change the public API

The assistant’s tool list is built from a file in **your Seedly folder** named `docs/openapi.yaml`. That is the written list of public API doors. It is not inside this zip.

When you (or an assistant) add, remove, rename, or change a public `/api/v1` route or its fields, update that yaml **in the same sitting**. Then, from your Seedly folder:

```
node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .
node /path/to/seedly-mcp-0.1.0/bin/doctor.mjs --seedly .
```

Publish the website afterward so Claude on the web sees the new list. Restart Cursor if you use the program on your computer.

A Seedly update may already refresh the yaml. Still run those two commands afterward.

You do **not** need to add send-message, invoice money, or webhook rows. Those stay off even if they appear in the yaml.

If doctor **warns** that a tool used a fallback, the yaml is missing that door. Add it to the yaml (and the live API) or ignore the warn if you did not mean to ship that door.

Longer version: [OPENAPI.md](OPENAPI.md).

## Check that install stuck

From the Seedly folder:

```
node /path/to/seedly-mcp-0.1.0/bin/doctor.mjs --seedly .
```

You want `ok` on every line. A **warn** about a fallback tool is OK. If you see `ERR`, copy the whole output and stop. After an API change, run `sync-tools` first (see above).

## Remove SeedlyMCP

From the Seedly folder:

```
node /path/to/seedly-mcp-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Then publish the website again. If you had run `npx convex deploy` for the install, you will need it again after uninstall (only when you mean to).

Also: **Settings → Integrations → API Keys** — revoke keys named like `SeedlyMCP (Claude)`. Ask whoever handles Convex to empty leftover `seedlyMcp*` tables before the next backend publish if you are removing this for good.

## What this is not

- Not a Sulus-hosted assistant that can see every customer’s book
- Not a chat box inside the CRM (that is a later add-on)
- Not permission to send invoices or texts
