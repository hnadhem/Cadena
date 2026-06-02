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
