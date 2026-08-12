---
name: feature-slice-readiness-review
description: Use before marking a Gardenerd feature story or PR ready, especially when model, GraphQL, frontend, migrations, and tests were implemented across separate subtasks.
---

# Feature Slice Readiness Review

Use this skill before declaring a parent story, PR, or cross-layer feature complete.

The goal is to catch integration and hardening gaps that individual subtasks can miss.

## Review Mindset

Review the feature as one user-visible slice, not as isolated subtasks.

Prioritize correctness, data integrity, security boundaries, operational safety, and missing tests over style cleanup.

## Required Context

- Read the parent story PRD or Jira summary.
- Read any subtask PRD files that contributed model, GraphQL, frontend, or test work.
- Inspect the implemented model, migrations, GraphQL schema/resolvers, frontend client, page UI, and tests.
- Check existing patterns, but do not assume mirrored patterns are safe for the new feature.

## Cross-Layer Checks

- Required fields are enforced at the authoritative backend boundary.
- Frontend validation mirrors backend constraints where useful for user feedback.
- Direct GraphQL calls cannot bypass frontend validation.
- User-controlled text has clear length limits.
- Whitespace normalization is consistent across create and edit flows.
- Error messages are user-safe and stable enough for tests.
- Collection queries are bounded or paginated.
- Ordering is deterministic.
- Pagination behavior is compatible with create/edit UI flows.
- Database migrations reflect intended model metadata changes.
- Existing data remains compatible with new validation and migrations.
- API response shape changes are reflected in all consumers.

## Test Coverage Checks

Confirm tests cover:

- Successful create, edit, and list behavior.
- Empty, whitespace-only, oversized, and valid boundary inputs.
- Normalization before persistence.
- Failed creates leaving no row.
- Failed edits preserving prior data.
- Missing-record behavior.
- Pagination defaults, next/previous metadata, and invalid arguments.
- Frontend loading, empty, error, validation, save failure, and pagination states.

## Verification Checks

Run the relevant verification suite before finalizing:

- Backend tests.
- Backend lint.
- Migration check when models changed.
- Frontend tests.
- Frontend lint and format check.
- Docker Compose startup when the user or PRD requires manual validation.

If a command needs local environment variables, provide safe test-only values rather than skipping verification.

## Findings Format

When reviewing, report findings first and order them by severity.

Each finding should include:

- File and line reference when possible.
- The user-visible or operational risk.
- The smallest practical fix.

If no findings remain, state that explicitly and list any residual risks or skipped checks.

## Completion Gate

A feature slice is ready only when:

- Data integrity holds without relying on the frontend.
- Collection reads cannot accidentally load unbounded records.
- Tests prove the important boundary behavior.
- Verification commands pass or documented blockers are resolved.
- Unrelated worktree changes remain unstaged and unmodified.
