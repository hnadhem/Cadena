# AGENTS.md - Codex Adapter for HabIt

## Purpose

This file is the Codex-facing adapter for the HabIt project. It summarizes the project knowledge Codex needs without replacing or rewriting the existing Claude Code setup.

Claude Code remains supported through `CLAUDE.md` and `.claude/`. Treat those files as source material and do not modify them unless the user explicitly asks.

## Project Map

- `app/` - Expo Router screens and route layout.
- `app/(tabs)/` - main tab screens: Fitness, Today, and Habits.
- `components/` - reusable React Native components.
- `components/ui/` - shared UI primitives.
- `components/shared/` - shared app-level components.
- `services/db.ts` - SQLite database setup and migration runner.
- `store/` - Zustand stores for habits, user preferences, and workouts.
- `types/schema.ts` - core TypeScript data model definitions.
- `constants/` - enums and theme tokens.
- `utils/` - pure utility functions.
- `assets/` - Expo app assets.
- `schema_v12.html` and `RESEARCH.md` - reference material.
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

## App-Layer Rules

These are validation and business-logic rules enforced in application code, not in the schema. The v12 schema is the source of truth for data shape; these rules govern behavior the schema does not encode.

- **Workout exercise cap**: Maximum 20 exercises per workout session or template. Enforced at two points: template building (WorkoutTemplate.exerciseConfigs) and in-session add (the edit-mode "Add exercise" action). Hard block - adding a 21st exercise is prevented and the affordance disables with a one-line inline explanation. Do not warn-then-allow.

- **Exercise completion (workout player)**: An exercise is considered complete by explicit user advance (moving past it or marking it done), NOT by inferring from logged set count. Do not treat sets.length >= defaultSets as completion - users skip, add, or cut sets short.

- **Enforcement note**: These rules are guaranteed by validation code, not by this file. Where a rule constrains data, implement the check in the relevant service or store function so it holds regardless of entry path.

## Verification

- For TypeScript or React Native changes, run `npm run typecheck`.
- Run `npm run lint` after code changes when practical.
- Run tests relevant to the changed behavior. `npm test` is watch mode; use `npx jest --watchAll=false` for a one-shot test run.
- If a command cannot be run, report that clearly with the reason.

## Claude Code Compatibility

This Codex setup coexists with Claude Code. Do not delete, rename, or rewrite `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`, `.claude/settings.json`, or other Claude-specific files unless the user explicitly requests it.

Repo-scoped Codex skills live in `.agents/skills/`. Project-scoped Codex configuration lives in `.codex/config.toml`.
