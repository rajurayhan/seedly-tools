# Seedly Docker (self-host pack)

Install this into a licensed **Seedly 5.7.x or 5.8.x** folder. It adds a local Docker Compose stack so you can run Next.js and a self-hosted Convex backend on your computer. You do not need Convex Cloud for this path.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)

There is no Admin → Plans switch. After install you start the stack with `make -f docker.mk docker-up`.

## Install

1. Unzip this folder somewhere you can find it.
2. Open a terminal in **your Seedly CRM folder** (the one that already has `apps`, `convex`, and `package.json`).
3. Run:

```
node /path/to/seedly-docker-0.1.0/bin/install.mjs --seedly .
```

The installer copies compose files and a small URL helper, then patches a few Seedly files so the app can reach Convex inside Docker and so localhost:3100 cookies do not collide with another CRM on :3000. It never deploys.

```
node /path/to/seedly-docker-0.1.0/bin/install.mjs --seedly .
node /path/to/seedly-docker-0.1.0/bin/install.mjs --seedly . --dry-run
```

4. Start the stack (see INSTALL.md). Sign-up is disabled — run `make -f docker.mk docker-seed` for demo logins.

## Uninstall

```
node /path/to/seedly-docker-0.1.0/bin/uninstall.mjs --seedly . --yes
```

That removes the copied files and puts the patched Seedly files back.

## Health check

```
node /path/to/seedly-docker-0.1.0/bin/doctor.mjs --seedly .
```
