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
