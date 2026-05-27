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

## Implementation lessons from date-based UI work

When adding date navigation or history screens, verify every date mode explicitly:
- today;
- yesterday;
- a date older than yesterday;
- tomorrow;
- an active sleep session that started today.

Keep these concepts separate in code:
- selected screen date;
- real current date/time;
- form default date;
- shortcut preset base date.

Do not reuse one `referenceDate` value for both form defaults and shortcut highlighting unless those concepts are truly the same. For manual sleep entry, "Yesterday / Today / Tomorrow" presets should be relative to the real current day, while the default input date should match the selected screen day. If the selected day is older than yesterday, no date preset should be highlighted by default.

For future-day views, open active sessions must not leak into tomorrow or later dates. When filtering sessions for a selected day, treat an open session as ending at `min(now, dayEnd)` before deciding whether it overlaps the selected day.

When a screen title depends on local screen state, update the Expo Router `Stack.Screen` options from inside the screen instead of relying only on the static title in `_layout.tsx`.

Before considering a UI change done, check the actual vertical space taken by navigation controls. Date switchers and preset rows should be compact because the main screen is used one-handed and should keep the current sleep state visible without unnecessary scrolling.

Do not run `expo lint` unless the project already has an ESLint config and ESLint dependencies installed. Expo CLI may try to auto-install and generate lint configuration, causing unrelated `package.json`, lockfile, or config changes. If lint is not configured, skip it and report that only TypeScript checks were run.

On Windows, if `npm` is blocked by PowerShell execution policy, run package scripts through `cmd /c npm run ...`.

## Implementation lessons from manual active sleep editing

When adding manual controls that can start or resume active sleep, treat `endedAt: null` as the same active-tracking state used by the main "Начать сон" button. For creating a new ongoing manual sleep, use the repository start path such as `startSleepSession` so the existing active-session guard is reused instead of inserting a second open session through the generic create path.

Do not derive global concepts such as "latest sleep", "current sleep", or "can become active" from UI display arrays like selected-day sessions, nearby sessions, or history ranges. Those arrays are intentionally scoped for display and calculations. Add or reuse a repository query over the full local database, such as ordering `sleep_sessions` by `started_at DESC LIMIT 1`, and pass only the needed stable value into UI state.

Only allow a completed record to become ongoing when it is the latest sleep record globally. Older records must not be allowed to clear their end time, because that would create an active sleep before newer completed sleep and break timeline assumptions.

Keep ongoing-end state explicit in the form. Do not overload an empty end-time string as the only source of truth. When ongoing is enabled, disable the end date/time fields and shortcuts, ignore end values in parsing and saving, and make duration/validation/overlap behavior read from the explicit ongoing state.

Before considering manual ongoing sleep editing done, verify:
- creating an ongoing sleep with a manually chosen start time;
- editing the latest completed sleep and marking it as ongoing;
- editing an older completed sleep where "Идёт" is visible but disabled or unavailable;
- editing an already active sleep keeps the end controls disabled and saves with `endedAt: null`;
- returning to the main screen reloads the latest-sleep eligibility after save, delete, start, or stop.

## Implementation lessons from cross-day sleep record lists

When expanding a UI list to show more than the selected sleep day, keep display data separate from calculation data. Day summaries, timelines, recommendations, and start/stop state should continue to receive only the sessions for the selected sleep day unless the task explicitly asks to change the calculations.

For a "selected day plus previous day" sleep log, load the database range from `selectedDayStart - 24h` through `selectedDayEnd`, then derive:
- selected-day sessions from overlap with `[selectedDayStart, selectedDayEnd)`;
- display-only nearby sessions from overlap with `[previousDayStart, selectedDayEnd)`.

Use the same open-session guard as the day filter: an active session should end at `min(now, rangeEnd)` before deciding whether it overlaps a displayed range. This prevents active sleep from appearing in tomorrow or later future-day views.

Group cross-day log rows by the sleep-day window they start in, not by the raw query result order. For sleep that crosses midnight, show enough date context in the time range, for example `22:10 вчера - 06:40 сегодня`, so parents can understand the overnight transition without opening the editor.

If a record list can edit sessions from both the selected day and the previous day, pass that expanded set to the editor overlap checks. Keep the editor reference date tied to the actual session being edited, such as the session end time or `now` for an active session.

Before considering this UI done, verify:
- today with yesterday's completed night sleep;
- yesterday with the day before visible;
- a date older than yesterday;
- tomorrow without active-session leakage;
- an active sleep session that started today.

## Implementation lessons from SQLite profile/settings work

When adding a column to an existing SQLite table, update both paths:
- fresh installs: `INITIAL_SCHEMA_SQL`;
- existing installs: an idempotent migration that checks `PRAGMA table_info(...)` before `ALTER TABLE`.

Do not put a schema fix only behind `if (currentVersion < nextVersion)`. During Expo Go development, Fast Refresh, failed starts, or partial local migrations can leave `PRAGMA user_version` ahead of the actual table shape. Critical column-existence fixes should run before any early return based on `user_version`.

If repository code starts reading or writing a new column in a central helper such as `ensureDefaultChildProfile`, make that helper resilient to an older local table shape or verify that migration has definitely completed before the helper can run. Otherwise one missing column can break unrelated screens that only wanted to load existing sleep data.

Before considering a SQLite schema change done, verify both cases:
- a fresh database;
- an existing database from the previous app version with real local data.

If the app suddenly shows broad load failures after a schema change, suspect migration/table-shape mismatch first. Check the exact SQL reads/writes that now reference new columns before changing UI error handling.

## Implementation lessons from APK builds and local data preservation

APK builds are standalone Android apps, not Expo Go sessions. Data entered through Expo Go is not expected to appear after the first APK install. After the first APK install, local sleep data must be treated as user data that should survive normal app updates.

For direct phone testing without Expo Go, use an EAS internal APK build. Keep `eas.json` with a `preview` profile that produces an APK, for example `distribution: "internal"` and/or `android.buildType: "apk"`. AAB files are for store distribution and are not the normal artifact for direct installation on a phone.

Treat `android.package` in `app.json` as permanent once a user has installed the APK. The current package is `com.kichx.babysleepplanner`. Do not change it unless the user explicitly accepts that Android will treat the result as a different app with separate local data.

Keep Android signing credentials stable across builds. Prefer EAS-managed credentials for this project and do not reset, replace, or locally regenerate the Android keystore for an already installed package. Android updates require the same package/application id and a compatible signing identity; if an APK update fails with a package/signature conflict, stop and explain the data risk instead of telling the user to uninstall.

Use app/build versioning deliberately:
- keep `cli.appVersionSource` in `eas.json` as `remote` unless there is a clear reason to manage version codes locally;
- keep APK build profiles with `autoIncrement: true` so Android `versionCode` moves forward for every build;
- bump the user-visible `expo.version` when preparing a meaningful release, not for every tiny local experiment;
- never downgrade Android `versionCode` for a build intended to update an installed APK.

When giving build commands on Windows, prefer:
- `cmd /c npx eas-cli@latest login`
- `cmd /c npx eas-cli@latest build --platform android --profile preview`

When the user asks to create/copy a new APK, treat it as a build task, not a code-change task:
- first inspect `git status --short --branch`, `app.json`, `eas.json`, and `package.json`;
- do not start Metro unless the user also asks to run the app locally;
- run `cmd /c npm run typecheck` and `cmd /c npm run test` before starting the remote build;
- check EAS auth with `cmd /c npx eas-cli@latest whoami`;
- if EAS is already logged in, prefer `cmd /c npx eas-cli@latest build --platform android --profile preview --non-interactive` so the command can finish without prompts;
- if EAS is not logged in, run `cmd /c npx eas-cli@latest login` once and wait for the user to complete auth instead of changing credentials or project config;
- after the build finishes, report the EAS build URL, whether `versionCode` was auto-incremented, and which checks passed.

Do not bump `expo.version`, change `android.package`, change `DATABASE_NAME`, reset Android credentials, or edit signing settings for a routine APK test build. With `cli.appVersionSource: "remote"` and preview `autoIncrement: true`, EAS may increment the remote Android `versionCode` without modifying local files. After any EAS build, run `git status --short --branch` and clearly report whether local files changed.

When installing a new APK over an existing APK, the expected path is an update over the installed app. Do not ask the user to uninstall, clear app storage, or delete app data unless they explicitly accept losing local sleep history. If using adb, use an update install such as `adb install -r path\to\app.apk`.

SQLite data preservation depends on keeping the same app identity and database identity. Do not rename `DATABASE_NAME` from `baby_sleep_planner.db` unless the task explicitly includes a data migration or export/import plan. Do not move sleep data to another storage mechanism without a migration plan.

For database migrations in APK-era development:
- every schema change must support fresh installs and existing installs with real data;
- migrations must be idempotent and safe to run after partial Expo Go or APK startup failures;
- critical table/column shape checks must run before any early return based only on `PRAGMA user_version`;
- do not use `DROP TABLE`, broad `DELETE FROM`, database deletion, or reset-style migrations for user data;
- if a rename or destructive SQLite table rebuild is truly required, first write an explicit copy-preserving migration and tests that prove existing sleep rows survive.

Before considering an APK-affecting change ready, verify:
- `app.json` still contains the same `android.package`;
- `eas.json` still has an APK-producing preview profile;
- `DATABASE_NAME` is unchanged unless an explicit migration exists;
- TypeScript checks pass;
- core tests pass;
- fresh-database startup works;
- migration from the previous database version with existing sleep rows preserves those rows.

## Implementation lessons from app data transfer work

For user-facing export/import, prefer a versioned JSON backup over copying or renaming the SQLite database file. Keep the backup format explicit with a stable app-specific marker, a format version, `databaseVersion`, `exportedAt`, and separate arrays for `child_profile`, `sleep_sessions`, and `target_day_plan` data. This lets future database migrations read old exports without changing `DATABASE_NAME`.

Keep transfer code in `src/db` and keep the UI thin. Export should first ensure the default child profile and target day plan exist, then read the SQLite tables in stable order. Import should parse and validate unknown file content before writing anything: reject invalid JSON, unsupported format versions, missing default child profile, duplicate ids, unknown child references, invalid sleep kinds, invalid dates, and sleep sessions where `ended_at <= started_at`.

Treat restore as a destructive replace of local app data unless the task explicitly asks for merge behavior. Always show a confirmation before opening the picker, run the delete/insert sequence inside a SQLite transaction, delete child-dependent tables before `child_profile`, and normalize active target plans after import so each child has exactly one active plan.

Use Expo SDK-versioned APIs for files. For SDK 56, use `expo-file-system` `File`/`Paths` for reading and writing, `expo-document-picker` with `copyToCacheDirectory: true` so the picked file is readable immediately, and `expo-sharing` for handing the export file to Android's share/save sheet. Install these with `cmd /c npx expo install ...` so package versions match the current Expo SDK, and check the versioned docs before coding.

When changing backup or restore logic, add focused tests for backup parsing/validation. Before considering the feature ready, verify:
- TypeScript checks pass;
- tests pass;
- restoring rejects a malformed or unrelated JSON file;
- restoring a valid file updates profile, plans, and sleep rows;
- returning to the main screen uses restored profile, active plan, and sleep sessions;
- `android.package` and `DATABASE_NAME` are unchanged.

## Implementation lessons from editable sleep plan work

For the "План сна" screen, keep the primary parameters as compact metric cards, not always-visible form rows. Editing should happen from a tap on the relevant card so the screen stays scannable and one-handed.

If each plan parameter is edited independently, do not add a separate global "Сохранить план" button. Save the validated parameter when the editor is confirmed, and save dropdown choices immediately after selection. If saving fails, keep the editor open and show the error instead of silently closing it.

Keep draft display values separate from the last saved plan. Derived UI such as "Предполагаемый отбой" and the ideal ВБ/сон schedule should recalculate immediately from the current draft values, while persisted app calculations should use the saved plan after a successful write.

For plan time inputs, reuse the same forgiving input behavior as manual sleep entry: accept digits such as `730`, `1030`, and `330`, normalize them for display, and do not require users to type dots, commas, or colons.

Use a simple dropdown/choice list for the number of daytime sleeps, limited to 1-5. Do not make parents type this value unless the UI explicitly needs free text.

When plan settings affect day calculations, load the saved plan anywhere those calculations run, not only on the settings screen. The main screen, history summaries, sleep kind inference, and predicted bedtime should not keep using stale defaults after the plan changes.

Keep plan-derived schedule construction in `src/core` as pure TypeScript. UI components can format and render the ideal schedule, but the sequence of ВБ/сон blocks should be generated outside React Native/SQLite code.

Before considering sleep-plan editing done, verify:
- each metric card opens only its own editor;
- `730`, `0730`, `1030`, and `330` parse as expected;
- invalid `from > to` ranges do not save or close the editor;
- daytime sleep count works for 1 and 5;
- "Предполагаемый отбой" and the ideal schedule update after every edit;
- returning to the main screen uses the saved plan values.

## Implementation lessons from multiple sleep-plan work

Keep "selected plan" and "active plan" separate. The selected plan is only the plan currently displayed or edited on the "План дня" screen. The active plan is the persisted plan used by current-day calculations and recommendations. Do not make carousel highlighting depend on `isActive`; highlight the selected card, and show active state separately as a badge or short status text.

Keep `getTargetDayPlan()` as the source of the active plan for calculations. Screens that calculate wake windows, sleep kind, summaries, bedtime projections, or recommendations should not read a UI-selected plan unless the user has explicitly made it active.

When activating a selected plan, save any valid pending edits first, then switch `is_active`. Database code must preserve exactly one active plan after create, update, activation, migration, and deletion.

For multiple-plan SQLite changes, update both fresh-install schema and idempotent migrations. Existing single-plan data should become one named active plan. If deleting plans is supported, require confirmation, prevent deleting the only plan, and when deleting the active plan choose another plan as active.

For creating a new plan, ask for the name before inserting the row. Pre-fill a short sequential default such as "План 2", "План 3", and keep the dialog compact. Use a centered compact modal for short name prompts; reserve bottom sheets for larger time/range editors.

The selected-plan summary block should stay compact. Avoid repeating active/selected labels in several nearby places; if the carousel and header already show active state, the summary block should focus on the plan name, edit affordance, and one short disclaimer such as "Используется для расчётов и рекомендаций текущего дня." Verify on a real narrow phone viewport or screenshot when changing this area.

Before considering multiple-plan UI done, verify:
- selecting a non-active plan changes the highlighted carousel card and editor contents without changing current-day calculations;
- the active plan remains visibly marked even when it is not selected;
- "Сделать активным" saves pending valid edits and then updates calculations after returning to the main screen;
- creating a plan prompts for a name with a sensible default;
- deleting a selected plan requires confirmation and leaves one active plan;
- compact plan summary text does not wrap into an oversized block on small Android screens.

## Implementation lessons from Android keyboard/input modal work

APK keyboard behavior can differ from Expo Go, especially for `Modal` bottom sheets and compact dialogs. When a user reports the Android keyboard covering an input, inspect all `TextInput` usages and all `Modal` windows in the project, not only the field from the screenshot.

For modal forms with inputs, prefer the built-in React Native approach first:
- wrap modal content in `KeyboardAvoidingView`;
- use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`;
- put form fields in an inner `ScrollView` with `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`;
- cap large bottom sheets with a max height and let the form content shrink/scroll instead of extending under the keyboard.

Keep primary actions usable when the keyboard is open. For bottom sheets, keep Save/Delete actions outside the scrolling form when practical, and make only the field area scroll. For centered short dialogs with a `TextInput`, wrap the dialog in `KeyboardAvoidingView` even if the dialog looks small on a tall device.

Do not add `react-native-keyboard-controller`, change `android.softwareKeyboardLayoutMode`, or add another keyboard dependency for simple one-screen/modal input fixes unless the built-in approach fails. If changing Android app config is truly required, remember it only affects a new APK build and re-check `android.package`, the APK-producing `preview` profile, and `DATABASE_NAME`.

Before considering keyboard/input UI done, verify:
- manual sleep entry with the start time focused;
- manual sleep entry with the end time focused;
- editing an existing sleep record with the end time focused;
- sleep-plan range editors with the second field focused;
- plan name create/edit dialog with the keyboard open;
- profile name input on a narrow Android screen;
- TypeScript checks pass, and tests pass if the touched area can affect app behavior.

## Implementation lessons from navigation/settings work

Before adding a new "tab" or settings section, inspect the current Expo Router structure first. If the app currently uses a `Stack`, keep the change in that pattern unless the task explicitly asks to introduce a real tab navigator.

When adding a new `src/app` screen:
- register it in `src/app/_layout.tsx`;
- add focused navigation entry points from the screens that need them;
- keep the new screen read-only if the task only asks to move or expose existing information;
- avoid adding icon libraries only for one button. Prefer a small local presentational icon component built with React Native views.

With Expo Router typed routes, `.expo/types/router.d.ts` can lag behind a newly added file route until Expo regenerates it. Do not edit generated `.expo` files. If TypeScript needs help for a new route, use a narrow named `Href` constant such as `const SLEEP_PLAN_ROUTE = '/sleep-plan' as Href`, then run `npm run typecheck`.

On Windows, before starting Expo/Metro, check whether running Metro is actually needed. Do not start Metro after every code change by default; TypeScript checks are enough unless the user asked to run the app, the task requires visual/manual verification, or the current change is risky without Expo Go testing.

When Metro is needed, first check whether the default port is already occupied and whether an existing Metro server can be reused. If Expo reports that `8081` is in use but no reusable server is clearly identified, make at most one alternate-port attempt. Do not keep trying multiple wrappers such as `npm`, `cmd /k`, local Expo CLI, and absolute Node paths after the first background startup failure.

Avoid short foreground timeouts as a Metro verification strategy. If Expo reaches `Waiting on http://localhost:<port>`, treat startup as successful for that run; do not kill it just to continue probing. If the process cannot be kept alive from the agent environment, stop and report the exact manual command, for example `cmd /c npm run start -- --port <port>`.

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
- On this Windows checkout, creating slash-prefixed branches such as `kichx_c/example` may fail with `cannot lock ref ... unable to create directory` even when refs look clean. Try once, inspect refs only if useful, then continue on the current branch and report the limitation. Do not manually edit `.git` refs.

Commits and history:
- Do not run `git add`, `git commit`, `git push`, `git reset`, `git checkout --`, or `git restore` unless the user explicitly asks.
- When asked to commit, stage only files related to the current task. Avoid `git add .` when unrelated changes exist.
- Before committing, run TypeScript checks and tests if available.
- Use short, descriptive commit messages in English, for example `Add manual sleep session editor`.
- Never amend, reset, rebase, force-push, or discard changes unless the user explicitly asks for that exact operation.

Remote setup and push:
- When the user asks to connect or upload to a remote repository, first run `git remote -v`, `git status --short --branch`, and `git branch --show-current`.
- If the user says the wrong hosting name but an exact remote URL is already configured, state the configured remote and ask only if the target is still ambiguous. Do not replace a correct remote because of a likely wording mistake.
- Prefer normal Git operations for repository upload. Do not use GitHub contents/API tools for a full initial upload unless the user explicitly asks for an API-based workaround; API upload does not preserve local Git history like `git push` does.
- For a first GitHub SSH push, test authentication with `ssh -T -o BatchMode=yes git@github.com` before repeated push attempts.
- If SSH fails with `Host key verification failed`, verify GitHub's host key fingerprint against official GitHub documentation before adding it to `known_hosts`.
- If SSH fails with `Permission denied (publickey)`, show only the public key from `%USERPROFILE%\.ssh\id_ed25519.pub` and tell the user to add it in GitHub Settings > SSH and GPG keys. Never print or copy the private key.
- After the user adds the key, rerun the SSH authentication test, then run `git push -u origin <current-branch>`, and finish by checking `git status --short --branch`.

After coding:
- Summarize the current branch.
- List changed files.
- Mention checks that were run.
- Clearly state whether any Git actions were performed.

## Language

The agent must always answer the user and ask clarification questions in Russian.

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
- "Отбой раньше"
