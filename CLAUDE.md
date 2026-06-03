# CLAUDE.md — HabIt Project

## Project
HabIt is a personal habit and fitness tracker for iOS and Android.
Goal: help the user build and maintain daily habits with streaks, logging, and progress visibility.
Status: active development — scaffolding complete, screens being built out.

## Stack
- React Native + Expo SDK 54
- Expo Router for file-based navigation
- TypeScript — strict mode, no `any` without explicit justification
- SQLite (expo-sqlite) for local data persistence
- Zustand for state management
- No backend or cloud sync — all data is device-local

## Commands
- Install dependencies: `npm install`
- Start dev server: `npx expo start`
- Run tests: `npm test`
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`

## Folder Structure
- `/app` — screens and routing (Expo Router convention)
- `/components` — reusable UI components (`/shared`, `/ui`)
- `/services` — SQLite database layer and migration runner
- `/store` — Zustand stores (habit, user, workout)
- `/types` — TypeScript schema definitions
- `/constants` — enums, colors, spacing, typography tokens
- `/utils` — pure utility functions (dates, unit conversion)

## Conventions
- MUST use functional components with hooks — no class components
- MUST keep all database logic in `/db` — never query SQLite directly from screens or components
- MUST define all colors, spacing, and typography in `/constants` — no hardcoded style values
- NEVER use `any` type without a comment explaining why
- File names: kebab-case (e.g. `habit-card.tsx`)
- Component names: PascalCase (e.g. `HabitCard`)

## Architecture
- **Data models**: defined in `/types/schema.ts` — User, Habit, HabitLog, HabitTarget, WorkoutSession, ExerciseLog, SetLog, CardioSession, PersonalRecord, Goal, DailyLog, JournalEntry, Nutrition, Medication, TallyItem, BodyMetric, ProgressPhoto
- **State management**: Zustand stores in `/store/` — `useHabitStore` (habits + today's logs), `useUserStore` (user prefs + app mode), `useWorkoutStore` (live session, staged set input, rest timer)
- **Database**: single migration runner in `/services/db.ts`; all DB writes go through stores or service functions, never directly from screens
- **Navigation**: tab-based — Fitness / Today / Habits; Settings opens as a modal
- **App modes**: `combined` (default), `fitness_only`, `habits_only` — controls which tabs are shown

## App-Layer Rules
These are validation and business-logic rules enforced in application code, not in the schema. The v12 schema is the source of truth for data shape; these rules govern behavior the schema does not encode.

- **Workout exercise cap**: Maximum 20 exercises per workout session or template. Enforced at two points: template building (WorkoutTemplate.exerciseConfigs) and in-session add (the edit-mode "Add exercise" action). Hard block — adding a 21st exercise is prevented and the affordance disables with a one-line inline explanation. Do not warn-then-allow.

- **Exercise completion (workout player)**: An exercise is considered complete by explicit user advance (moving past it or marking it done), NOT by inferring from logged set count. Do not treat sets.length >= defaultSets as completion — users skip, add, or cut sets short.

- **Enforcement note**: These rules are guaranteed by validation code, not by this file. Where a rule constrains data, implement the check in the relevant service or store function so it holds regardless of entry path.
