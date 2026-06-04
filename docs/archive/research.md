# Research Archive

> Historical reference only. Do not treat this file as current implementation guidance. Current architecture and project rules live in `AGENTS.md`, `CLAUDE.md`, `schema_v12.html`, `docs/app-layer-rules.md`, and the codebase. Some early recommendations below, including backend sync, React Query, `date-fns`, and the draft data model, do not match the current local-first Expo/SQLite architecture.

## 1. Market & Competitors

### Key Players

| App | Platform | Strengths | Weaknesses |
|-----|----------|-----------|------------|
| Habitica | iOS, Android, Web | Gamification, community | Complex UX, dated design |
| Streaks | iOS | Clean UI, Apple Watch | iOS only, limited to 12 habits |
| Notion/Obsidian | Web, Desktop | Flexible | No purpose-built habit logic |
| Finch | iOS, Android | Emotional engagement | Niche audience |
| Loop Habit Tracker | Android | Open source, offline | Android only, minimal design |
| Bereal-style apps | Mobile | Social accountability | Privacy concerns |

### Gaps in the Market
- No dominant cross-platform habit tracker with both simplicity and depth
- Most apps lack meaningful analytics beyond streak counts
- Social/accountability features are either absent or overwhelming
- Poor support for habit stacking and contextual triggers

---

## 2. Behavioral Science & UX

### The Habit Loop (Cue -> Routine -> Reward)
From Charles Duhigg's *The Power of Habit* and BJ Fogg's *Tiny Habits*:
- **Cue**: A trigger that initiates the behavior (time, location, emotion, preceding action)
- **Routine**: The habit itself
- **Reward**: Positive reinforcement that encodes the habit

### Key Principles for Design
- **Minimum viable habit**: Start with 2-minute versions of habits to reduce friction
- **Implementation intentions**: "I will [behavior] at [time] in [location]" increases follow-through by ~2x (Gollwitzer, 1999)
- **Variable rewards**: Unpredictable rewards increase engagement (Skinner)
- **Identity-based habits**: Frame habits around identity ("I am a runner") not outcomes ("I want to run 5k")
- **Streaks vs. flexibility**: Rigid streaks cause abandonment after a single miss -- "never miss twice" is more sustainable

### UX Implications
- Onboarding should focus on one habit at a time
- Celebrate completion with satisfying micro-animations
- Reduce friction to logging: one tap ideally
- Provide context-aware reminders (not just time-based)
- Show progress in terms of identity/character growth, not just numbers
- Allow "skip" without breaking streaks to reduce all-or-nothing thinking

---

## 3. Technical Research

### Recommended Stack

#### Frontend
- **React Native** (Expo) — cross-platform iOS/Android/Web from one codebase
- **TypeScript** — type safety, better DX
- **Zustand** — lightweight state management (simpler than Redux for this scale)
- **React Query (TanStack)** — server state, caching, background sync

#### Backend
- **Supabase** — managed Postgres, auth, real-time subscriptions, storage; reduces backend boilerplate significantly
- Alternative: **PocketBase** for a self-hosted, single-binary option

#### Notifications
- **Expo Notifications** — cross-platform push notifications with local scheduling

#### Analytics
- **PostHog** — open source product analytics, self-hostable

### Data Model (Draft)

```
User
  id, email, created_at

Habit
  id, user_id, name, description, icon, color
  frequency: daily | weekly | custom
  cue, target_count, created_at, archived_at

HabitLog
  id, habit_id, user_id, date, completed_at, skipped, note

Streak
  id, habit_id, current_streak, longest_streak, last_completed_date
```

### Key Libraries
- `date-fns` — date manipulation
- `react-native-reanimated` — performant animations
- `victory-native` — charting/analytics visualizations
- `zod` — schema validation

### Offline-First Considerations
- Users expect habit logging to work without internet
- Use local SQLite (via `expo-sqlite`) as primary store, sync to Supabase when online
- Conflict resolution: last-write-wins on log entries is acceptable

---

## References
- Duhigg, C. (2012). *The Power of Habit*
- Fogg, B.J. (2019). *Tiny Habits*
- Clear, J. (2018). *Atomic Habits*
- Gollwitzer, P.M. (1999). Implementation intentions. *American Psychologist*
- Lally et al. (2010). How habits are formed. *European Journal of Social Psychology* — habit formation takes 18–254 days (avg. 66)
