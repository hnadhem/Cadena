---
description: Generate a conventional commit message from staged changes
allowed-tools: Bash(git diff --staged), Bash(git log --oneline -5)
---
Read the staged diff and the last 5 commits for context.
Generate a conventional commit message following this format:
<type>(<scope>): <short summary>
Types: feat, fix, refactor, test, docs, chore, perf
- Summary must be under 72 characters
- Use imperative mood ("add" not "added")
- If breaking change, append ! after type/scope
- Output only the commit message, nothing else
