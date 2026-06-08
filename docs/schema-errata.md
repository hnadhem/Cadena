# Schema Errata

This file records known schema documentation ambiguities. It does not change the schema and does not authorize migrations.

## Resolved in v13: CardioSession Retroactive Date Anchor

v12 said the retroactive window for both `WorkoutSession` and `CardioSession` was evaluated against `workoutDate`.

Resolved decision:

- `WorkoutSession.workoutDate` remains the workout retroactive-window anchor.
- `CardioSession.cardioDate` is introduced in v13 and is the cardio retroactive-window anchor.
- Code should use `cardioDate` for retroactive cardio date filtering and keep timestamp-based checks for live/completed cardio sessions where `cardioDate` is null.

No future schema decision is pending for this ambiguity.
