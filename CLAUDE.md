# CLAUDE.md — HabIt Project

## Project
HabIt is a personal habit and fitness tracker for iOS and Android.
Goal: help the user build and maintain daily habits with streaks, logging, and progress visibility.
Status: early development — scaffolding in progress.

## Stack
- React Native + Expo SDK (latest stable)
- Expo Router for file-based navigation
- TypeScript — strict mode, no `any` without explicit justification
- SQLite (expo-sqlite) for local data persistence
- No backend or cloud sync — all data is device-local

## Commands
To be updated once scaffolding is complete:
- Install dependencies: `npm install`
- Start dev server: `npx expo start`
- Run tests: `npm test`
- Type check: `npx tsc --noEmit`

## Folder Structure
- `/app` — screens and routing (Expo Router convention)
- `/components` — reusable UI components
- `/db` — SQLite schema, migrations, and query functions
- `/hooks` — custom React hooks
- `/constants` — colors, spacing, typography tokens

## Conventions
- MUST use functional components with hooks — no class components
- MUST keep all database logic in `/db` — never query SQLite directly from screens or components
- MUST define all colors, spacing, and typography in `/constants` — no hardcoded style values
- NEVER use `any` type without a comment explaining why
- File names: kebab-case (e.g. `habit-card.tsx`)
- Component names: PascalCase (e.g. `HabitCard`)

## Architecture
To be documented as the project develops. Update with:
- Core data models (Habit, Log, Streak)
- State management approach
- Key screens and navigation flow
