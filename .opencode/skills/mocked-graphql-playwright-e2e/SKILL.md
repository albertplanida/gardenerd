---
name: mocked-graphql-playwright-e2e
description: Use when adding Playwright E2E tests for frontend GraphQL workflows with mocked /graphql requests and in-memory test state.
---

# Mocked GraphQL Playwright E2E

Use this skill when frontend E2E tests should validate user workflows without depending on a live backend or database.

## When To Mock GraphQL

- The ticket is frontend-focused.
- Backend GraphQL behavior is already covered by backend tests.
- The app does not yet have a stable test database reset flow.
- The user wants deterministic Playwright coverage for UI workflows.

## Route Interception

- Intercept the actual API endpoint precisely, usually `/graphql`.
- Avoid broad patterns like `**/graphql**` because they can catch Next.js chunks such as `node_modules_graphql...` and break the app.
- A safe regex pattern is often:

```ts
const graphqlRoute = /\/graphql\/?(\?.*)?$/;
```

- Parse request bodies defensively because GraphQL clients may send JSON objects or raw strings.
- Fulfill with realistic GraphQL response shapes: `{ data: { operationField: value } }`.
- Return GraphQL `errors` arrays for failure paths when testing error states.

## In-Memory State

- Keep an in-memory array or object inside each test or fixture.
- Update that state inside create/edit/delete mutation handlers.
- Return the updated state from subsequent query responses.
- Keep state scoped per test to avoid cross-test coupling.

## User Workflow Coverage

- Navigate from the user’s entry point to the feature page.
- Verify empty state.
- Exercise validation before valid submission.
- Create records and verify they appear in the UI.
- Edit records and verify the old value disappears and the new value appears.
- Cancel edits and verify no visible data changed.
- Mock load or mutation failures and verify a useful error state.
- Run the same tests across desktop and mobile projects when the config supports it.

## Playwright Selector Guidance

- Prefer `getByRole`, `getByLabel`, and visible text.
- Keep selectors layout-agnostic so tests run on mobile and desktop.
- Avoid CSS selectors for primary user actions.

## Debugging Checklist

- If the page shows an app error, check whether the route pattern is intercepting static assets.
- If no request is intercepted, confirm the GraphQL client endpoint and route pattern.
- If the client throws `Failed to construct 'URL': Invalid URL`, resolve relative endpoints against `window.location.origin` in browser code.
- If mock matching fails, match by operation field names such as `containers`, `createContainer`, and `editContainer`, not only the operation name.
