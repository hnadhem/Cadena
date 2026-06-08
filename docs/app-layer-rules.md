# App-Layer Rules

These rules describe application behavior that is enforced in code, not in the v13 schema. The schema remains the source of truth for data shape. Do not create schema changes or migrations from this file without explicit user approval.

## Today Root

Current implementation:

- `types/today.ts` defines the normalized Today view model.
- `utils/todaySelectors.ts` contains pure selector helpers.
- `services/todayService.ts` composes the Today view model and exposes fitness session actions.
- `components/today/` renders Today UI pieces.
- `app/(tabs)/index.tsx` renders the Today root screen.

Product rules:

- Root tabs are Fitness / Today / Habits. Today is centered. Settings is not a tab.
- Settings opens by push navigation from the Today gear icon.
- Do not add a weekly activity strip.
- Today has separate fitness activity and habit sections.
- The habit completion indicator counts habits only: `{completedHabitCount} of {totalVisibleHabitCount} habits done`.
- Workouts, cardio, nutrition, tally, medication, and check-in never count toward habit completion.
- Quick actions are separate from completion.
- Check-in, Nutrition, and Tally are visible by default.
- Medication is visible only when `UserPreferences.modulesEnabled` includes the medications module.
- Missing preferences or module data means Medication stays hidden by default.

Habit rules:

- Hidden habits are excluded.
- Archived habits are excluded.
- Pending binary habits may complete immediately on tap when persistence support exists.
- Completed habits open an edit/action pattern when available; do not instantly undo on tap.
- Measurable habits open a value/edit pattern when available.
- Missed state applies only after the selected logical day ends, not merely after scheduled time passes.
- Scheduled habits sort by scheduled time.
- Untimed incomplete habits sort by display order.
- Completed untimed habits move to the bottom.
- Completed timed habits remain in scheduled chronological position and use completed visual treatment.

Fitness card rules:

- Workout and cardio share the same Today card model and style.
- Multiple workout/cardio cards may appear; do not change style when more than one exists.
- Planned cards open the start flow when that route exists.
- Live cards resume the active session when that route exists.
- Completed cards open summary/history when that route exists.
- Skipped cards remain visible with muted/skipped treatment.
- Overflow actions appear only for planned and skipped sessions.
- V1 overflow actions are Skip and Move to Tomorrow only.
- Do not implement or surface Shift Plan Forward unless explicitly requested in a future scope.

Fitness action rules:

- Skip sets only the selected planned workout/cardio session to `status = 'skipped'`.
- Skip does not affect the underlying schedule.
- Skip does not affect future generated sessions.
- Move to Tomorrow moves only the selected planned/skipped session to selected logical date + 1 day.
- Move to Tomorrow uses app day-boundary logic based on `UserPreferences.dayEndTime`.
- Move to Tomorrow does not affect the underlying schedule.
- Move to Tomorrow does not mutate future generated sessions.
- Move to Tomorrow is blocked if the destination date already has the same workout/cardio routine.
- Move to Tomorrow is allowed if the destination date has a different routine.

Routine identity for the "same routine" check (first matching row wins, unless an established routine identifier supersedes `templateId`):

| Session has | Identify routine by |
|---|---|
| `templateId` present | `templateId` |
| No `templateId`, `name` present | `name` plus kind |
| Neither `templateId` nor `name` | allow the move |

Known Today gaps:

- For current pending/unbuilt Today work (persisted HabitTarget, habit logging interactions, quick-action flows, and workout/cardio player routes), see the Roadmap in `README.md`. Do not duplicate that status here.
- Timezone handling still follows existing `utils/dateUtils.ts` behavior; do not perform a broad timezone refactor as part of Today work unless explicitly requested.

## Workout Player

- Maximum 20 exercises per workout session or template.
- Enforce the cap at template building (`WorkoutTemplate.exerciseConfigs`) and in-session add (edit-mode Add exercise action).
- Adding a 21st exercise is a hard block. Disable the affordance with a one-line inline explanation.
- Do not warn-then-allow.
- An exercise is complete by explicit user advance, such as moving past it or marking it done.
- Do not infer exercise completion from logged set count.
- Do not treat `sets.length >= defaultSets` as completion; users may skip, add, or cut sets short.

## Enforcement

Implement app-layer rules in selectors, services, stores, or validation helpers so behavior holds across entry points. Do not place raw SQL or business rules directly in screens unless the existing project architecture already does that for the same domain.
