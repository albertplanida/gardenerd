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
- `DJANGO_STORAGE_BACKEND` (`filesystem` for local Compose)

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
- Journal photo uploads: `http://<host-ip>:3000/api/journal-events/<id>/photos/`
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

Local Journal photos are stored under `data/media/journal-events/`. The bind
mount is outside the backend container, so both sanitized full-size images and
thumbnails survive image rebuilds and container replacement.

## Cloudflare R2 Storage

Staging and production use `DJANGO_STORAGE_BACKEND=r2` with separate private R2
buckets. Configure these backend-only runtime variables in each environment:

```dotenv
DJANGO_STORAGE_BACKEND=r2
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key-id>
R2_SECRET_ACCESS_KEY=<secret-access-key>
R2_BUCKET_NAME=<environment-specific-private-bucket>
R2_SIGNED_URL_EXPIRY_SECONDS=3600
```

Create one bucket for staging and another for production. Keep public bucket
access disabled, grant the application token object read/write/delete access
only to its environment's bucket, and never expose these values as frontend
variables or image build arguments. Photo URLs are generated on demand and
signed for one hour; they are not stored in PostgreSQL.

Enable R2 object versioning or an equivalent backup policy appropriate to the
deployment. Database backups and object backups must be retained together,
because PostgreSQL stores the object keys while R2 stores the image data.

### Isolated R2 Test Stack

The R2 test stack runs alongside the filesystem stack with its own PostgreSQL
volume and no local media mount. Configure the ignored `.env.r2-test` from
`.env.r2-test.example`, then run:

```bash
docker compose --env-file .env.r2-test -f docker-compose.r2-test.yml up -d --build
```

Open `http://localhost:3002`. Stop the stack without removing its database:

```bash
docker compose --env-file .env.r2-test -f docker-compose.r2-test.yml down
```

Add `--volumes` only when the isolated test database should also be deleted.
R2 objects are not removed by Compose teardown; delete them through the
application or rely on the test bucket's lifecycle policy.

## Growing Trial Lifecycle

`GrowingTrial.objects.create_planned()` is the normal application creation path,
and trials created through the application always begin in the planned state.
The database constrains stored statuses to the valid lifecycle values.

Bulk operations and raw SQL bypass the initial-status domain rule, but they do
not bypass the valid-status database constraint. If a future lifecycle requires
an insert-only status rule to be a hard database requirement, revisit this
enforcement model rather than relying solely on the creation manager.
