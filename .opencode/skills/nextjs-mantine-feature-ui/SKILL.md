---
name: nextjs-mantine-feature-ui
description: Use when building a Next.js UI feature with Mantine default components, accessible forms, page states, and frontend tests.
---

# Next.js Mantine Feature UI

Use this skill when implementing a simple frontend feature screen in a Next.js app that uses Mantine.

## Design Principles

- Preserve the existing app structure, visual language, and component conventions.
- Prefer Mantine default components before adding custom styling.
- Keep the first implementation minimal and testable.
- Use clear headings, helper text, labels, and button names.
- Support desktop and mobile layouts.
- Avoid extra fields, actions, routes, or abstractions outside the ticket scope.

## Common Component Choices

- `Container` for page width.
- `Stack` for vertical layout.
- `Group` for title/action rows.
- `Title` and `Text` for hierarchy and helper copy.
- `Card` or `Paper` for records and empty states.
- `Button` for actions.
- `Modal` for focused create/edit flows.
- `TextInput`, `Textarea`, `Select`, or other Mantine form controls as needed.
- `Alert` for load/save errors.
- `Loader` or `Skeleton` for loading states.

## Required UI States

- Loading state while data is requested.
- Empty state explaining what to do next.
- Error state with useful recovery guidance.
- Validation state for invalid form input.
- Saving state that prevents duplicate submissions.
- Success behavior that updates visible UI or refetches data.
- Pagination controls when the backend returns paginated collections.

## Backend Constraint Mirroring

When a form edits data that is validated by the backend:

- Mirror authoritative backend constraints in the UI for immediate feedback.
- Use `maxLength` for single-line and multiline text inputs when backend maximums exist.
- Show visible validation messages that match the user-facing backend intent.
- Trim values consistently with the backend before submission.
- Do not treat frontend validation as security enforcement; backend GraphQL tests must still cover direct invalid requests.
- Ask one question at a time if the backend maximum length, required fields, or trimming rules are unspecified.

## Paginated Collection UI

When a GraphQL list is paginated or bounded:

- Pass explicit page-size and offset/cursor arguments from the frontend helper.
- Render Previous/Next or Load More controls according to the PRD.
- Disable navigation controls based on backend metadata rather than guessing from rendered item count.
- Keep loading and retry behavior scoped to the current page.
- Define and test create/edit behavior while viewing a paginated page.
- Avoid accumulating unbounded records in browser state unless the product explicitly calls for Load More behavior.

## Accessibility And Tests

- Use accessible labels for every form input.
- Use user-facing button names and headings.
- Prefer tests that query by role, label, and visible text.
- Avoid implementation-detail selectors unless no accessible alternative exists.
- For modal titles, avoid nested heading markup that causes invalid HTML.
- Test frontend validation for backend length limits when the UI mirrors them.
- Test pagination navigation arguments and disabled states when lists are paginated.

## Next.js Notes

- Use client components only when needed for interactivity.
- Avoid passing server-only values or function components across server/client boundaries.
- For Mantine buttons linking between routes, use a safe anchor-backed button when server/client boundaries make `next/link` awkward.
- Keep route-specific UI in the route file unless it becomes difficult to read or reusable.
