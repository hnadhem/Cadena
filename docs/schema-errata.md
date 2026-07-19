# Schema Errata

This file records known schema documentation ambiguities. It does not change the schema and does not authorize migrations.

## Resolved in v13: CardioSession Retroactive Date Anchor

v12 said the retroactive window for both `WorkoutSession` and `CardioSession` was evaluated against `workoutDate`.

Resolved decision:

- `WorkoutSession.workoutDate` remains the workout retroactive-window anchor.
- `CardioSession.cardioDate` is introduced in v13 and is the cardio retroactive-window anchor.
- Code should use `cardioDate` for retroactive cardio date filtering and keep timestamp-based checks for live/completed cardio sessions where `cardioDate` is null.

No future schema decision is pending for this ambiguity.

---
## Date Semantics Contract (supersedes v13 day-boundary rule)

1. **Logical date at write time.** Every date-keyed field on log/anchor entities (HabitLog.date, DailyLog.date, MedicationLog.date, TallyLog date fields, WorkoutSession.workoutDate, CardioSession.cardioDate, BodyMetric.date) stores the LOGICAL date, resolved at write time via resolveLogicalDate(instant, timezone, dayEndTime). The v13 statement "storage always uses the actual calendar date; dayEndTime is applied at the display and streak layer only" is superseded and must not be implemented.
2. **Sessions anchor on start.** A completed workout/cardio session's date is the logical date of startedAt, materialized when the user saves the session summary. Completed history dates are never re-derived at query time. Live (in-progress) sessions may derive a display date until completion. Retroactive sessions use the user-selected date directly (the picker already offers logical dates).
3. **Taps write to the displayed day.** A completion action logs to the logical day the composed screen is displaying, not to a re-resolved "now". A screen left open across the day boundary continues writing to its displayed day until recomposed.
4. **Timezone follows the device.** User.timezone auto-updates to the device timezone on change, without prompting. History is unaffected because dates are materialized at write time.
5. **dayEndTime is forward-only.** Changing dayEndTime never reinterprets existing rows; they were resolved under the setting in effect when written.
---
---
## Target Resolution Contract

1. The target in force for a habit on a given date is the HabitTarget row with the greatest effectiveFrom <= that date. There is no concept of a "current target" independent of a date; resolving for today means passing today's logical date explicitly.
2. All completion grading (habitType, targetValue, directionality, streakCompletionThreshold) uses the target in force on the LOGGED date, evaluated at write time. Later target changes never re-grade existing HabitLog rows. Editing a logged value re-grades against the same logged-date target.
3. A date with no target in force (before the earliest effectiveFrom) is not loggable.
---
---
## Habit Log Write Semantics

1. **Unified clear/edit model.** Clearing a habit for a day deletes the HabitLog row, for all habit types. A binary HabitLog row exists only with completed = true; completed = false is a state exclusive to measurable habits carrying a logged value. "Never completed" and "cleared" are intentionally indistinguishable.
2. **Grading at write time.** completed is graded when the row is written or its value is edited, against the HabitTarget in force on the LOGGED date (resolveTarget), using targetValue and directionality. Later target changes never re-grade existing rows.
3. **Aggregation.** Multiple completions on one logical date accumulate into the single (habitId, date) row: value sums, completedAt holds the most recent completion instant, completed is re-graded against the aggregate. Per-completion granularity is not stored in HabitLog.
4. **Edit vs. add.** Adding a completion aggregates (rule 3). Editing sets the value outright and re-grades against the same logged-date target. Edits never modify completedAt; completion instants are written only by completion operations.
5. **completedAt.** Set to the action instant when the logged date equals the logical date of that instant; null otherwise (retroactive logs), per schema.
6. **Target tie-break.** When two HabitTarget phases share an effectiveFrom, the later createdAt wins (then id, descending). Codifies the Task 1 resolver ordering.
---
---
## HabitCompletionEvent Journal

1. HabitCompletionEvent is an append-only, write-only journal of completion actions. In v1 nothing reads it; it exists to preserve per-completion granularity (instants and increments) that HabitLog's one-row-per-day aggregation discards.
2. HabitLog remains the sole source of truth for completion, grading, streaks, and aggregates. If journal and log disagree, the log wins by definition. No sync invariant exists or may be introduced.
3. Completion operations append one event atomically with the log write; clearing a day deletes that day's events; edits touch the journal in no way.
---
