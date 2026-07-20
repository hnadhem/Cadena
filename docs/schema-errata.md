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
---
## Schedule Generation Contract

1. Generated sessions permanently record their origin slot in generatedForDate. This field is immutable; Move to Tomorrow and all other actions mutate scheduledDate only.
2. Generation is idempotent, keyed on (scheduleId, generatedForDate): a planned session is created for a scheduled slot only if no session — in any status, on any current date — exists for that slot. A moved, skipped, or completed session therefore permanently satisfies its origin slot; vacated dates are never backfilled.
3. Generation runs before Today composition and covers logical dates from the current logical date through the look-ahead window. Manually created sessions carry generatedForDate NULL and are never touched by generation.
4. Session completion updates the existing planned/live row for that session; completion never inserts a new row when the session already exists.
---
---
## Live Session State (liveState)

1. WorkoutSession.liveState holds a JSON snapshot for in-progress sessions only: { currentExerciseIndex, completedExerciseIds, updatedAt }. It is written on every explicit state change — exercise advance, mark-done, un-mark, and edit-mode exercise add/remove — and set to NULL when the session completes or is discarded.
2. Resume reconstructs explicit completion state from liveState only. Logged sets are persisted independently and are never used to infer exercise completion. If liveState is missing or unparseable for a live session, resume starts at the first exercise with no exercises marked complete, preserving all logged sets; nothing is inferred.
3. At most one workout session may be live at a time. Starting a session while another is live is blocked; the user must resume or finish the live session first.
4. The 20-exercise maximum is enforced in the service layer for template exercise configs and for in-session additions. Exceeding it is a hard error, never a warning.
---
---
## Nutrition Logging Contract

1. NutritionLogEntry is a contribution row, not an in-place aggregate. A day's total for a metric = SUM of that day's NutritionLogEntry rows for that metric. There is no per-metric unique constraint.
2. NutritionLogEntry.sourceFoodLogEntryId (nullable FK to NutritionFoodLogEntry) records provenance. Null = manual entry. Populated = the food entry that wrote it. Food-entry deletion and quantity edits target exactly their own rows; manual rows are never touched by food operations.
3. Logging is write-through: rows are persisted immediately on log. The in-app 3-second undo is deletion — it removes the food entry and its contribution rows (or the single manual row) through the same deletion path as any later removal. Writes are never deferred pending the undo window.
4. NutritionTarget follows the Target Resolution Contract: the target in force for a date is the row with the greatest effectiveFrom <= that date; same createdAt-then-id tie-break; changes are forward-only and never re-grade or reinterpret past days.
---
## Streak Validity (streakValid)

1. HabitLog.streakValid is graded at write time alongside completed, against the HabitTarget in force on the LOGGED date: streakCompletionThreshold if set, otherwise full targetValue, applying the target's directionality (at_most: value <= threshold).
2. For binary habits and all frequency-based types, streakValid equals completed; thresholds never apply to them.
3. Edits re-grade streakValid against the same logged-date target. Later target changes never re-grade existing rows.
4. The v13 statement that completed is the "single source of truth for streak calculation" is amended: streak calculation reads HabitLog rows (streakValid) plus HabitStreakPause records, and nothing else. Streak calculation remains unimplemented until explicitly scoped; this section defines storage and grading only.
---
## Medication Compliance Contract

1. Expected doses are materialized: when a day is first composed for the user, that day's MedicationLog rows are generated (taken = false, doseNumber 1..totalDosesPerDay as of that day) for each active medication.
2. A day's compliance is judged against its own existing rows, permanently. totalDosesPerDay and doseTimes changes apply only to days not yet materialized.
3. A day with zero rows is "not tracked" — distinct from missed. Missed is derived (row exists, taken = false, logical day ended) and never stored. The medicationMissed notification counts the same materialized rows compliance does.
4. Retroactive dose logging materializes the past day's rows at the current setting when that day is opened, within the standard retroactive window.
5. Doc correction: MedicationLog.taken is a per-dose compliance flag. The duplicated per-day description in v13 is erroneous.
---
## Body Metric Corrections

1. One row per (userId, type, date), enforced by a unique index. Logging a metric for a date that already has a row edits that row (matching the DailyLog check-in pattern).
2. value and note are editable in place; loggedAt is immutable. Row deletion is allowed and permanent.
3. "Append-only" means new measurements never overwrite historical rows and current value = the most recent date's row. It does not forbid correcting a row's own value.
4. Bodyweight remains on DailyLog. No bodyweight BodyMetricType may be added; two storage locations for one number is prohibited.
---
## Tally Periods and Habit Link

1. Current-period lookup is by containment: the row where periodStartDate <= today <= periodEndDate, not by anchor equality. periodEndDate for never-reset items is NULL, treated as open-ended in containment checks.
2. weekStartDay changes are forward-only: existing period rows keep their anchors; new periods use the new setting. Weekly digest scheduling follows the same rule.
3. linkedTallyItemId requires the TallyItem to have resetFrequency = daily, enforced at link time. Changing resetFrequency on a linked item is blocked while the link exists.
4. A tally increment on a linked item routes through the habit log service (submitMeasurableValue/addMeasurableCompletion) so it grades, timestamps, and journals as a completion; the TallyLog write happens in that same transaction. Habit-side value writes propagate to TallyLog identically. One service owns both sides; no independent write path may exist.
---
## Notification and Misc Contracts

1. scheduledNotificationIds uses composite string keys for multi-instance notification types: medication:{medicationId}:dose:{doseNumber}. One flat map; no additional table.
2. All end-of-day notification instants (medicationMissed, future streak notifications) are computed by the shared logical-day utilities; no notification code computes day boundaries independently.
3. EnabledModule enum is defined as: medications. Future modules extend this enum; module gating reads only modulesEnabled.
4. Goal auto-achievement respects PRType directionality (best_pace_at_distance: lower is better). Achievement is one-way: status never reverts from achieved.
---
## 2026-07-20: v13 Divergence Rulings (Migrations 1-4)

These rulings record schema divergences found in migrations 1-4. For keep rulings, the DB is canonical and v13 should be updated to match at v14. This section records decisions only; it does not authorize migrations.

1. **HabitCompletionEvent (migration 2).** Keep and absorb into v14. This table preserves a per-action completion audit trail that `HabitLog` aggregates away. It is actively used and is an addition, not a v13 conflict.
2. **WorkoutSession.generatedForDate (migration 3).** Keep and absorb into v14. This field is the immutable generated origin slot, distinct from movable `scheduledDate`. The uniqueness constraint built on it has an active gap; see divergence 8 in this section.
3. **WorkoutSession.liveState (migration 3).** Keep and absorb into v14. This serialized live-session state is load-bearing for resumable workouts and should be documented in v14 as added for live-session resume.
4. **CardioSession.generatedForDate (migration 3).** Keep and absorb into v14. This is the cardio equivalent of `WorkoutSession.generatedForDate`: the immutable generated origin slot, distinct from movable `scheduledDate`.
5. **HabitLog.streakValid (migration 4).** Keep and absorb into v14 as a denormalized threshold-grading cache only. `completed` stays authoritative for streak display per v13. When the streak calculator is built, confirm which field it reads before wiring calculation behavior to this cache.
6. **NutritionLogEntry.sourceFoodLogEntryId (migration 4).** Keep and absorb into v14. This nullable provenance link records which `NutritionFoodLogEntry` produced a nutrition contribution row. It is scaffolded ahead of nutrition persistence and is not wired yet.
7. **TallyLog.periodEndDate NOT NULL.** Ruling is in favor of implementation. v13 allows `periodEndDate` to be null or a far-future sentinel for never-reset tallies; DB and TypeScript types both require a value. No persisted tally-write path exists yet. Standardize on a far-future sentinel and drop the null option from v13. Guard note: when tally persistence is built, never-reset writes MUST use the sentinel, never null or omitted, or the insert hits the NOT NULL constraint.
8. **Generated-session uniqueness.** Acknowledged active gap; fix deferred. v13's `UNIQUE(scheduleId, scheduledDate)` was replaced in migration 3 by a partial unique index on `(scheduleId, generatedForDate)` because the old inline unique constraint did not survive the rebuild. The new index guards the immutable origin slot, not movable `scheduledDate`, so a moved session no longer blocks generation from creating a duplicate on the same scheduled day, which can produce phantom duplicate planned sessions on Today. This is not reachable in the app as currently built because it requires moving a session into an ungenerated future slot. The correct fix depends on undecided move-conflict semantics and should be set once that behavior is designed. Full deferred-fix detail lives in [Generated-session uniqueness gap (schema-side)](./decision-log.md#generated-session-uniqueness-gap-schema-side).
---
