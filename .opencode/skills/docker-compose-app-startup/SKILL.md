---
name: docker-compose-app-startup
description: Use when the user asks to run, start, verify, or troubleshoot the full app with Docker Compose.
---

# Docker Compose App Startup

Use this skill when the user asks to run the full application locally, especially when both frontend and backend services are needed.

## Startup Workflow

- Read `README.md` and `docker-compose.yml` for the documented startup path.
- Check whether required root `.env` values exist.
- If `.env` is missing and `.env.example` exists, create a local development `.env` only when safe and non-secret values are acceptable.
- Start the stack with:

```bash
docker compose up -d --build
```

- If Docker is unavailable, report the daemon/socket error clearly and use direct local server commands only as a fallback.

## Verification

- Run `docker compose ps` to confirm service status.
- Verify published frontend routes with `curl -I`, typically:

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3000/containers
```

- Verify API proxy routes if relevant, such as `/graphql`.
- If containers fail, inspect logs with `docker compose logs <service>`.

## Port Conflicts

- If direct local servers are running, stop them before starting Docker Compose.
- Avoid killing unrelated user processes.
- Use targeted process patterns when stopping fallback servers.

## Final Response

Include:

- The app URL the user should open.
- Which services are running.
- Any local `.env` created or changed.
- Any failures or follow-up commands needed.

## Safety Notes

- Never put real secrets into `.env`.
- Do not commit local `.env` files.
- Do not run destructive Docker cleanup commands unless the user explicitly asks.
