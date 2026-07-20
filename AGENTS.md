# AGENTS.md - Cadena Agent Guide

## Purpose

This file is the shared project guide for coding agents working in Cadena. Codex reads it automatically. Claude Code imports it from `CLAUDE.md`.

Keep durable, repo-wide guidance here. Put tool-specific behavior in `CLAUDE.md`, `.claude/`, `.codex/`, or repo skills.

## Instruction Authority

- Treat this repository's structure, docs, schema references, and established architecture as the source of truth for implementation decisions.
- Prompts generated outside the repository may be stale, incomplete, or inconsistent with project constraints. If a prompt conflicts with `AGENTS.md`, `CLAUDE.md`, `schema_consolidated_13.html`, existing code structure, or established app architecture, raise the issue before implementing.
- Question risky prompts. The agent should recommend the safest project-aligned path and proceed only with the user's approval when a requested change would deviate from established structure, data flow, schema/migration policy, or compatibility requirements.

## Project Map

- `app/` - Expo Router screens and route layout.
- `app/(tabs)/` - main tab screens: Fitness, Today, and Habits.
- `components/` - reusable React Native components.
- `components/ui/` - shared UI primitives.
- `components/shared/` - shared app-level components.
- `components/today/` - Today root UI components.
- `services/db.ts` - SQLite database setup and migration runner.
- `services/todayService.ts` - Today view-model composition and fitness session actions.
- `store/` - Zustand stores for user preferences and workout session state; habit flows use `UI -> service -> SQLite` directly because stores are reserved for ephemeral in-memory state between start and commit.
- `types/schema.ts` - core TypeScript data model definitions.
- `types/today.ts` - normalized Today view model contract.
- `constants/` - enums and theme tokens.
- `utils/` - pure utility functions, including Today selector helpers.
- `docs/app-layer-rules.md` - durable business rules and product behavior that the schema does not encode.
- `docs/schema-errata.md` - known schema documentation ambiguities; not schema changes.
- `assets/` - Expo app assets.
- `schema_consolidated_13.html` - canonical v13 data-shape reference.
- `RESEARCH.md` - pointer to archived historical research; not implementation guidance.
- `CLAUDE.md` and `.claude/` - Claude Code guidance, commands, and skills.
- `.codex/config.toml`, `.agents/skills/`, and this file - Codex adapter setup.

## Stack

- React Native with Expo SDK 54.
- Expo Router for file-based navigation.
- TypeScript with strict mode enabled.
- `expo-sqlite` for device-local persistence.
- Zustand for state management.
- Jest with `jest-expo`.
- npm package manager via `package-lock.json`.

This lists the architectural core only; see `README.md` for the full dependency list.

## Commands

- Install dependencies: `npm install`
- Start dev server: `npm start` or `npx expo start`
- Run iOS: `npm run ios`
- Run Android: `npm run android`
- Run web: `npm run web`
- Run tests: `npm test`
- Run tests once for automation: `npx jest --watchAll=false`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: no build script is currently defined in `package.json`; do not add one unless the user asks.

## Conventions

- Keep changes narrowly scoped to the user's request.
- Do not add secrets, API keys, tokens, credentials, or local machine-specific paths.
- Use functional components with hooks; do not add class components.
- Preserve strict TypeScript. Avoid `any`; if unavoidable, add a short justification comment.
- Keep database setup and migration logic in `services/db.ts`; do not query SQLite directly from screens or components.
- Route data changes through stores or service functions rather than UI components.
- Prefer existing constants and theme tokens for colors, spacing, and typography.
- Follow nearby file and naming conventions. Do not rename existing files for style cleanup unless explicitly requested.
- Use npm commands; do not switch package managers.
- Avoid broad app-code changes when the task is tooling, configuration, or documentation only.
- Do not change schema or migrations unless the user explicitly asks for that scope.

## Commit & PR Guidelines

- Use Conventional Commits: `type(scope): summary` (for example `feat(today): build root screen` or `docs: consolidate project agent guidance`).
- Keep each commit scoped to one logical change; do not bundle unrelated edits.
- Commit or push only when the user asks; branch first if on the default branch.
- The repo `commit-msg` skill/command can generate a message from staged changes.

## App-Layer Rules

Application rules that are not encoded by the v13 schema live in `docs/app-layer-rules.md`. Read that file before changing Today, workout/cardio session behavior, habit completion, or workout player logic.

Migrations are mutable pre-release. Migration 1 freezes at v1.0 launch, and all subsequent schema changes go in new forward-only migrations.

## Schema Notes

Known schema documentation ambiguities live in `docs/schema-errata.md`. If `schema_consolidated_13.html`, TypeScript types, and the database setup disagree, report the ambiguity before changing schema or migrations.

## Verification

- For TypeScript or React Native changes, run `npm run typecheck`.
- Run `npm run lint` after code changes when practical.
- Run tests relevant to the changed behavior. `npm test` is watch mode; use `npx jest --watchAll=false` for a one-shot test run.
- If a command cannot be run, report that clearly with the reason.
- For docs-only changes, run targeted `rg` checks for stale or conflicting guidance instead of full code checks unless tooling or commands changed.

## Definition of Done

- Relevant code, tests, and docs are updated for the requested scope.
- Business rules remain in selectors, services, or stores rather than raw SQL or domain logic in screens.
- Schema, migrations, package manager, and navigation changes stay out of scope unless explicitly requested.
- Typecheck, lint, and relevant tests are run when practical; skipped checks are reported with the reason.
- No generated tooling/config churn is left in the worktree unless the task explicitly asked for tooling setup.

## Tooling Notes

- `npm run lint` uses Expo linting. If it prompts to install or generate ESLint setup, pause and report it unless the task includes tooling setup. Do not leave automatic package/config changes from lint setup unless approved.

## Claude Code Compatibility

`CLAUDE.md` imports this file and adds Claude-specific notes. Do not delete, rename, or rewrite `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`, `.claude/settings.json`, or other Claude-specific files unless the user explicitly requests it.

Repo-scoped Codex skills live in `.agents/skills/`. Project-scoped Codex configuration lives in `.codex/config.toml`.
