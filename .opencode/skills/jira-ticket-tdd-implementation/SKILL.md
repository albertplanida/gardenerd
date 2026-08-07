---
name: jira-ticket-tdd-implementation
description: Use when implementing a Jira ticket with TDD, Jira-key commits, local PRD progress updates, and final verification.
---

# Jira Ticket TDD Implementation

Use this skill when the user asks to implement a Jira issue or subtask with Test Driven Development, incremental commits, and PRD progress tracking.

## Workflow

- Confirm the current worktree and branch match the parent Jira work item when the user names one.
- Read the Jira issue and any relevant local PRD/spec files before editing.
- If PRD files for Jira issues are ignored, do not force-add them unless the user explicitly requests it.
- Create a todo list for non-trivial work.
- Work in small TDD increments: write failing tests, run them, implement the smallest passing change, then refactor.
- Make incremental commits after each meaningful green increment.
- Prefix every commit message with the Jira key, for example `GARD-24 add container list page`.
- If the PRD is tracked or the user asks to update it, mark completed sections as work finishes.
- Do not amend commits unless explicitly requested.

## TDD Expectations

- Write user-visible tests before feature code where practical.
- Confirm the tests fail for the expected reason before implementation.
- Keep implementation minimal and aligned with the ticket scope.
- Re-run targeted tests after each increment.
- Run the full relevant verification suite before finalizing.

## Commit Discipline

- Inspect `git status --short --branch`, relevant diffs, and recent commits before committing.
- Stage only intended files.
- Never revert unrelated local changes.
- Use concise Jira-prefixed commit messages.

## Final Response

Include:

- What changed.
- Tests and verification commands run.
- Commits created.
- Current worktree status.
- Any blocked or skipped verification.
