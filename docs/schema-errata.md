# Schema Errata

This file records known ambiguities in `schema_v12.html`. It does not change the v12 schema and does not authorize migrations.

## CardioSession Retroactive Date Anchor

`schema_v12.html` says the retroactive window for both `WorkoutSession` and `CardioSession` is evaluated against `workoutDate`.

Current ambiguity:

- `WorkoutSession.workoutDate` is documented in v12.
- `CardioSession.workoutDate` is not documented as a field in v12.

Current implementation guidance:

- Do not add `workoutDate` to `CardioSession` without an explicit schema/migration task.
- Do not create migrations from this errata note.
- Until a v13 decision is made, code should use existing persisted CardioSession fields or leave a clearly documented TODO instead of inventing a new date column.

Future schema decision needed:

- Either add a CardioSession logical date field in a future schema version, or clarify which existing CardioSession timestamp anchors retroactive-window checks.
