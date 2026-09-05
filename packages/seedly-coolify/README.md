# Seedly Coolify (VPS self-host pack)

Install this into a licensed **Seedly 5.8.x** folder. It includes the local Docker files plus a Coolify compose file so you can run Next.js and self-hosted Convex on a VPS. You do not need Convex Cloud or Vercel for this path.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)

There is no Admin → Plans switch. After install, point a Coolify Docker Compose resource at `compose.coolify.yaml`.

This zip already includes the local Docker runtime. You do not need `seedly-docker` as well.

## Install

```
node /path/to/seedly-coolify-0.1.0/bin/install.mjs --seedly .
```

Then follow INSTALL.md for the Coolify project, HTTPS names, and first seed.

## Uninstall

```
node /path/to/seedly-coolify-0.1.0/bin/uninstall.mjs --seedly . --yes
```

## Health check

```
node /path/to/seedly-coolify-0.1.0/bin/doctor.mjs --seedly .
```
