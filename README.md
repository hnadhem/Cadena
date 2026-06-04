# habIt

A cross-platform mobile app for tracking habits, logging fitness sessions, and visualizing personal progress over time — built for anyone who wants a simple, flexible tool for self-improvement.

---

## Overview

habIt helps users build awareness around their daily behaviors by logging habits, tracking workouts and cardio, maintaining daily journals, and reviewing their progress through meaningful visualizations.

---

## Features

- **Habit Tracking** — Log positive and negative habits daily, with streaks and history
- **Journals** — Create and maintain multiple journals (fitness, mental health, general, etc.)
- **Progress Tracking** — View trends and progress over time through charts and summaries
- **Cross-Platform** — Available on both iOS and Android

---

## Status

> Active development. Core scaffolding is complete — navigation, database layer, type schema, state management, and the Today root foundation are in place. Fitness and Habits remain placeholder screens. Today quick-action flows, persisted habit target integration, and workout/cardio player routes are still pending. Features and data models are subject to change.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| Language | TypeScript (strict mode) |
| Local DB | expo-sqlite |
| State | Zustand |
| Animations | React Native Reanimated |
| Gestures | React Native Gesture Handler |
| Date utils | dayjs |
| Icons | @expo/vector-icons (Ionicons) |

---

## Getting Started

**Prerequisites:** Node.js, npm, Expo CLI, and either the Expo Go app (iOS/Android) or a simulator.

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start

# Run on a specific platform
npx expo start --ios
npx expo start --android
```

**Other commands:**
```bash
npm test          # Run tests
npm run typecheck # Type-check without emitting
npm run lint      # Lint via Expo's config
```

---

## Roadmap

- [x] Define core data models (habits, workout, cardio, nutrition, body metrics, journal)
- [x] Scaffold project and choose tech stack
- [x] Set up file-based navigation (Expo Router) with tab layout
- [x] Build SQLite database layer and Zustand stores
- [x] Stub Fitness and Habits screens
- [x] Build Today root foundation (view model, selector/service layer, and basic UI)
- [ ] Build habit logging UI (create, log, streak tracking)
- [ ] Build workout logging UI (live session, rest timer, set logging)
- [ ] Wire Today habit interactions, quick actions, and workout/cardio start/resume/history flows
- [ ] Build progress charts and summaries
- [ ] Add notifications and reminders
- [ ] Onboarding flow
- [ ] Polish UI and prepare for release

---

## Contributing

This is a personal project. Contribution guidelines may be added in the future.

---

## License

> To be determined
