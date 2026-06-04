# CLAUDE.md — HabIt Project

@AGENTS.md

## Claude Code Notes

Claude Code reads this file, not `AGENTS.md` directly. Shared project guidance is imported above; keep this file limited to Claude-specific behavior to avoid drift.

- Use Plan Mode for broad, ambiguous, multi-file, schema, navigation, or product-rule changes. For narrow fixes, make the scoped edit directly.
- If instructions appear stale, run `/memory` to confirm which `CLAUDE.md`, `CLAUDE.local.md`, and rule files loaded.
- Use `/clear` between unrelated tasks so stale context does not override current repo guidance.
- When compacting or resuming, preserve the modified file list, verification commands/results, TODOs, and blockers.
- `.claude/settings.json`, `.claude/commands/`, and `.claude/skills/` are Claude-specific project files. Do not modify them unless the task asks for Claude Code behavior changes.

## Skills And Commands

- `.claude/commands/` contains single-file Claude commands that still work.
- `.claude/skills/` contains Claude skills. Prefer skills for repeatable procedures that should not be loaded into every session.
- Keep Claude skills and `.agents/skills/` counterparts behaviorally aligned when both exist for the same workflow.
