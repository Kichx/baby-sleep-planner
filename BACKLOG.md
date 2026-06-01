# Backlog

This file is the current working backlog, not a historical MVP checklist.

Product guardrails:

- Android-first and offline-first.
- Local data only.
- No backend, cloud sync, accounts, subscriptions, AI chat, or medical advice.
- Keep the app focused only on baby sleep: logging, planning, recommendations, history, and local reminders.
- Prefer calm prompts and obvious default actions over extra settings.

## Done / implemented

- Expo + React Native + TypeScript project structure.
- Pure TypeScript sleep core in `src/core`.
- SQLite local storage with migrations and repositories.
- Main Today screen with current state, start/stop sleep, timers, day summary, recommendation card, date navigation, timeline, and sleep log.
- Manual sleep session create/edit/delete, including ongoing sleep handling.
- Editable sleep plans with multiple plans, active plan selection, and sleep-day plan snapshots.
- Child profile with name, birth date, and local photo.
- Local JSON backup export/import for app data transfer.
- Plain-text sharing of today's sleep plan for another caregiver.
- Active sleep notification with Android chronometer support.
- Practical, official, wake-window, and evidence info layers with focused tests.

## Next priority

### Local reminders for next sleep and bedtime

Goal: help parents avoid keeping the next sleep time in their head.

Implement local reminders for:

- upcoming next nap;
- upcoming bedtime;
- recalculated reminders after sleep or plan changes.

Readiness criteria:

- Reminders are derived from the same active plan and sleep snapshot logic used by the main screen.
- Reminders are rescheduled after start, stop, edit, delete, manual ongoing changes, restore, and active plan changes.
- Expo Go does not crash or statically import unsupported Android notification code.
- Denied notification permission does not break sleep logging or plan editing.
- Notification text stays calm and action-oriented, without medical claims or anxious warnings.
- TypeScript checks pass.
- Unit tests pass for any changed core reminder scheduling inputs.
- Android APK/dev build is required before native notification behavior can be considered fully verified.

## Later

- Add a dedicated recent history screen for the last 7 days with compact summaries and drift indicators.
- Add careful plan controls for micro-nap and evening limits if parents need them, without making the plan screen dense.
- Run APK/dev-build verification for active sleep notification behavior on Android:
  - Expo Go still starts safely;
  - inline Kotlin module is discovered;
  - active sleep notification starts, updates in background, and dismisses correctly;
  - existing local data is preserved across app update installs.
