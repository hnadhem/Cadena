---
name: commit-msg
description: Generate a conventional commit message from staged git changes without staging files, committing, or modifying the worktree.
---

# Commit Message

Use this skill when the user asks for a git commit message, commit summary, or commit note based on staged changes.

## Workflow

1. Read the staged diff:
   - `git diff --staged`
2. Read recent commit style for context:
   - `git log --oneline -5`
3. Generate one conventional commit message.

## Rules

- Do not run `git commit`.
- Do not stage files.
- Do not modify files.
- Do not create hooks or automatic git behavior.
- Base the message on staged changes only.
- If there are no staged changes, say that no staged changes were found.
- Follow this format:
  - `<type>(<scope>): <short summary>`
- Allowed types:
  - `feat`
  - `fix`
  - `refactor`
  - `test`
  - `docs`
  - `chore`
  - `perf`
- Keep the summary under 72 characters.
- Use imperative mood, such as `add`, not `added`.
- If the change is breaking, append `!` after the type or scope.
- Output only the commit message unless there are no staged changes.
