---
name: django-model-tdd-workflow
description: Use when adding a Django model in Gardenerd: inspect existing apps, write a failing pytest model test first, add or reuse a Django app, create migrations, migrate locally with SQLite, and verify tests/lint/migration state.
---

# Django Model TDD Workflow

Use this skill when implementing a new Django model or changing model fields in the Gardenerd backend.

This workflow is intentionally model-focused. Do not add GraphQL operations, frontend UI, admin screens, serializers, or unrelated behavior unless the active Jira ticket or PRD explicitly includes them.

## Core Rule

Start with the smallest correct model change.

Do not create a new Django app by default. First inspect the backend and decide whether the model belongs in an existing app.

Create a new Django app only when:

- No appropriate domain app exists.
- The ticket or PRD names a new domain boundary.
- Existing apps would become incoherent if the model were added there.

## Workflow

1. Read the active ticket summary PRD file when present, such as `[ticket-id].prd.md`.
2. Read relevant sections of `PRD.md`.
3. Inspect existing Django apps under `backend/apps/`.
4. Decide whether to reuse an existing app or create a new app.
5. Confirm the exact model fields, defaults, nullability, relationships, and out-of-scope fields.
6. Confirm validation scope for direct ORM saves before adding custom `clean()` or `save()` behavior.
7. Add a failing pytest model test first.
8. Run the focused test and confirm it fails for the expected reason.
9. Add or update the model.
10. Register a new app in `INSTALLED_APPS` only if a new app was created.
11. Run the focused test again.
12. Generate migrations.
13. Inspect the generated migration before applying it.
14. Apply migrations locally using SQLite during normal coding.
15. Run full backend verification.

## Validation Scope Questions

Ask one question at a time when the ticket or PRD does not specify:

- Whether the model should normalize user-entered strings.
- Whether blank or whitespace-only values are invalid.
- Maximum lengths for text fields.
- Whether validation must run only at GraphQL/form boundaries or on every model save.
- Whether existing rows could violate the new constraints and need a data migration.

Do not override `save()` by default. Add model-level save validation only when the requirement explicitly covers direct ORM/admin writes or the user confirms that scope.

## Model Validation Pattern

When model-level validation is required:

- Put validation constants near the model.
- Normalize before Django field validators run when normalized values determine validity.
- Call `full_clean()` from `save()` so direct ORM writes are checked.
- If `save(update_fields=...)` is used, ensure normalized fields are included in `update_fields` before saving.
- Use explicit domain messages for expected validation failures.
- Add tests for direct ORM creates and edits that prove invalid data is rejected and valid data is normalized.

## Local Development Database

For normal coding, use `backend/.env` with SQLite fallback.

The backend uses SQLite when `POSTGRES_HOST` is absent.

Do not require Docker/PostgreSQL for ordinary model TDD unless the ticket specifically depends on PostgreSQL-only behavior.

Use Docker/PostgreSQL near the end of a coding session or release validation.

## Creating A New App

If a new app is needed, create the minimal app package:

```text
backend/apps/<app_name>/
  __init__.py
  apps.py
```

Example `apps.py`:

```python
from django.apps import AppConfig


class ContainersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.containers'
```

Register the app in `backend/gardenerd/settings.py`:

```python
INSTALLED_APPS = [
    'strawberry.django',
    'apps.containers',
    ...
]
```

Run:

```bash
uv run python manage.py check
```

## Model Test Pattern

Create or update a focused test file under `backend/tests/`.

Example:

```python
import pytest

from apps.containers.models import Container


@pytest.mark.django_db
def test_container_can_be_created_with_name():
    container = Container.objects.create(name='Pot 1')

    assert container.name == 'Pot 1'
    assert container.created_at is not None
    assert container.updated_at is not None


@pytest.mark.django_db
def test_container_string_representation_is_name():
    container = Container.objects.create(name='Pot 2')

    assert str(container) == 'Pot 2'
```

Run the focused test before implementing the model:

```bash
uv run pytest tests/test_container_model.py
```

The expected first failure should be directly related to the missing model or missing behavior.

## Model Pattern

Keep model definitions minimal and explicit.

Example:

```python
from django.db import models


class Container(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
```

Only add `Meta`, indexes, constraints, custom validation, relationships, or helper methods when the ticket/PRD requires them.

## Migration Workflow

Generate the migration for the relevant app:

```bash
uv run python manage.py makemigrations <app_name>
```

Inspect the generated migration before applying it.

Apply migrations locally:

```bash
uv run python manage.py migrate
```

Verify no model changes are left un-migrated:

```bash
uv run python manage.py makemigrations --check --dry-run
```

## Verification

Run:

```bash
uv run pytest
uv run python manage.py makemigrations --check --dry-run
uv run ruff check .
```

For a focused iteration, run the relevant test module first, then the full suite after the migration is generated.

## Completion Checklist

A Django model task is complete when:

- The model is implemented in the correct app.
- A new app is created and registered only if needed.
- Model tests cover the required behavior.
- Model validation scope is explicit when custom validation was added.
- Direct ORM save behavior is tested when every-save validation is required.
- Migrations are generated and inspected.
- Local SQLite migration succeeds.
- Full backend tests pass.
- `makemigrations --check --dry-run` reports no changes.
- Ruff passes.
- No out-of-scope GraphQL, UI, or unrelated changes were added.
