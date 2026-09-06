# Install a Seedly add-on (for owners)

This page is for a licensed **Seedly 5.7 or 5.8** owner who is not a programmer. You already have a working CRM folder. An add-on is a zip you drop into that folder. It is not a second CRM.

Each zip also has its own owner guide. Start there if you already know which add-on you bought:

- [SeedlyMCP](../packages/seedly-mcp/INSTALL.md)
- [HighLevel import](../packages/ghl-import/INSTALL.md)
- [Seedly Docker](../packages/seedly-docker/INSTALL.md)
- [Seedly Coolify](../packages/seedly-coolify/INSTALL.md)
- [Login as location user](../packages/login-as/INSTALL.md)
- [SeedlyPin](../packages/seedly-pin/INSTALL.md)

If an assistant (Cursor, Claude) is doing the typing, send them [install-agents.md](install-agents.md).

## What you need

- Seedly 5.7 or 5.8 already set up (the folder that has `apps`, `convex`, and `package.json`)
- The unzipped add-on folder
- A way to open Terminal (Mac) or Command Prompt / PowerShell (Windows)
- Your usual website deploy (the same one you used when you first launched)

You do **not** need this `seedly-tools` repo. Buyers never clone it.

## The same three steps for every zip

1. Unzip the add-on somewhere you can find it.
2. In Terminal, go to **your Seedly folder** (not the unzipped add-on):

```
node /path/to/the-unzipped-addon/bin/install.mjs --seedly .
```

Replace `/path/to/the-unzipped-addon` with the real folder. On a Mac you can drag that folder onto the Terminal window after you type `node ` and then add `/bin/install.mjs --seedly .`

You should see a line like `Installed … into …`. That program **does not** publish your live site.

3. Still in the Seedly folder, install packages and then publish the way you already do:

```
npx pnpm install
```

If the add-on touched the backend (most do), also run `npx convex deploy` when you mean to update the live database side. That is a live publish. Only do it when you are ready.

Then follow that zip’s install guide. Some add-ons also need a switch in **Admin → Plans → Add-ons**. Docker and Coolify do not.

## If something looks wrong

From the Seedly folder:

```
node /path/to/the-unzipped-addon/bin/doctor.mjs --seedly .
```

`ok` lines mean that piece is in place. `ERR` lines say what is missing. Do not edit files by hand to “fix” an install. Run uninstall, then install again.

## Remove an add-on

```
node /path/to/the-unzipped-addon/bin/uninstall.mjs --seedly . --yes
```

Then publish the website (and Convex if the backend changed) the same way you did for install.

## Words used here

- **Seedly folder** — the copy of the CRM you already run. It has `apps`, `convex`, and `package.json`.
- **Add-on zip** — extra features we packed for you. It is not Seedly itself.
- **Deploy / publish** — making the live website (and sometimes the backend) match the folder on your computer.
- **Plan toggle** — the switch in Admin → Plans that turns the add-on on for a client plan.
