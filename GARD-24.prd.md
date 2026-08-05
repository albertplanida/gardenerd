# GARD-24: Build Container List and Form UI

## Jira

- Issue: `GARD-24`
- Type: Subtask
- Parent story: `GARD-3` Create Container Records
- Status at planning: In Progress

## Objective

Build the frontend UI that lets a gardener view, create, and edit simple name-only Container records.

This work stays on the parent `GARD-3` branch and corresponding worktree. Do not create a separate `GARD-24` branch or worktree.

## Product Context

Containers represent physical places where Growing Trials happen, such as the user's initial pots.

Examples:

- Pot 1
- Pot 2
- Pot 3
- Pot 4

In version one, Containers remain intentionally simple and only require a name. Extra fields such as size, material, drainage, location, and soil type are deferred.

## Scope

Included work:

- Add frontend GraphQL documents for listing, creating, and editing Containers.
- Render a Container list on the frontend.
- Render a create Container form.
- Render an edit Container form or inline edit flow.
- Show useful empty, loading, success, and error states.
- Add frontend tests for the main UI behavior.

Excluded work:

- Backend Container model, migration, GraphQL type, query, or mutations.
- Additional Container fields beyond `name`.
- Authentication or authorization.
- Pagination, filtering, sorting controls, deletion, or Container detail pages.
- Growing Trial integration.

## Current Frontend Context

The frontend is a Next.js app using React, Mantine, Jest, Testing Library, Playwright, and `graphql-request`.

Current relevant files:

- `frontend/src/app/page.tsx`
- `frontend/src/app/page.test.tsx`
- `frontend/e2e/home.spec.ts`
- `frontend/src/graphql/client.ts`
- `frontend/src/graphql/queries.ts`

The current home page only renders the application name and setup text. GARD-24 should replace or extend that page with the first usable Container management UI.

## GraphQL Contract

GARD-24 should consume the backend operations delivered by `GARD-26`.

List query:

```graphql
query Containers {
  containers {
    id
    name
    createdAt
    updatedAt
  }
}
```

Create mutation:

```graphql
mutation CreateContainer($name: String!) {
  createContainer(name: $name) {
    id
    name
    createdAt
    updatedAt
  }
}
```

Edit mutation:

```graphql
mutation EditContainer($id: ID!, $name: String!) {
  editContainer(id: $id, name: $name) {
    id
    name
    createdAt
    updatedAt
  }
}
```

## UX Requirements

### Container List

- Page title remains clearly branded as Gardenerd.
- UI includes a clear Containers section.
- Existing Containers are visible by name.
- Empty state explains that no Containers exist yet and prompts the user to add one.
- Loading state is visible while Container data is being requested.
- Error state is visible when Container data cannot be loaded.

### Create Flow

- User can enter a Container name.
- User can submit the form to create a Container.
- Successful creation adds the new Container to the visible list or refreshes the list.
- The form clears after successful creation.
- Blank names are rejected client-side with a useful validation message.
- Submit controls prevent duplicate submissions while a create request is in progress.

### Edit Flow

- User can start editing an existing Container.
- User can update the Container name.
- Successful edit updates the visible list or refreshes the list.
- User can cancel editing without changing the Container.
- Blank names are rejected client-side with a useful validation message.
- A missing or failed edit request shows a useful error message.

## Implementation Notes

- Keep the first implementation minimal and easy to test.
- Prefer colocating small UI behavior in `frontend/src/app/page.tsx` unless the file becomes difficult to read.
- Reuse `createGraphqlClient` instead of introducing another GraphQL client.
- Store GraphQL documents in the existing `frontend/src/graphql/queries.ts` file unless a clearer split becomes necessary.
- Use accessible labels and roles so Jest and Playwright tests can exercise behavior through user-facing UI.
- Avoid adding state management libraries or generated GraphQL tooling for this ticket.

## Suggested TDD Workflow

Follow red-green-refactor for the user-visible behavior.

GARD-24 should be built with Test Driven Development. Write failing tests first, implement the smallest code needed to pass, then refactor while keeping the tests green.

### 1. GraphQL Documents

Add tests or assertions where practical to confirm the Container query and mutations exist with the expected operation names.

Expected exports:

- `CONTAINERS_QUERY`
- `CREATE_CONTAINER_MUTATION`
- `EDIT_CONTAINER_MUTATION`

### 2. Initial Container List UI

Update `frontend/src/app/page.test.tsx` to cover:

- Gardenerd heading still renders.
- Containers section renders.
- Empty state renders when there are no Containers.
- Existing Container names render when the query returns data.

### 3. Create Flow

Add tests for:

- Name input renders with an accessible label.
- Blank submit shows validation.
- Valid submit calls the create mutation.
- Successful create shows the new Container or refreshes the list.

### 4. Edit Flow

Add tests for:

- Edit control is available for existing Containers.
- Editing pre-fills the existing Container name.
- Cancel exits edit mode without changing the visible value.
- Valid submit calls the edit mutation.
- Successful edit updates the visible Container name or refreshes the list.

### 5. Browser Verification

Update Playwright coverage in `frontend/e2e/home.spec.ts` where practical for the stable page-level contract:

- Home page loads.
- Gardenerd heading is visible.
- Containers section is visible.

## UI Implementation Plan

### Resolved UX Decisions

- Use a dedicated `/containers` page for Container management.
- Keep the home page as a lightweight entry point with a simple Containers card or link.
- Use a Mantine modal for creating Containers.
- Use a Mantine modal for editing Containers.
- Keep all Container UI limited to the V1 `name` field.

### Design Direction

- Keep the UI simple and beginner-friendly, aligned with the Gardenerd V1 PRD.
- Use Mantine default components rather than custom visual systems.
- Avoid extra Container fields such as size, material, drainage, location, and soil type.
- Avoid deletion, filtering, sorting controls, pagination, Container detail pages, or Growing Trial integration for this ticket.
- Make the page usable on desktop and mobile browsers.

### Proposed `/containers` Page

Use Mantine default components such as:

- `Container` for page width.
- `Stack` for vertical layout.
- `Group` for title and action alignment.
- `Title` and `Text` for headings and helper copy.
- `Button` for add, edit, save, and cancel actions.
- `Card` or `Paper` for each Container list item.
- `Modal` for create and edit forms.
- `TextInput` for the Container name.
- `Alert` for load or save errors.
- `Loader` or `Skeleton` for loading state.

The `/containers` page should include:

- Page title: `Containers`.
- Helper copy explaining that Containers track the pots or places where Growing Trials happen.
- Primary action: `Add Container`.
- Loading state while Container data is being requested.
- Error state if Container data cannot be loaded.
- Empty state when no Containers exist yet.
- A list of existing Containers by name.
- An Edit action for each Container.

### Create Modal

The create modal should include:

- Modal title: `Add Container`.
- A labeled `Container name` input.
- Client-side validation that rejects blank names.
- A useful validation message for blank names.
- Disabled submit behavior while the create request is in progress.
- Successful creation should close the modal, clear the field, and update or refetch the visible list.

### Edit Modal

The edit modal should include:

- Modal title: `Edit Container`.
- A labeled `Container name` input prefilled with the selected Container name.
- Client-side validation that rejects blank names.
- A useful validation message for blank names.
- A Cancel action that closes the modal without saving.
- Disabled submit behavior while the edit request is in progress.
- Successful edit should close the modal and update or refetch the visible list.
- Failed edit should show a useful error message.

### Home Page Update

The home page should remain lightweight:

- Keep the `Gardenerd` heading.
- Replace starter setup text with a short product-oriented intro if needed.
- Add a simple Mantine `Card` or `Paper` linking to `/containers`.
- The card should clearly communicate that Containers are where the gardener creates and manages pots or places where Growing Trials happen.

### GraphQL Work

Add Container GraphQL documents to `frontend/src/graphql/queries.ts`:

- `CONTAINERS_QUERY`
- `CREATE_CONTAINER_MUTATION`
- `EDIT_CONTAINER_MUTATION`

Use the existing `createGraphqlClient`. Do not add another GraphQL client, generated GraphQL tooling, or a state management library for this ticket.

### Expected File Changes

Likely frontend files:

- `frontend/src/app/page.tsx` for the home page Containers entry point.
- `frontend/src/app/containers/page.tsx` for the Container manager UI.
- `frontend/src/graphql/queries.ts` for Container GraphQL documents.
- `frontend/src/app/page.test.tsx` for home page tests.
- `frontend/src/app/containers/page.test.tsx` for Container page tests.
- `frontend/e2e/home.spec.ts` for home navigation smoke coverage.
- `frontend/e2e/containers.spec.ts` for mocked GraphQL Container user workflow coverage.

## Detailed TDD Execution Plan

### 1. GraphQL Document Tests

Status: Completed.

Write failing Jest tests or assertions for:

- `CONTAINERS_QUERY` export exists and uses the `Containers` operation.
- `CREATE_CONTAINER_MUTATION` export exists and uses the `CreateContainer` operation.
- `EDIT_CONTAINER_MUTATION` export exists and uses the `EditContainer` operation.

Then add the GraphQL document exports and re-run the tests.

### 2. Home Page Tests

Status: Completed.

Write failing Jest tests for:

- The `Gardenerd` heading still renders.
- A user-visible Containers link or card renders.
- The Containers link points to `/containers`.

Then implement the smallest home page update needed to pass.

### 3. Initial Container List UI Tests

Write failing Jest tests for:

- The `/containers` page renders a `Containers` heading.
- The page renders an `Add Container` action.
- A loading state appears while the Container query is pending.
- An empty state appears when the query returns no Containers.
- Existing Container names render when the query returns data.
- A useful error state appears when the query fails.

Then implement the initial `/containers` page data loading and list states.

### 4. Create Flow Tests

Write failing Jest tests for:

- Clicking `Add Container` opens the create modal.
- The create modal has an accessible `Container name` input.
- Blank submit shows a validation message.
- Valid submit calls the create mutation.
- Successful create closes the modal and updates or refetches the visible list.

Then implement the create modal and mutation behavior.

### 5. Edit Flow Tests

Write failing Jest tests for:

- Existing Containers expose an Edit control.
- Clicking Edit opens the edit modal.
- The edit modal input is prefilled with the selected Container name.
- Cancel closes the modal without saving.
- Blank submit shows a validation message.
- Valid submit calls the edit mutation.
- Successful edit closes the modal and updates or refetches the visible list.
- Failed edit shows a useful error message.

Then implement the edit modal and mutation behavior.

### 6. Playwright E2E Tests With Mocked GraphQL

Playwright tests for GARD-24 should mock GraphQL requests in the frontend rather than depending on the real Django backend or database.

Use Playwright request interception for `/graphql`:

- Keep an in-memory `containers` array inside each test or test fixture.
- Respond based on GraphQL operation name.
- Support the `Containers`, `CreateContainer`, and `EditContainer` operations.
- Return realistic GraphQL response shapes matching the backend contract.

This keeps frontend E2E tests fast, deterministic, and focused on the GARD-24 UI. Backend GraphQL behavior is covered separately by GARD-26 backend tests. Full-stack E2E can be added later when the app has a stable test database and reset flow.

### 7. Playwright User Workflow Scenarios

Add Playwright coverage for:

- Home page loads and shows the `Gardenerd` heading.
- Home page exposes a user-visible Containers card or link.
- User navigates from home to `/containers`.
- `/containers` shows the `Containers` heading.
- User sees an empty state when no Containers exist.
- User opens the create modal with `Add Container`.
- Blank create submission shows validation.
- User creates `Pot 1` and sees it in the list.
- User creates `Pot 2`, `Pot 3`, and `Pot 4` and sees all four in the list.
- User opens the edit modal for `Pot 1`.
- The edit form is prefilled with `Pot 1`.
- Blank edit submission shows validation.
- User edits `Pot 1` to another name and sees the updated name in the list.
- User can cancel an edit without changing the visible Container name.
- A mocked query failure shows a useful error state and the page does not crash.

The existing Playwright config runs desktop Chromium and mobile Chrome projects. Keep selectors user-facing and layout-agnostic so the same tests can run in both projects.

### 8. Final Verification

Run from `frontend/`:

- `npm test`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `npm run e2e` when local browser dependencies are available.

## Acceptance Criteria

- User can view a list of Containers by name.
- User sees an empty state when no Containers exist.
- User can create a Container with a non-blank name.
- User can edit an existing Container name.
- User can cancel editing without saving.
- Loading and error states are handled for Container requests.
- Client-side validation prevents blank Container names.
- Frontend uses the Container GraphQL query and mutations from `GARD-26`.
- No additional Container fields are introduced.
- Jest tests cover the main list, create, and edit behavior.
- Playwright smoke test still confirms the page loads and exposes the Containers section.
- Frontend tests, lint, and formatting checks pass.

## Verification Commands

Run from `frontend/`:

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Run Playwright if the local app and browser dependencies are available:

```bash
npm run e2e
```
