---
name: jira-ticket-prd-workflow
description: Use when starting work on any Jira ticket in the Gardenerd app: creates or uses a per-ticket git worktree, reads Jira and PRD.md, inspects relevant code, and creates temporary ticket PRD summary files before coding.
---

# Jira Ticket PRD Workflow

Use this skill whenever the user asks to start work on a Jira ticket for the Gardenerd app.

The goal is to establish the correct worktree and create temporary ticket-specific PRD summary files before implementation begins. These generated PRD summary files are working references and may be deleted later.

## Workflow

1. Identify the Jira ticket ID from the user's request.
2. Ensure the ticket has its own git worktree alongside the main `Gardenerd` directory.
3. Use the worktree naming convention `Gardenerd.wt.[ticket-id]`.
4. If the worktree does not exist, create it from the main `Gardenerd` repository.
5. Use that ticket worktree as the active working directory for all code and file operations.
6. Pull the Jira ticket details.
7. Pull related Jira context, including parent story, subtasks, and linked issues when relevant.
8. Read the project's main `PRD.md` in the ticket worktree.
9. Inspect the codebase for files, tests, and conventions relevant to the Jira ticket.
10. Create temporary ticket-specific PRD summary files in the ticket worktree.
11. Use those temporary PRD files as the source of truth while coding.

## Worktree Rules

- The main repository directory is named `Gardenerd`.
- Ticket worktrees live alongside `Gardenerd`, not inside it.
- Ticket worktrees use this exact naming format: `Gardenerd.wt.[ticket-id]`.
- Example path shape: `../Gardenerd.wt.PROJECT-123` relative to the parent directory containing `Gardenerd`.
- Do not reuse another ticket's worktree for the current ticket.
- If the current session is already inside the correct ticket worktree, continue using it.
- If the session is inside the wrong worktree, switch file and shell operations to the correct worktree path.

## Jira Review Requirements

Before writing implementation code, gather enough Jira context to understand the work:

- Current ticket summary, type, description, status, and acceptance criteria.
- Parent issue or epic when present.
- Subtasks when present.
- Linked issues when relevant.
- Comments when they contain requirements or clarifications.

Use Jira as the source for ticket-specific scope, but cross-check product behavior against the repository's `PRD.md`.

## Codebase Review Requirements

Before creating the summary PRD files, inspect the codebase enough to understand existing conventions:

- Project stack and framework.
- Relevant app/module boundaries.
- Existing models, migrations, schema, services, or UI patterns.
- Existing test structure and test style.
- Existing naming conventions.

Prefer targeted file and content searches over assumptions.

## PRD Review Requirements

Read the main project `PRD.md` and extract only the portions relevant to the ticket.

Capture:

- Product terms and definitions.
- Acceptance criteria or success criteria.
- Explicit non-goals and deferred fields/features.
- Data model expectations.
- Relationship rules.
- Testing expectations when present.

## Temporary Summary PRD Files

Create temporary summary PRD files in the ticket worktree before coding.

For a story with subtasks:

- Create one summary PRD for the parent story.
- Create one summary PRD for the active subtask.

For a standalone ticket:

- Create one summary PRD for the ticket.

Use this naming convention:

- `[ticket-id].prd.md`
- `[parent-ticket-id].prd.md` when a parent story is relevant

Each summary PRD should include:

- Jira issue key and title.
- Story/task summary.
- Product context from `PRD.md`.
- Acceptance criteria.
- In-scope work.
- Out-of-scope work.
- Technical context discovered from the codebase.
- TDD or verification plan appropriate for the ticket.

Keep these files concise and practical. They are working documents, not permanent product documentation.

## Implementation Gate

Do not begin coding until:

- The correct ticket worktree exists and is being used.
- Jira has been reviewed.
- `PRD.md` has been reviewed.
- Relevant codebase conventions have been inspected.
- Temporary summary PRD files have been created.

After this gate is complete, proceed with normal implementation using the summary PRD files as reference.
