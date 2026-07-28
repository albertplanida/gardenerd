# GARD-3: Create Container Records

## Jira

- Issue: `GARD-3`
- Type: Story
- Status at review: In Progress
- Parent epic: `GARD-1` Gardenerd V1 Foundation

## Story

As a gardener, I want to create Containers so I can track where each Growing Trial happens.

## Product Context

Gardenerd V1 focuses on simple container gardening. A Container is a manually created record representing a physical place where a Plant can be grown.

Examples:

- Pot 1
- Pot 2
- Pot 3
- Pot 4

In V1, Containers are intentionally simple and include only a name. Details such as size, material, drainage, location, and soil type are explicitly deferred.

## Acceptance Criteria

- User can create a Container with a name.
- User can view Containers.
- User can edit Containers.

## Scope

Implement Container records end to end across backend and frontend.

Included work:

- Add Container model.
- Add Container database migration.
- Add Container GraphQL type.
- Add Container list query.
- Add Container create mutation.
- Add Container edit mutation.
- Add Container list UI.
- Add Container create/edit UI.
- Add backend tests.
- Add frontend tests where useful.

## Subtasks

- `GARD-25`: Add Container model and migration
- `GARD-26`: Add Container GraphQL operations
- `GARD-24`: Build Container list and form UI
- `GARD-27`: Test Container records
- `GARD-70`: Release

## Data Requirements

Container fields:

- ID
- Name
- Created at
- Updated at

## Relationship Context

- A Container can be used in many Growing Trials over time.
- Only one active Growing Trial should use a Container at a time.
- A Growing Trial links one Plant to one Container.
- Version one supports only one Plant per Container per Growing Trial.

## Implementation Notes

- Backend is Django 6 with pytest and strawberry GraphQL.
- No user accounts or login are in scope for V1.
- PostgreSQL is the target runtime database; local SQLite fallback exists.
- Keep the first implementation minimal and aligned with the explicit V1 fields.
