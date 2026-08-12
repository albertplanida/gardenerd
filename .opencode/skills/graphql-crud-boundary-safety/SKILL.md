---
name: graphql-crud-boundary-safety
description: Use when adding or changing Gardenerd GraphQL CRUD queries or mutations, especially create/edit/list operations that accept user input or return collections.
---

# GraphQL CRUD Boundary Safety

Use this skill when implementing or reviewing GraphQL CRUD operations in the Gardenerd backend.

The goal is to prevent frontend-only validation, unbounded list queries, unsafe error messages, and direct GraphQL bypasses.

## Core Rule

Treat the GraphQL API as a public boundary even when the current app is local-network only.

Do not rely on the frontend to enforce data integrity.

## Mutation Requirements

- Normalize user-controlled strings server-side before persistence.
- Trim leading and trailing whitespace when the field is plain text entered by a user.
- Reject blank or whitespace-only required strings.
- Enforce model and product maximum lengths explicitly.
- Validate before writing so failed creates do not create rows.
- For edits, preserve the existing row unchanged when validation fails.
- Return stable, user-safe errors. Do not expose raw framework messages when a domain message is available.
- Preserve existing not-found behavior unless the ticket explicitly changes it.

## Collection Query Requirements

- Never return an unbounded collection from GraphQL.
- Use pagination or a server-enforced capped limit.
- Preserve deterministic ordering.
- Reject invalid pagination arguments unless the PRD explicitly says to clamp them.
- If using offset pagination, define the default page size and maximum caller-provided limit.
- Avoid loading extra large text fields beyond the bounded page size just to detect pagination metadata.

## Clarifying Questions

Ask one question at a time when the ticket or PRD does not specify:

- Required versus optional fields.
- Whitespace normalization rules.
- Maximum lengths for user-controlled text.
- Whether validation belongs in GraphQL only, the model, or both.
- Whether direct ORM saves must validate automatically.
- Pagination style: fixed limit, offset pagination, cursor pagination, or capped caller limit.
- Default page size and maximum page size.
- Error contract: plain GraphQL errors, typed results, or field-level error objects.
- Ordering and create/edit behavior on paginated lists.

## Test Requirements

Add or update direct GraphQL tests for:

- Empty required strings.
- Whitespace-only required strings.
- Values over configured maximum lengths.
- Valid input normalization before persistence.
- Failed creates leaving no new row.
- Failed edits leaving the existing row unchanged.
- Collection query default bound or pagination behavior.
- Deterministic ordering at pagination boundaries.
- Invalid pagination arguments.

When model-level enforcement is required, also add model tests for direct ORM writes.

## Implementation Notes

- Prefer one small helper for normalization and validation when both create and edit need the same behavior.
- Keep validation constants near the owning model or GraphQL boundary so tests and UI can reuse the same intended values.
- If model validation runs on every save, normalize before Django field validators run.
- When using `update_fields`, ensure normalized fields are included in the saved field set.
- Add migrations when model field metadata changes.

## Completion Checklist

- Direct GraphQL clients cannot create invalid records.
- Direct GraphQL clients cannot edit records into invalid states.
- List queries are bounded or paginated.
- User-safe error messages are asserted by tests.
- Backend tests cover boundary values and persistence safety.
- Frontend constraints are updated when they should mirror backend limits.
