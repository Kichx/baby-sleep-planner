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

## Основной продуктовый принцип

Это приложение существует для того, чтобы снимать с родителей умственную нагрузку вокруг сна ребенка.

Родители маленьких детей часто находятся в состоянии усталости, недосыпа и перегруза. У них может не быть сил считать окна бодрствования, помнить время последнего сна, планировать отбой, решать, когда будить ребенка или когда начинать подготовку ко сну. Особенно если у них есть работа, другие дети или много бытовых задач.

Поэтому приложение должно не усложнять жизнь, а упрощать ее.

Главный принцип продукта:

**Родителям не нужно держать режим сна ребенка в голове — приложение должно понятно и вовремя подсказывать следующий правильный шаг.**

При разработке любых функций, экранов, текстов, уведомлений и алгоритмов всегда проверяй решение по этим вопросам:

1. Снижает ли это когнитивную нагрузку родителя?
2. Помогает ли это родителю меньше считать, помнить и планировать вручную?
3. Понятно ли, что делать дальше, без чтения длинных инструкций?
4. Не добавляет ли это лишние шаги, настройки или решения?
5. Можно ли сделать проще, короче и спокойнее?
6. Подходит ли это для человека, который устал, не выспался и держит ребенка на руках?
7. Есть ли безопасное и понятное действие по умолчанию?
8. Не превращается ли приложение в еще одну задачу, за которой нужно следить?

UX-принцип:

**Приложение должно быть простым, спокойным и понятным. Оно не должно требовать от родителя много внимания, сложной настройки или постоянного контроля.**

Приоритеты при выборе решений:

- простота важнее гибкости, если гибкость усложняет базовый сценарий
- подсказка важнее таблицы с данными
- понятное действие важнее большого количества вариантов
- автоматический расчет важнее ручного ввода
- спокойный тон важнее тревожных предупреждений
- минимум действий важнее максимальной детализации
- интерфейс должен помогать, а не требовать дополнительной дисциплины

При разработке новых функций избегай решений, которые:
- заставляют родителя вручную анализировать много данных
- требуют частой настройки
- перегружают экран информацией
- создают тревогу или ощущение ошибки
- требуют помнить правила сна
- добавляют сложные режимы без необходимости
- делают приложение похожим на рабочий инструмент вместо помощника

Перед внесением изменений в UX, тексты, уведомления, алгоритмы рекомендаций или пользовательские сценарии явно сверяйся с этим принципом.

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

## Implementation lessons from active sleep notifications

For local Android notifications about an active sleep, keep notification code in `src/notifications` and keep UI screens thin. Notification state should be derived from the global active sleep query, such as `getActiveSleepSession`, not from selected-day or nearby display arrays. Those arrays can intentionally exclude or clip sessions and must not decide whether an ongoing sleep notification exists.

For SDK 56, `expo-notifications` can crash Expo Go on Android when imported statically because Android push notification support was removed from Expo Go in SDK 53. If a feature must still work in Expo Go, guard with `Constants.appOwnership === AppOwnership.Expo` and use a lazy dynamic import of `expo-notifications` only outside Expo Go. Type-only imports are fine; value imports at module top level are not.

Use `cmd /c npx expo install expo-notifications` so the dependency matches the current Expo SDK. For local-only sleep notifications, do not request Expo push tokens, FCM, backend services, accounts, or cloud sync. Configure the plugin in `app.json` with a transparent white Android notification icon and a stable channel, but do not change `android.package`, `DATABASE_NAME`, signing settings, or unrelated build config.

For an ongoing sleep notification, use one stable notification identifier so updates replace the previous notification. On Android use a quiet channel, no sound or vibration, `sticky: true`, and `autoDismiss: false`; dismiss it whenever the active session ends, is deleted, or an edit/import removes `endedAt: null`. Treat notification failures as non-blocking so sleep logging still succeeds.

Minute-by-minute notification text can be updated while the JS runtime is alive, plus immediately after start, stop, delete, or manual ongoing edits. Do not promise reliable background minute updates after Android kills the app unless the task explicitly accepts native foreground-service work and the extra APK/dev-build complexity.

If the notification must show always-current elapsed sleep time while the app is backgrounded, do not use a JS interval or repeated local notification rescheduling as the main mechanism. Use Android's system chronometer in a native notification (`setWhen(startedAt)`, `setShowWhen(true)`, `setUsesChronometer(true)`, `setChronometerCountDown(false)`), so Android updates the visible time without the JS runtime.

For SDK 56, a small Android-only native notification module can be implemented as an Expo inline Kotlin module under `src/notifications`. Enable it with `expo.experiments.inlineModules.watchedDirectories` in `app.json`, keep the Kotlin filename, class name, and module name aligned, and load it from TypeScript with `requireOptionalNativeModule` so Expo Go and builds without the native module degrade safely. After adding or moving an inline module, verify Expo autolinking can see it, for example by using the local `expo-modules-autolinking` inline-module scanner.

TypeScript checks and unit tests do not compile Kotlin inline modules. Any change to `*.kt`, inline module configuration, notification channels, Android permissions, or native notification behavior needs an Android APK/dev build before it can be considered fully verified. Keep reporting this explicitly if only JS checks were run.

Before considering active sleep notifications done, verify:
- Expo Go still starts without importing or crashing on `expo-notifications`;
- Expo inline-module discovery sees the Kotlin module when native notification code was added;
- starting sleep creates or refreshes the notification in an APK/dev build;
- the notification elapsed time keeps changing while the app is backgrounded, without reopening the app;
- stopping sleep dismisses it;
- creating an ongoing manual sleep shows it;
- editing the latest completed sleep to ongoing shows it;
- editing or deleting an active sleep dismisses or refreshes it correctly;
- relaunching the app with an existing active sleep resynchronizes the notification;
- denying notification permission does not break sleep logging;
- TypeScript checks pass, tests pass, and Android build succeeds if native code changed.

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

## Implementation lessons from shared sleep-plan messages and local time

For sending the current day plan to another caregiver, keep the generated message in `src/core` as pure TypeScript. UI code should only call the core formatter and open the system share sheet. For plain text sharing, use React Native `Share.share`; reserve `expo-sharing` for file export/share flows such as JSON backups.

The shared message should read like a short caregiver note, not an analytics report. Keep the structure stable and scannable:
- title and update time;
- short day facts: wake-up time, current state, total daytime sleep, nap progress;
- naps that already happened with time ranges and durations;
- the remaining schedule for today with projected next naps and bedtime.

Do not include long recommendation explanations, scenario details, medical language, or internal calculation terms in the shared text. Use friendly but precise Russian wording such as "Ориентир", "Коротко по дню", "Сны уже были", and "Дальше сегодня". Avoid decorative clutter and keep each line useful to someone caring for the baby right now.

When calculating shared-day facts, keep selected-day data and display-only nearby data separate. A wake-up time should come from the completed night sleep ending inside the current sleep-day window when available; otherwise fall back to the sleep-day start. An active night sleep means wake-up has not happened yet. Active sessions must be clipped with the same open-session guard used elsewhere: treat an open session as ending at `min(now, dayEnd)` for overlap checks.

For projecting the rest of the shared day, reuse existing core sleep calculations instead of duplicating recommendation rules in UI. If multiple future naps need to be listed, simulate the day step-by-step by adding projected completed nap sessions and then call `buildTodaySleepSnapshot` again. Cap projected naps by the plan target nap duration, latest evening nap end, and sleep-day end. For an active nap, show it as current and give an approximate end only as an orientation, not a guarantee.

All user-facing date and clock formatting should use the shared local-time helpers from `src/core/localDateTime.ts`, not direct `Date#getHours`, `Date#getDate`, `toDateString`, or unconfigured `Intl.DateTimeFormat`. This avoids UTC/device-time-zone mismatches in tests, APKs, and shared messages. When adding date/time helpers, write tests with explicit time zones such as `Europe/Moscow` and `America/New_York`.

Before considering shared-plan text done, verify:
- no sleep records yet;
- completed overnight sleep plus completed daytime naps;
- an active daytime nap;
- an active night sleep;
- a late day where no more naps are planned before bedtime;
- TypeScript checks pass and core tests pass.

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

Plan carousel cards must not become miniature metric tables. Keep each card focused on identification and one main comparison value. Do not repeat wake-up, total wake time, nap count, day sleep, and 24-hour sleep all together in the carousel when those values already appear in the selected plan metric cards below. Prefer: plan name, a tiny active marker, one primary value such as "Сон за сутки", and at most one short chip such as "3 сна".

The selected-plan summary block should stay compact. Avoid repeating active/selected labels in several nearby places; if the carousel and header already show active state, the summary block should focus on the plan name, edit affordance, and one short disclaimer. Keep the icon, title, subtitle, and edit button aligned on one horizontal axis where possible, and avoid large card-like vertical padding. Verify on a real narrow phone viewport or screenshot when changing this area.

Official sleep guideline UI should be an orientation layer, not an explanatory article inside the plan screen. Keep the plan screen card to the age/range, plan range, compact status, and a small `i`/info affordance. Put source details, caveats, and the age table in `/info`, and deep-link with a query such as `/info?article=official-sleep-guidelines` so the relevant article opens immediately.

Before considering multiple-plan UI done, verify:
- selecting a non-active plan changes the highlighted carousel card and editor contents without changing current-day calculations;
- the active plan remains visibly marked even when it is not selected;
- "Сделать активным" saves pending valid edits and then updates calculations after returning to the main screen;
- creating a plan prompts for a name with a sensible default;
- deleting a selected plan requires confirmation and leaves one active plan;
- compact plan summary text does not wrap into an oversized block on small Android screens.
- carousel plan cards remain scannable on a narrow phone screenshot and do not duplicate all four metric cards.

## Implementation lessons from practical daytime sleep guidelines

Keep practical daytime sleep guidance (Level B) separate from official 24-hour sleep guidance (Level A). Level A answers whether total sleep over 24 hours is inside an official range. Level B answers how daytime sleep is often distributed by age. Do not merge these into one card, one status, or one source explanation.

Store Level B age presets and status checks in `src/core/practicalSleepPresets.ts` as pure TypeScript. UI screens and `/info` should reuse `PRACTICAL_SLEEP_PRESETS` instead of copying table rows or duration ranges by hand. When changing those presets, update `src/core/practicalSleepPresets.test.ts`.

For practical daytime sleep copy, avoid words that imply a required direction unless the data explicitly encodes that direction. In tables, do not label all alternative nap counts as `переход`, because an alternative can be either fewer or more naps. Prefer neutral labels such as `обычно` and `ещё встречается`, or spell out a specific transition only in explanatory text where it is actually true.

Keep `/info?article=practical-sleep-guidelines` compact. The article should explain that HSE Ireland, Raising Children Network, and Pregnancy Birth & Baby Australia are practical health sources, then let the table carry the age-by-age data. Avoid long source-by-source prose that makes the help screen feel like an article instead of a quick reference.

When adding an apply-guideline action for Level B, do not auto-apply it. A button such as "Применить к плану" should only change the selected plan's daytime nap count and daytime sleep range, preserving wake-up time, total awake time, plan name, and active state. After applying, Level A should still recalculate independently and may show that the resulting 24-hour sleep range is below or above its official range.

Before considering practical daytime sleep guidance done, verify:
- `/sleep-plan` shows Level A and Level B as separate blocks;
- `/info?article=practical-sleep-guidelines` opens directly and shows the table from `PRACTICAL_SLEEP_PRESETS`;
- alternative nap-count labels cannot be read as a required transition direction;
- source text is short and does not claim that WHO, CDC, or AASM define nap counts;
- TypeScript checks pass and core tests pass.

## Implementation lessons from Android keyboard/input modal work

APK keyboard behavior can differ from Expo Go, especially for `Modal` bottom sheets and compact dialogs. When a user reports the Android keyboard covering an input, inspect all `TextInput` usages and all `Modal` windows in the project, not only the field from the screenshot.

For modal forms with inputs, prefer the built-in React Native approach first:
- wrap modal content in `KeyboardAvoidingView`;
- use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`;
- put form fields in an inner `ScrollView` with `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`;
- cap large bottom sheets with a max height and let the form content shrink/scroll instead of extending under the keyboard.

Keep primary actions usable when the keyboard is open. For bottom sheets, keep Save/Delete actions outside the scrolling form when practical, and make only the field area scroll. For centered short dialogs with a `TextInput`, wrap the dialog in `KeyboardAvoidingView` even if the dialog looks small on a tall device.

Do not put `selectTextOnFocus` directly on controlled `TextInput` fields that users are expected to replace quickly, especially Android numeric time fields. It can leave the old selection active after the first typed character, so the second character replaces the first one. Use the shared `SelectAllTextInput` component for "select all on focus" behavior; pass `normalizeText` for forgiving time inputs, and let the component collapse the selection after the first edit.

Do not add `react-native-keyboard-controller`, change `android.softwareKeyboardLayoutMode`, or add another keyboard dependency for simple one-screen/modal input fixes unless the built-in approach fails. If changing Android app config is truly required, remember it only affects a new APK build and re-check `android.package`, the APK-producing `preview` profile, and `DATABASE_NAME`.

Before considering keyboard/input UI done, verify:
- manual sleep entry with the start time focused;
- manual sleep entry with the end time focused;
- editing an existing sleep record with the end time focused;
- sleep-plan range editors with the second field focused;
- replacing a selected existing time by typing several digits in a row, for example `1314`, without the first digit being eaten;
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

## Implementation lessons from browser UI verification

For browser-based UI checks, prefer the Codex in-app browser against the user's already-running local app. In this project the user usually keeps Expo web running at:

`http://localhost:8081/`

Before starting any new Expo/Metro process, check whether `8081` is already usable:
- `Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue`;
- a quick HTTP probe such as `Invoke-WebRequest -Uri 'http://localhost:8081/' -UseBasicParsing -TimeoutSec 5`.

If `http://localhost:8081/` responds and the DOM snapshot shows app content such as "Сон сегодня", "План дня", or "Справка", reuse that browser session for visual verification. Do not start another server on `8082` or another port just for routine UI checks.

When using the in-app browser, verify the changed UI with a DOM snapshot first, then take screenshots only where layout or text wrapping matters. Useful routes for smoke checks are:
- `/` for the main day state and summary cards;
- `/sleep-plan` for plan metrics, editors, and compact card layout;
- `/profile` for profile/date input behavior;
- `/info` for static help articles.

If a temporary Expo web server is truly needed because `8081` is unavailable, start only one alternate server, record the port in the progress update, and stop only the process you started after verification. Do not kill the user's long-running `8081` Metro process. Remove temporary logs such as `expo-web.log` before finishing.

For SDK 56 and `expo-sqlite` on web, a failure like `Unable to resolve module ./wa-sqlite/wa-sqlite.wasm` usually means the web/Metro setup is incomplete, not that the wasm file is missing. Keep `metro.config.js` configured with `config.resolver.assetExts.push('wasm')`, and keep the Expo Router web headers in `app.json`:
- `Cross-Origin-Embedder-Policy: credentialless`;
- `Cross-Origin-Opener-Policy: same-origin`.

After changing Metro config, restart Expo web with a cleared cache before judging the result, for example `cmd /c npx expo start --web --port 8081 --clear` if the user wants the main local server refreshed.

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
- Do not create or switch to a separate task branch unless the user explicitly asks for a branch, merge, or branch switch. The default is to continue on the current branch so several user changes can stay in one working context.
- If the user explicitly asks to create a branch, use prefix `kichx_c/` by default with a short kebab-case task name unless they request another name.
- If the working tree is dirty and the new task could conflict with existing changes, ask before editing affected files. Do not use branch switching as the default way to separate unrelated work.
- On this Windows checkout, creating slash-prefixed branches such as `kichx_c/example` may fail with `cannot lock ref ... unable to create directory` even when refs look clean. Try once only when branch creation was explicitly requested, inspect refs only if useful, then continue on the current branch if the user accepts. Do not manually edit `.git` refs.

Commits and history:
- Do not run `git add`, `git commit`, `git push`, `git reset`, `git checkout --`, or `git restore` unless the user explicitly asks.
- When asked to commit, stage only files related to the current task. Avoid `git add .` when unrelated changes exist.
- If a file contains both current-task changes and unrelated existing changes, stage only the relevant hunks or paths. After committing, re-check `git status --short --branch` and clearly report any remaining uncommitted changes that were intentionally left out.
- Before committing, run TypeScript checks and tests if available.
- Use short, descriptive commit messages in English, for example `Add manual sleep session editor`.
- Never amend, reset, rebase, force-push, or discard changes unless the user explicitly asks for that exact operation.

Remote setup and push:
- When the user asks to connect or upload to a remote repository, first run `git remote -v`, `git status --short --branch`, and `git branch --show-current`.
- If the user says the wrong hosting name but an exact remote URL is already configured, state the configured remote and ask only if the target is still ambiguous. Do not replace a correct remote because of a likely wording mistake.
- Prefer normal Git operations for repository upload. Do not use GitHub contents/API tools for a full initial upload unless the user explicitly asks for an API-based workaround; API upload does not preserve local Git history like `git push` does.
- For a first GitHub SSH push, test authentication with `ssh -T -o BatchMode=yes git@github.com` before repeated push attempts.
- If GitHub SSH to `github.com:22` times out, keep the existing `origin` remote unchanged and try a one-off push through GitHub SSH-over-443 with `GIT_SSH_COMMAND`, for example PowerShell: `$env:GIT_SSH_COMMAND='ssh -o Hostname=ssh.github.com -p 443'; git push origin <branch>`.
- Before trusting `ssh.github.com:443`, verify the ED25519 host key fingerprint against official GitHub documentation. The expected fingerprint from GitHub Docs is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. Add only the verified `[ssh.github.com]:443` host key to `known_hosts`; do not disable strict host key checking for real pushes.
- If SSH fails with `Host key verification failed`, verify GitHub's host key fingerprint against official GitHub documentation before adding it to `known_hosts`.
- If SSH fails with `Permission denied (publickey)`, show only the public key from `%USERPROFILE%\.ssh\id_ed25519.pub` and tell the user to add it in GitHub Settings > SSH and GPG keys. Never print or copy the private key.
- After the user adds the key, rerun the SSH authentication test, then run `git push -u origin <current-branch>`, and finish by checking `git status --short --branch`.

After coding:
- Summarize the current branch.
- List changed files.
- Mention checks that were run.
- Clearly state whether any Git actions were performed.

## Confluence workflow

The project Confluence site is `https://kichxdota.atlassian.net/wiki`.

Project space:
- key: `BSP`;
- name: `Baby Sleep Planner`;
- URL: `https://kichxdota.atlassian.net/wiki/spaces/BSP`.

Authentication:
- Use the `CONFLU_TOKEN` environment variable for the Atlassian API token.
- Do not print, commit, persist, or echo the token.
- Do not put the token into scripts, docs, `.env` files, or Confluence pages.
- Use Basic Auth with the Atlassian account email and API token. This token is not an OAuth Bearer token for this project.
- Prefer the email from `git config --get user.email`. The expected account is `kichxdota@gmail.com`.
- On Windows, if `$env:CONFLU_TOKEN` is empty, check the user environment without printing the value:
  `[Environment]::GetEnvironmentVariable('CONFLU_TOKEN', 'User')`.

Before any Confluence write:
1. Verify the token works with a read-only request.
2. Check whether the target space or page already exists.
3. Keep generated docs concise and project-specific.
4. Do not publish secrets, local paths containing private data, build credentials, keystore details, or raw database contents.

Recommended PowerShell setup for ad hoc API calls:

```powershell
$baseUrl = 'https://kichxdota.atlassian.net/wiki'
$email = git config --get user.email
$token = $env:CONFLU_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = [Environment]::GetEnvironmentVariable('CONFLU_TOKEN', 'User')
}
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'CONFLU_TOKEN is not available'
}
```

Use `curl.exe` for Confluence calls on Windows because PowerShell `Invoke-WebRequest` can fail noisily with Basic Auth responses:

```powershell
curl.exe -sS -u "$($email):$token" -H 'Accept: application/json' "$baseUrl/rest/api/user/current"
```

Useful tested REST endpoints:
- Check current user: `GET /wiki/rest/api/user/current`.
- List spaces: `GET /wiki/rest/api/space?limit=10`.
- Read the project space: `GET /wiki/rest/api/space/BSP?expand=homepage,description.plain`.
- Resolve the project space id for REST API v2: `GET /wiki/api/v2/spaces?keys=BSP&limit=1`.
- Create a space: `POST /wiki/rest/api/space` with JSON containing `key`, `name`, and optional `description.plain`.
- Search content with CQL: `GET /wiki/rest/api/content/search?cql=space=BSP`.
- For page operations, prefer Confluence REST API v2:
  - list pages: `GET /wiki/api/v2/pages?space-id=<spaceId>&limit=25`;
  - create page: `POST /wiki/api/v2/pages`;
  - read page: `GET /wiki/api/v2/pages/<pageId>?body-format=storage`;
  - update page: `PUT /wiki/api/v2/pages/<pageId>` with the next version number.

When creating or updating pages:
- Use `representation: "storage"` for page body HTML.
- Read the existing page first and increment its version for updates.
- Prefer updating an existing page with the same title in `BSP` instead of creating duplicates.
- Keep project documentation aligned with the app scope in this file: offline-first baby sleep planning only.
- Use official Atlassian Confluence Cloud REST API docs when adding an untested endpoint:
  `https://developer.atlassian.com/cloud/confluence/rest/v2/` and
  `https://developer.atlassian.com/cloud/confluence/rest/v1/`.

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
