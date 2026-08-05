---
name: jira-prd-file-hygiene
description: Use when handling Jira issue PRD files such as GARD-24.prd.md, .gitignore rules, or removing tracked PRDs from Git without deleting local files.
---

# Jira PRD File Hygiene

Use this skill when the user asks about Jira issue PRD files, ignored PRDs, tracked PRDs, or `.gitignore` behavior for local planning files.

## Desired Behavior

- Jira issue PRD files such as `GARD-24.prd.md` should usually stay local and ignored.
- General product documents such as `PRD.md` may remain tracked unless explicitly ignored.
- Do not force-add ignored Jira PRDs unless the user explicitly asks.

## Ignore Rule

Use a targeted ignore pattern for Jira issue PRD files:

```gitignore
# Jira issue PRD files
*-[0-9]*.prd.md
```

This ignores files like:

- `GARD-3.prd.md`
- `GARD-24.prd.md`
- `OPS-123.prd.md`

It does not ignore a top-level product document named `PRD.md`.

## Untracking Already Tracked PRDs

`.gitignore` does not apply to files already tracked by Git. To stop tracking a Jira PRD without deleting the local file, use:

```bash
git rm --cached GARD-24.prd.md
```

For multiple files:

```bash
git rm --cached GARD-3.prd.md GARD-24.prd.md
```

Never use a normal `rm` for this workflow unless the user wants the local files deleted too.

## Verification

- Use `git check-ignore -v <file>` to confirm an ignore rule applies.
- Use `git ls-files "*.prd.md"` to confirm no Jira PRDs remain tracked.
- Use `git status --short --branch` to inspect staged deletions from tracking.

## Commit Guidance

- If the user asks to commit, include the `.gitignore` change and the staged untracking deletions.
- Use a Jira-prefixed commit message when working in a Jira ticket branch, for example:

```text
GARD-24 ignore Jira PRD files
```
