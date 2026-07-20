# Decision Log

Running log of implementation decisions, known simplifications, and deferred
work — each with a trigger for when to revisit. Append-only; newest context
added over time. Schema-specific rulings (v13 divergences) live in
[`schema-errata.md`](./schema-errata.md#schema-errata), not here.

Last updated: 2026-07-20

---

## Open gates

### Bootstrap: on-device fresh-launch check not yet run
All bootstrap/seed verification to date ran on the sqlite3 CLI / Node fallback;
the real expo-sqlite path on device is unproven. Consciously deferred — unit
tests pass and the app has run in Expo Go before, so risk judged low. Bootstrap
and seeding are exercised on the next launch regardless.

- [ ] On a cleared `habit.db`, confirm: no crash on migrations → bootstrap →
      seed → render; exactly one `User` + one `UserPreferences` + one
      `NotificationSettings`; `User.timezone` is a real IANA string (not
      null/undefined); relaunch creates no second user row; the ~76 seed
      exercises + 9 nutrition metrics appear once and don't duplicate on
      relaunch.
- **First place to look** if a user row is missing on first launch, or a
  duplicate appears on relaunch.

---

## Known simplifications (recorded decisions, not bugs)

### UUID generation uses Math.random()
Local IDs use an existing v4-shaped `generateId()` built on `Math.random()`,
not a crypto-strong source — reused for consistency rather than adding a
dependency. Acceptable for v1: IDs are local-only primary keys that never leave
the device; collision risk is negligible at single-user scale.
- **Revisit when:** sync, multi-device, or server-side accounts are introduced.
  ID generation and collision-resistance then need a real review.

### Bootstrap seeds default preferences; onboarding not marked complete
First launch writes a `UserPreferences` row from schema defaults but leaves
`User.onboardingCompletedAt` null. "Preferences row exists" must never be read
as "onboarding is done" — the null timestamp is the real signal. Any
onboarding-gating logic must key off `onboardingCompletedAt`, not off
preferences existence.
- **Revisit when:** onboarding is built (deliberately the last step).

### Defaults owned by schema, not duplicated in app code
Bootstrap inserts only `userId` for `UserPreferences` and `NotificationSettings`;
SQLite column defaults supply the rest. Keeps the schema the single source of
truth — a future migration changing a default is picked up automatically by new
users. Do not hardcode these defaults in the service layer; that reintroduces
drift. (Push back if anyone proposes moving defaults into app code.)

---

## Deferred work

### Item 3 — workoutStore / workoutSessionService set-logging reconciliation
Schema ruling context: see the
[2026-07-20 v13 divergence rulings](./schema-errata.md#2026-07-20-v13-divergence-rulings-migrations-1-4)
for the `liveState` and `generatedForDate` rulings that touch the workout
session model.

Diagnostic done 2026-07-20 (read-only). Findings:
- **Live workout player persists incrementally through the service.** The screen
  (`app/workout/[sessionId].tsx`) uses local React `setDraft`, calls
  `workoutSessionService.logSet` per set (writes to SQLite immediately), reloads
  from SQLite, and finishes via the service's `completeSession`
  (`writeExerciseLogs = false`). SQLite is source of truth throughout. This is
  the correct, crash-safe model — ratify it, don't change it.
- **`workoutStore.logSet` + `stagedSetInput` are dead in the live flow.** The
  screen never calls them (only `hydrateLiveSession`). Fossils of the original
  scaffold's staged-commit design that the real implementation grew past.
- **BUT `completeSessionFromSnapshot` (writeExerciseLogs = true) is NOT dead —
  it's forward-scaffolding.** It persists a whole session in one transaction
  from an in-memory snapshot — exactly what retroactive / bulk workout entry
  needs (schema supports `isRetroactive` + 3-day window). That flow isn't built
  yet. Do NOT delete it.

**Latent hazard:** the store's `completeSession` → `completeSessionFromSnapshot`
path uses `writeExerciseLogs = true`, which INSERTS ExerciseLog/SetLog rows. If
ever wired to a live session whose sets are already persisted incrementally, it
double-inserts. Currently unreachable — latent, not active.

**Resolution when picked up:**
- Remove the store's live-staging duplication (`logSet`, `updateStagedSetInput`,
  the staged live-commit model) once confirmed nothing new depends on it.
- KEEP `completeSessionFromSnapshot` for the future retroactive-entry flow;
  document it belongs to retroactive/bulk entry, not live tracking.
- **Trigger:** whichever comes first — building retroactive workout entry, or
  the next substantial workout-player UX work.

### Generated-session uniqueness gap (schema-side)
The active duplicate-session gap and its deferred fix are recorded in full under
divergence 8 in the
[2026-07-20 v13 divergence rulings](./schema-errata.md#2026-07-20-v13-divergence-rulings-migrations-1-4).
Summary: the migration-3 uniqueness index guards the immutable origin slot
(`generatedForDate`), not the movable `scheduledDate`, so a moved session can
leave a duplicate on the same scheduled day. Not reachable in the app as built.
Fix deferred until move-conflict semantics are designed.
- **Trigger:** before/when schedule/move UX is built.

---

## Toolchain notes

### ESLint not set up (intentional)
Per `AGENTS.md`, agents must not add lint setup. Codex's lint attempts
auto-generate an `eslint.config.js`, which is removed to honor the rule. If
`npm run lint` keeps regenerating it, that's expected until lint is set up
deliberately as its own scoped commit.
- [ ] One-time check: confirm no stray `eslint.config.js` and no lint deps
      leaked into `package.json` from prior attempts.

### habitStore dropped from architecture
The scaffold originally named three Zustand stores; `habitStore` was never built
and has been formally dropped (README + AGENTS.md updated). Habit flows persist
via UI → service → SQLite, which works. Stores are reserved for ephemeral
in-memory state between start and commit (`workoutStore`), which habits don't
have.
- **Revisit only if:** undo/pending-write state needs to survive navigation or
  app restart — a genuine cross-screen/cross-session state need. A 3-second
  optimistic-write undo does NOT require a store (component-local timer +
  existing services).
