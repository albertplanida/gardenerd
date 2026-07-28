# GARD-25: Add Container Model and Migration

## Jira

- Issue: `GARD-25`
- Type: Subtask
- Parent story: `GARD-3` Create Container Records
- Status at review: Ready

## Task

Add the Container model with name, created at, and updated at fields.

## Product Context

A Container is a manually created record representing a physical place where a Plant can be grown.

In V1, a Container includes only:

- Name

Examples:

- Pot 1
- Pot 2
- Pot 3
- Pot 4

V1 should not require these Container fields:

- Size
- Material
- Drainage
- Location
- Soil type

Those fields may be added later and should not be included in this subtask.

## Acceptance Criteria

- A `Container` model exists.
- The model has a required `name` field.
- The model has `created_at` and `updated_at` timestamp fields.
- A database migration creates the Container table.
- Backend tests cover the model behavior added by this task.

## Technical Context

The backend is a Django 6 project using:

- `pytest`
- `pytest-django`
- `strawberry-graphql-django`
- PostgreSQL in Docker
- SQLite fallback when PostgreSQL environment variables are absent

Current backend state at review:

- No domain Django app exists yet.
- No existing application models or migrations exist.
- GraphQL currently exposes only a health query.
- Existing backend tests are in `backend/tests/`.

## TDD Plan

1. Add a failing backend model test first.
2. Create the first domain Django app if one still does not exist.
3. Register the app in `INSTALLED_APPS`.
4. Add the `Container` model.
5. Generate and inspect the migration.
6. Run the backend test suite.
7. Verify there are no missing migrations.

## Expected Model Shape

Recommended minimal Django model:

```python
class Container(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
```

## Test Expectations

Model tests should verify:

- A Container can be created with a name.
- `created_at` is populated on create.
- `updated_at` is populated on create.
- `str(container)` returns the Container name.

## Out Of Scope

- GraphQL schema, queries, and mutations.
- Frontend list or form UI.
- Growing Trial relationships.
- Active Growing Trial uniqueness validation.
- Container metadata such as size, material, drainage, location, or soil type.
