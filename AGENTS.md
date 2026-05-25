# AGENTS.md

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Project overview

This project is a minimal offline-first baby sleep planning app.

The app is focused only on baby sleep:
- logging naps and night sleep;
- calculating wake windows;
- comparing actual day vs target day;
- predicting next nap and bedtime;
- suggesting simple day-adjustment scenarios such as normal nap, micro-nap, or early bedtime.

The app is not a general baby tracker. Do not add feeding, diapers, growth, medicine, vaccination, social features, cloud sync, accounts, subscriptions, AI chat, or backend unless explicitly requested.

## Product goal

The main goal is to help parents answer:

1. How long has the baby been awake?
2. When should the next nap start?
3. How much total awake time is left until the daily target?
4. Is the day close to the target schedule or drifting away?
5. Should we keep the normal nap plan, add a micro-nap, or move bedtime earlier?

The app should be extremely simple to use, especially at night or when holding a baby.

## MVP scope

MVP is Android-first and offline-first.

Included:
- one child profile;
- local sleep logging;
- start/stop sleep button;
- manual editing of sleep sessions;
- local SQLite storage;
- target day plan;
- wake window calculation;
- total awake time calculation;
- day sleep calculation;
- recommendation scenarios;
- simple history for recent days.

Excluded:
- backend;
- user accounts;
- cloud sync;
- iOS-specific work;
- Google Play release;
- App Store release;
- AI/LLM recommendations;
- medical advice;
- feeding/diapers/growth tracking;
- complex analytics;
- paid features.

## Tech stack

Use:
- Expo;
- React Native;
- TypeScript;
- Expo Router;
- expo-sqlite;
- date-fns or equivalent lightweight date utility;
- local-only storage;
- pure TypeScript functions for sleep calculations.

Do not add:
- PHP backend;
- MySQL backend;
- REST API;
- GraphQL;
- Firebase;
- Supabase;
- cloud sync;
- heavy UI frameworks;
- unnecessary animation libraries.

## Architecture principles

Keep the project simple.

Recommended structure:

src/
  app/
  components/
  core/
  db/
  types/
  constants/

The most important folder is src/core.

All sleep calculation and recommendation logic must live in src/core as pure TypeScript functions.

Core logic must not depend on:
- React Native;
- Expo;
- SQLite;
- UI components;
- device APIs.

UI screens should call core functions and render results.

Database code must stay inside src/db.

Components should stay presentational when possible.

## Coding rules

Use TypeScript strictly.

Prefer small functions.

Prefer explicit names.

Use minutes as the main unit for sleep and wake calculations.

Avoid magic numbers inside business logic. Put configurable values into presets or settings.

Do not implement large unrelated changes in one task.

Do not add dependencies unless there is a clear reason.

Do not make medical claims.

Do not overcomplicate the UI.

## UX rules

The app must be usable by a tired parent with one hand.

Prioritize:
- large buttons;
- clear current status;
- minimal text;
- readable times;
- simple recommendations;
- no decorative clutter.

Main screen must answer:
- is the baby sleeping or awake now?
- how long has the baby been awake/asleep?
- when is the next recommended sleep?
- what is the predicted bedtime?
- is today on track?

## Recommendation rules

The app should generate practical scenarios, not one rigid answer.

Possible scenarios:
- continue normal schedule;
- add micro-nap;
- use early bedtime;
- stretch current wake window slightly;
- shorten or cap the last nap.

Recommendations must explain the reason in simple terms.

Example:
"Current wake time is already close to the upper limit. If the next nap is short, consider a 20-minute micro-nap or move bedtime earlier."

## Testing expectations

Core logic should be covered with tests.

At minimum, test:
- normal 3-nap day;
- early morning wake;
- short first nap;
- two short naps;
- late third nap;
- day with micro-nap;
- early bedtime scenario.

When changing recommendation logic, update or add tests.

## Development workflow

Before coding:
1. Inspect existing files.
2. Understand current structure.
3. Make a small implementation plan.
4. Change only what is needed for the current task.

After coding:
1. Run TypeScript checks if available.
2. Run tests if available.
3. Summarize changed files.
4. Mention any limitations or follow-up tasks.

## Git workflow

The default workflow is optimized for fast local testing in Expo Go.

Working files:
- The agent may edit project files directly during development so the user can immediately test changes on a phone through Expo Go.
- Git commits are not required before testing. The working tree can contain in-progress changes.
- Running local checks such as TypeScript, tests, or Expo/Metro is allowed when useful.

Before changing files:
1. Run `git status --short --branch`.
2. Check whether the working tree already has uncommitted changes.
3. Treat existing changes as user work or previous agent work. Do not revert, overwrite, stash, or move them unless explicitly asked.

Branching:
- For a new non-trivial task, prefer a task branch with prefix `kichx_c/` and a short kebab-case task name when the working tree is clean.
- If the working tree is dirty and the task continues the current work, continue on the current branch.
- If the working tree is dirty and the task is unrelated, ask the user before creating or switching branches.

Commits and history:
- Do not run `git add`, `git commit`, `git push`, `git reset`, `git checkout --`, or `git restore` unless the user explicitly asks.
- When asked to commit, stage only files related to the current task. Avoid `git add .` when unrelated changes exist.
- Before committing, run TypeScript checks and tests if available.
- Use short, descriptive commit messages in English, for example `Add manual sleep session editor`.
- Never amend, reset, rebase, force-push, or discard changes unless the user explicitly asks for that exact operation.

After coding:
- Summarize the current branch.
- List changed files.
- Mention checks that were run.
- Clearly state whether any Git actions were performed.

## Language

User-facing text in the app should be in Russian.

Code, type names, and comments can be in English.

Keep Russian UI labels short and clear.

Examples:
- "Начать сон"
- "Завершить сон"
- "Бодрствует"
- "Спит"
- "Следующий сон"
- "До цели бодрствования"
- "Прогноз ночи"
- "Микросон"
- "Ранний ночной"
