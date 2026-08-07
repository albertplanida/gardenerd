# Gardenerd

Local-network gardening app deployed with Docker Compose.

## Runtime Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`

For a Docker host at `192.168.1.50`, use:

```dotenv
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,192.168.1.50
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://192.168.1.50:3000
```

Protect the runtime environment file:

```bash
chmod 600 .env
```

## Start

```bash
docker compose up -d --build
```

Open:

```text
http://<host-ip>:3000
```

## Django Admin

Create an admin user:

```bash
docker compose exec backend uv run python manage.py createsuperuser
```

Open:

```text
http://<host-ip>:3000/admin/
```

## Services

Only the frontend is published to the local network.

- Frontend: `http://<host-ip>:3000`
- Django admin: `http://<host-ip>:3000/admin/`
- GraphQL: `http://<host-ip>:3000/graphql`
- Backend container: internal Docker network only
- PostgreSQL container: internal Docker network only

## GraphQL Auth Posture

The GraphQL endpoint is currently CSRF-exempt because planned authentication is
bearer-token based, not cookie/session based. When token auth is added, only send
`Authorization` headers to same-origin `/graphql` or explicitly allowlisted API
origins. If cookie/session auth is introduced later, revisit CSRF protection
before enabling browser-callable mutations.

## Persistent Data

Runtime data is stored on the host:

```text
data/postgres/
data/media/
```

These directories should be backed up.
