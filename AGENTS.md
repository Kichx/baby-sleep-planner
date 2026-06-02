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

## Implementation lessons from next sleep and bedtime reminders

For next-sleep and bedtime reminders, keep the user-facing scheduling decision in `src/core` as pure TypeScript, such as `buildNextSleepReminder`. UI screens should not decide reminder copy, lead time, or whether the next sleep is a nap or night sleep.

Reminder scheduling should live in `src/notifications` and reuse the same active plan and `buildTodaySleepSnapshot` logic as the main screen. Load sessions from the local database around the current sleep day; do not derive reminders from selected-day UI arrays, nearby display rows, history lists, or stale screen state.

Use one stable scheduled-notification identifier for the next sleep reminder so every sync replaces the previous reminder. Cancel the reminder when the baby is already sleeping, because the active sleep notification owns that state. Treat all reminder permission, scheduling, and cancellation failures as non-blocking.

Keep `expo-notifications` behind the shared lazy import guard, such as `src/notifications/expoNotifications.ts`. Do not add value imports from `expo-notifications` at module top level. If reminder behavior must work in Expo Go, verify Android Expo Go still starts safely; if it cannot, degrade by doing nothing rather than breaking sleep logging.

Resync sleep reminders after every mutation that can change the next sleep prediction:
- start or stop sleep;
- create, edit, delete, or mark a sleep as ongoing;
- save changes to the active plan;
- activate or delete a plan when the active plan changes;
- restore/import app data.

Reminder text should stay calm and actionable. Use wording like "Ориентир на сон" or "Ориентир на отбой"; do not use alarming warnings, medical claims, guilt language, or long recommendation explanations in notifications.

Do not use repeated local notification rescheduling as a background timer. Schedule only the nearest useful reminder, then recompute when the app becomes active or local data changes. For local-only reminders, do not request push tokens, FCM, backend services, accounts, or cloud sync.

Before considering next-sleep reminders done, verify:
- no reminder is scheduled while an active sleep is ongoing;
- the next nap reminder updates after stop/edit/delete/manual ongoing changes;
- the bedtime reminder updates after active plan changes;
- restoring data refreshes or cancels the reminder based on restored sleep and plan data;
- denied notification permission does not block sleep logging or plan editing;
- Expo Go does not crash from a static `expo-notifications` import;
- TypeScript checks pass and unit tests cover core reminder timing/copy decisions;
- Android APK/dev build verifies actual scheduled notification delivery and channel behavior.

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

## Implementation lessons from sleep retrospective work

The dedicated multi-day history screen is named "Ретроспектива сна". It should stay a calm retrospective, not an analytics dashboard. Default to 7 days and offer only simple period switches such as 7/14/21 days.

Retrospective lists must show only completed past sleep days. Derive the period from the current sleep-day key, not from the raw calendar date. If the current time is before `plan.dayStartMinutes`, the current sleep day is still yesterday, so the latest completed day is the day before that.

Keep retrospective summary/status/copy logic in `src/core` as pure TypeScript, for example `src/core/sleepRetrospective.ts`. UI screens should load the relevant sessions and plan snapshots, call existing day-summary logic such as `buildSleepDaySummary`, then render the core result. Do not decide status thresholds, dominant reasons, or hint copy inside React components.

For each retrospective day, load and calculate with that day's saved plan snapshot via `getSleepDayPlan`, not only the currently active plan. Build the range from that plan's `dayStartMinutes`, load sessions for `[dayStart, dayEnd)`, and use the same open-session guard as other history screens: an active session ends at `min(now, dayEnd)` for overlap checks.

Keep daily cards compact and scannable:
- date and calm status;
- подъём;
- дневной сон with nap count;
- отбой;
- бодрствование vs plan;
- one short hint.

Details belong on the existing day screen. A retrospective card should navigate to the selected day, for example with a stable `YYYY-MM-DD` sleep-day key route param, instead of duplicating timeline, editing, or record-list UI inside the retrospective screen.

Retrospective copy must be non-judgmental. Prefer statuses like "Близко к плану", "Немного сдвинулся", and "Сильно сдвинулся". Avoid "плохо", "ошибка", "нарушение", medical claims, or guilt language.

Before considering retrospective work done, verify:
- 7, 14, and 21 day periods;
- early morning before day start does not include the still-open current sleep day;
- empty days render calmly;
- active sleep does not leak into future or unrelated days;
- tapping a card opens the correct existing day screen;
- core tests cover statuses, dominant reasons, empty state, and period summary copy;
- TypeScript checks pass and unit tests pass.

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

## Implementation lessons from optional bottle-feeding tracker work

Bottle feeding is an explicitly optional tracker, not a new default app domain. Keep the sleep flow primary and do not expand feeding into a general baby-tracker surface unless the user explicitly asks. In v1, keep `BottleFeeding` limited to `id`, `childId`, `startedAt`, `volumeMl`, `createdAt`, and `updatedAt`; do not add milk type, duration, notes, caregiver, temperature, mood, or links to a specific sleep session without a new request.

Gate every feeding UI surface behind `bottleFeedingEnabled`: the home card, day-feed rows, any dedicated section/navigation entry, and feeding reminders. Disabling the setting must only hide functionality and stop reminders; it must not delete existing feeding rows. The soft suggestion prompt is controlled separately by `bottleFeedingPromptDismissed`; once dismissed, do not show it again automatically, and keep the feature available through settings.

When adding or changing feeding persistence, update the full local-data chain together: fresh SQLite schema, idempotent migrations, repository functions, backup/export format, restore validation/defaults, TypeScript types, and focused tests. Treat existing local feeding rows as user data once the feature exists.

For feeding time calculations, use the same local-time helpers and day-boundary approach as sleep. "Today" feeding stats mean the user's current calendar day from local day start to the next local day start; "last 24 hours" is a separate rolling window from `now - 24h` to `now`. The latest feeding must come from a global `startedAt DESC` query, not from a selected-day display list.

Do not rely only on UI/editor validation for bottle-feeding invariants. Repository save paths such as `createBottleFeeding` and `updateBottleFeeding` must reject invalid dates, future `startedAt` values, non-integer volumes, volumes `<= 0`, and volumes above `MAX_BOTTLE_FEEDING_VOLUME_ML`. Keep repository tests deterministic by freezing system time whenever future/past validation is involved.

When checking bottle-feeding edge cases, split tests by layer instead of adding broad UI tests unless UI test infrastructure already exists. Use `src/core/bottleFeeding.test.ts` for date ranges, empty/latest copy, count forms, and stats formatting; use `src/db/bottleFeedingRepository.test.ts` for create/edit/delete, latest-feeding recalculation, today vs last-24-hours stats, validation, and empty state after deleting the last row; use notification tests under `src/notifications` with mocked `@/db` and `expoNotifications` to verify cancel/schedule/reschedule/suppression orchestration without importing `expo-notifications` statically.

Keep bottle-feeding display copy and formatting centralized in `src/core/bottleFeeding.ts`. Reuse shared formatters for elapsed time, latest-feeding lines, feeding row text, today stats, empty states, notification body text, and Russian count forms such as `1 кормление`, `2 кормления`, and `5 кормлений`. Do not rebuild these strings separately in the home card, "Кормление" screen, editor modal, day feed, or notification code; update focused core tests whenever the copy changes.

On the main screen, if the feeding card is enabled, keep it compact and place it directly under the current sleep status before the sleep action buttons. Do not rewrite or simplify the existing sleep status block when adding optional tracker UI. Reload feeding state after create, edit, delete, selected-day changes, and setting toggles.

During feeding UI polish, keep the home card visually secondary to sleep: it should stay smaller than the current sleep status block, use tighter typography and spacing than sleep action areas, and never push the main sleep start/stop flow out of immediate reach. If the latest-feeding copy can be long, constrain it with `numberOfLines` / `adjustsFontSizeToFit` instead of making the card taller.

When showing bottle feedings inside the mixed sleep/feed day list, keep feeding rows visually secondary to sleep rows. Sleep rows are the main timeline: they may use stronger titles, larger row height, and clearer icon badges. Feeding rows should stay compact, use muted copy/icon treatment, avoid strong green highlighting, and never make the sleep timeline harder to scan. If adding event icons, prefer a small local presentational component built with React Native views over adding an icon dependency for one list.

For bottle-feeding quick entry, reuse one bottom sheet for create/edit instead of adding a separate form flow. In v1 keep the sheet limited to date, time, and volume in ml. For the create flow, put volume first because date and time already default to now; the fastest path should be open sheet, choose or type volume, save. Keep date and time controls below volume for correction only. Defaults should minimize effort: today, current time, and saved `bottleFeedingDefaultVolumeMl` from the child profile, defaulting to 180 ml. Do not use the latest feeding volume as the create default unless explicitly requested; the settings preset owns that default. Keep quick volume buttons compact, validate volume as 1-999 ml, reject future feeding times, and keep edit/delete copy specific to the selected record. After create, edit, or delete, reload the global latest feeding, today stats, last-24-hours stats, selected-period lists, and resync notifications.

For the bottle-feeding editor, keep the date display unambiguous with the year visible, for example `2 июня 2026 г.`. Time entry should use the same numeric `SelectAllTextInput` pattern as manual sleep editing: accept compact digits such as `1234`, normalize to `12:34`, keep partial input as text, parse on save, and reject invalid or future feeding times. Do not replace this with the Android clock picker unless the task explicitly asks for picker-only input.

For default bottle-feeding volume settings, persist `bottleFeedingDefaultVolumeMl` on the child profile with default `180`. Store presets in `src/constants/bottleFeeding.ts`, update fresh SQLite schema, idempotent profile-column migrations, repository update helpers, TypeScript types, backup/export, restore validation/defaults for old exports, and focused tests together. Changing the default volume must not edit existing feeding rows, must not resync notifications unnecessarily, and must affect new quick-add sheets from both the home screen and the dedicated "Кормление" screen.

When showing bottle feedings in day feeds, treat them as display-only events. It is fine to mix `BottleFeeding` rows with sleep rows in chronological order, but do not pass feedings into sleep timelines, day summaries, recommendations, active sleep state, or start/stop logic. A feeding inside a sleep interval must not split the sleep session, change sleep duration, end active sleep, start a new sleep, or affect sleep recommendations.

The dedicated feeding screen is named "Кормление" and should stay a simple operational screen, not an analytics page. Gate the route and all entry points behind `bottleFeedingEnabled`. Show latest feeding, "Сегодня" and "24 часа" stats, and the selected-period record list. Reuse the shared bottom sheet for add/edit/delete. Do not add feeding filters, charts, age norms, recommendations, milk type, duration, notes, or export unless explicitly requested.

For disabled bottle feeding, gate more than visible entry points. A direct visit to `/bottle-feeding` must not render the feeding screen content while profile loading or redirect is in progress; keep route content empty or minimal until `bottleFeedingEnabled` is confirmed, reset stale feeding screen state to empty, then redirect home. This prevents hidden optional data from flashing after the feature is disabled.

For bottle-feeding reminders, persist settings on the child profile: `bottleFeedingRemindersEnabled` default `false`, `bottleFeedingReminderIntervalMinutes` default `180`, and `bottleFeedingNotifyDuringSleep` default `true`. Store these in SQLite with fresh-schema columns, idempotent migrations, TypeScript types, repository update helpers, and backup/restore defaults for old exports. Keep constants such as default interval, max volume, and interval presets in `src/constants/bottleFeeding.ts`.

Keep feeding reminder decisions in `src/core` as pure TypeScript and scheduling in `src/notifications`. Derive notification state from global local data such as `getChildProfile`, `getLatestBottleFeeding`, and `getActiveSleepSession`, never from screen lists or selected-day display arrays. Use one stable scheduled-notification identifier, lazy-load `expo-notifications` through the shared guard, treat permission/scheduling failures as non-blocking, and never request push tokens, FCM, backend services, accounts, or cloud sync.

For feeding reminder UI, keep the disabled state compact: show a calm status such as "Напоминания выключены" and the main switch only. Hide interval presets, custom interval input, and "Уведомлять во время сна" controls until reminders are enabled. Keep reminder status copy in `src/core/bottleFeeding.ts` with focused tests instead of composing it inside React screens.

When feeding reminders are disabled, when bottle feeding is disabled, or when imported/restored data disables them, cancel the scheduled feeding reminder and clear any suppressed reminder state. If `bottleFeedingNotifyDuringSleep` is false and the baby is sleeping, do not cancel a still-future reminder just because sleep is active; let the notification handler suppress presentation at due time, store planner state such as `suppressedDueToSleep` and `suppressedReminderAt`, and resync after sleep ends. After wake, show the suppressed reminder immediately only if there was no newer feeding after `suppressedReminderAt`; otherwise clear suppression and schedule from the new latest feeding. Resync feeding reminders after feeding create/edit/delete, reminder setting changes, bottle-feeding feature toggles, sleep start/stop, and data restore/import.

Before considering bottle-feeding UI or reminders done, verify:
- quick add for today and yesterday;
- edit date, time, and volume;
- the feeding editor shows a full date with year and accepts numeric time input such as `1234 -> 12:34`;
- default volume is 180 ml on fresh/old data, selecting a preset persists it, and new quick-add sheets use the saved default instead of the latest feeding volume;
- delete with confirmation;
- feeding rows appear chronologically with sleep but do not alter sleep durations or recommendations;
- the "Кормление" screen switches correctly between today and last 24 hours;
- the home card remains below the current sleep status and above sleep action buttons, and is visibly smaller than the sleep status block;
- the quick-add sheet opens with volume first and has no milk type, duration, notes, recommendations, norms, or charts;
- reminder defaults are off, interval is 3 hours, notify-during-sleep is on;
- disabling reminders cancels scheduled notification state;
- disabling bottle feeding hides UI and prevents reminder scheduling without deleting rows;
- direct navigation to `/bottle-feeding` while bottle feeding is disabled redirects home without flashing feeding content;
- disabled reminders show only the status and main switch; interval and during-sleep controls appear only after enabling reminders;
- turning off "Уведомлять во время сна" suppresses only due reminders during active sleep, then either shows the suppressed reminder after wake or discards it when a newer feeding happened;
- the home card, "Кормление" screen, day feed rows, editor delete copy, and feeding notification text use the same shared formatting helpers;
- TypeScript checks pass, unit tests pass, and Android APK/dev build verifies actual notification delivery/channel behavior if notification behavior changed.

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

If `npx eas-cli@latest` or `npm view eas-cli version` hangs because the npm registry is slow or unreachable, do not keep retrying the same network fetch. Check for an already unpacked EAS CLI under `%LOCALAPPDATA%\npm-cache\_npx\...\node_modules\.bin\eas.cmd`, verify it with `eas.cmd --version` and `eas.cmd whoami`, and use that cached CLI for the build if it works. `eas build:view` in EAS CLI 20 does not accept `--non-interactive`; use that flag for `eas build`, not for `build:view`.

For long EAS builds, distinguish the local CLI wait process from the remote build. Once a build ID appears, record the build ID, logs URL, commit hash, profile, and `versionCode`, then poll with `eas build:view <build-id>` or `eas build:list --platform android --limit 5`. If the local command times out or loses output, do not start a duplicate build until checking existing `eas-cli` processes and the latest EAS build list. It is safe to stop only the local waiting `cmd`/`node` process after confirming the remote build exists; do not cancel the remote build unless the user asks.

When running EAS from automation on Windows, avoid fragile `Start-Process` command strings around `.cmd` files unless stdout/stderr log files are verified immediately. A direct `cmd /c "<path-to-eas.cmd> build ..."` is easier to reason about. If a background launch is needed, write stdout, stderr, and exit code to known files and inspect them before assuming the build started.

Do not bump `expo.version`, change `android.package`, change `DATABASE_NAME`, reset Android credentials, or edit signing settings for a routine APK test build. With `cli.appVersionSource: "remote"` and preview `autoIncrement: true`, EAS may increment the remote Android `versionCode` without modifying local files. After any EAS build, run `git status --short --branch` and clearly report whether local files changed.

If the working tree becomes dirty after an EAS build has already started, report that separately from the APK result. The EAS build record's commit hash is the source of truth for what was packaged; do not imply later uncommitted local changes were included in that APK.

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

## Implementation lessons from auto-derived sleep-plan settings

For advanced plan parameters that mostly tune recommendations, prefer an automatic mode with a compact manual override. Parents should not have to maintain values such as `microNapMinutes`, `latestEveningNapEndMinutes`, or `maxEveningNapMinutes` after changing bedtime, nap count, wake windows, or day-sleep targets.

Keep auto derivation in `src/core` as a pure TypeScript function. UI should call the core function for draft previews and saved values, not duplicate the formula in React components or database code. The default plan should be built from the same derivation so defaults and edited plans do not drift.

When adding an auto/custom mode for plan settings, persist the mode explicitly in SQLite, for example `evening_rules_mode`, and update all data paths together:
- fresh schema in `INITIAL_SCHEMA_SQL`;
- idempotent existing-database column checks before any `PRAGMA user_version` early return;
- repository SELECT/INSERT/UPDATE mapping;
- export/import backup rows with a fallback for older backups;
- tests for both new backups and legacy backups without the new field.

Saved plans should still contain the effective numeric values used by calculations. In `auto` mode, map database rows to derived values from the current base plan; in `custom` mode, use the stored numeric override values. This keeps recommendations deterministic while avoiding extra routine settings work for the parent.

Recommendation scenarios must describe what the projection actually did. Do not show a `microNap` scenario only because wake time is near a limit; show it only when the bedtime projection really inserted a micro-nap and expose the projected micro-nap minutes from core. If micro-naps are disabled or no longer fit the evening limits, choose early bedtime or normal next-sleep copy instead.

For UI, keep these controls under a collapsed "additional" area with short text and a help link. The collapsed state should show whether values are `auto` or manual, plus only the most useful summary. The edit sheet should explain that the settings affect suggestions, not logged sleep records, and should provide "set manually" / "return auto" actions instead of making every numeric field visible by default.

Before considering auto-derived plan settings done, verify:
- changing nap count or bedtime recalculates auto values in the draft before saving;
- switching to manual preserves the current effective values as editable inputs;
- returning to auto replaces manual values with derived values;
- saved active-plan calculations, snapshots, reminders, recommendations, and shared-plan text use the effective saved plan;
- old databases and old backups without the mode field still load;
- core tests cover representative nap counts and disabled micro-naps;
- `/sleep-plan` and the relevant `/info?article=...` deep link render in the in-app browser without adding visual clutter.

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

## Implementation lessons from wake window guidance

Keep wake window guidance (Level C) separate from Level A and Level B. Level A answers total sleep over 24 hours, Level B answers practical daytime sleep distribution, and Level C answers practical wake-window ranges between sleeps. Do not merge these into one status, one source explanation, or one apply action.

Store Level C age ranges and status checks in `src/core/wakeWindowGuidelines.ts` as pure TypeScript. UI screens and `/info` should reuse `WAKE_WINDOW_GUIDELINES` and `formatWakeWindowRangeShort` instead of copying wake-window rows or formatting by hand. When changing those ranges or statuses, update `src/core/wakeWindowGuidelines.test.ts`.

Level C copy must stay cautious: use phrases such as "практический ориентир", "мягкий ориентир", and "дети индивидуальны". Do not write that WHO, CDC, AASM, or another official Level A source defines wake windows. Do not call wake windows a medical norm or promise a medical result.

On `/sleep-plan`, compare Level C against the currently displayed draft plan, not necessarily the active plan. Reuse `plan.wakeWindows` produced by `buildSleepPlanPreset`/`buildWakeWindowsForPlan` to derive the draft wake-window range; do not duplicate schedule math in the UI. Handle missing birth date, unsupported age, and invalid draft plan as calm read-only states.

Do not add "Применить к плану" for Level C unless the task explicitly asks for it and defines how total awake time, nap count, day sleep, bedtime, and Level A/B checks should change together. A first Level C implementation should be read-only guidance and comparison.

Keep `/info?article=wake-window-guidelines` compact. The article should explain what a wake window is, that Level C is practical guidance rather than an official medical norm, that Level A sources do not define wake windows, and then show the table from `WAKE_WINDOW_GUIDELINES`. Keep the source label short, for example "Практический клинический источник: Cleveland Clinic".

Do not add a large Level C card to the main "Сон сегодня" screen unless explicitly requested. That screen should stay focused on current state, next sleep, predicted bedtime, and simple day guidance. If Level C later affects recommendation scenarios, update core recommendation tests instead of only changing UI text.

Before considering wake window guidance done, verify:
- `/sleep-plan` shows Level C after Level B and before the ideal schedule;
- missing birth date shows the profile prompt and does not crash;
- unsupported ages outside the configured table show a calm "not set" state;
- invalid draft plan shows a calm "check plan parameters" state;
- `/info?article=wake-window-guidelines` opens directly and shows the table from `WAKE_WINDOW_GUIDELINES`;
- wording does not claim official sources define wake windows or medical norms;
- SQLite schema, `DATABASE_NAME`, and `android.package` are unchanged;
- TypeScript checks pass and core tests pass.

## Implementation lessons from scientific sleep evidence

Keep scientific sleep evidence (Level D) as a read-only evidence backing layer for the internal model. Level D explains why the app uses ranges and observed history instead of one universal schedule. It must not directly change the sleep plan, nap count, day sleep range, wake windows, active plan, sleep sessions, recommendations, SQLite schema, `DATABASE_NAME`, or `android.package`.

Store Level D sources in `src/core/scientificSleepEvidence.ts` as pure TypeScript. UI screens and `/info` should reuse `SCIENTIFIC_SLEEP_EVIDENCE_SOURCES` and its formatters instead of copying source rows by hand. When changing sources, topics, labels, or allowed use text, update `src/core/scientificSleepEvidence.test.ts`.

Level D copy must stay cautious and non-clinical. Use phrases such as "научная база модели", "проверка диапазонов", "объяснение вариативности", and "документация источников". Do not call Level D a medical norm, do not say it recommends a concrete schedule for a child, and do not imply diagnosis, treatment, or an automatic plan change.

Keep `/info?article=scientific-evidence` compact and read-only. The article should explain that Level D is for internal model backing, does not set nap count or wake windows, does not replace Level A official guidance, and is not medical advice. Add the article id to any `InfoArticleId` guard so the deep link opens directly.

If the user explicitly asks for a more scientific or detailed Level D article, it may be more detailed than other help entries, but it must stay readable and read-only. Explain evidence kinds, normal variability, and limitations using `SCIENTIFIC_SLEEP_EVIDENCE_SOURCES`, `trustNote`, `limitations`, and existing formatters instead of hard-coding new study claims in UI text. Do not add new studies only in `/info`; add them to `src/core/scientificSleepEvidence.ts` and update `src/core/scientificSleepEvidence.test.ts`.

On `/sleep-plan`, Level D should usually be only a compact text link such as "Научная база модели: Уровень D" or "Почему ориентиры разные?" pointing to `/info?article=scientific-evidence`. Do not add a fourth full card next to A/B/C, an apply button, or extra settings unless a separate product task explicitly asks for that added surface area.

Before considering scientific evidence guidance done, verify:
- `src/core/scientificSleepEvidence.ts` imports no React, Expo, SQLite, or device APIs;
- `/info?article=scientific-evidence` opens directly and shows the table from `SCIENTIFIC_SLEEP_EVIDENCE_SOURCES`;
- `/sleep-plan` is not overloaded with a large Level D card;
- the main "Сон сегодня" screen receives no new Level D card or recommendation scenario;
- wording does not call Level D a medical norm or direct scheduling rule;
- SQLite schema, `DATABASE_NAME`, `DATABASE_VERSION`, and `android.package` are unchanged;
- TypeScript checks pass and core tests pass.

When documenting Level A/B/C/D changes in Confluence, update both the conceptual and screen-level pages. The conceptual page is `Уровни доверия сна: A и B` or its successor if Level C/D has been added there. The screen pages that usually need updates are `Экран: План дня` for the cards/actions, `Экран: Справка` for help articles and deep links, and `Экран: Сон сегодня` when a guideline status appears on the main/past-day screen. This prevents Confluence from describing only the core principle while missing visible UI behavior.

## Implementation lessons from Help level-chain articles

In `/info`, keep the user-facing level articles adjacent and ordered as one chain: official sleep guidelines (Level A), practical daytime sleep guidelines (Level B), wake-window guidance (Level C), and scientific evidence (Level D). Do not insert unrelated help articles such as night forecast, night classification, evening sleep rules, or editor instructions between those four articles.

Level article titles in `INFO_ARTICLES` should start with `Уровень X · ...`, not end with the level label. This makes the collapsed help list read as one connected sequence.

When editing this chain, the first paragraph of each article should define that level's role: Level A = official 24-hour total sleep check, Level B = practical daytime sleep distribution, Level C = practical wake-window guidance, Level D = evidence backing for ranges and variability. Keep that separation visible in copy; do not imply that official Level A sources define nap counts or wake windows, and do not let Level D become a direct scheduling rule.

For `/info` text-only changes, run `cmd /c npm run typecheck`. If the Level D table, source labels, or source-backed copy changes, also run `cmd /c npm run test -- src/core/scientificSleepEvidence.test.ts`. If a local Expo server is already running, visually check `/info` for wrapping and spacing; do not start a new server solely for a tiny copy change unless layout risk is real.

## Implementation lessons from Android keyboard/input modal work

APK keyboard behavior can differ from Expo Go, especially for `Modal` bottom sheets and compact dialogs. When a user reports the Android keyboard covering an input, inspect all `TextInput` usages and all `Modal` windows in the project, not only the field from the screenshot.

For modal forms with inputs, prefer the built-in React Native approach first:
- wrap modal content in `KeyboardAvoidingView`;
- use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`;
- put form fields in an inner `ScrollView` with `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`;
- cap large bottom sheets with a max height and let the form content shrink/scroll instead of extending under the keyboard.

For transparent React Native `Modal` windows on Android, especially bottom sheets, set `navigationBarTranslucent` together with `statusBarTranslucent` so the modal backdrop and sheet cover the system navigation area. Without both props, a strip of the underlying screen can remain visible below the sheet on some devices.

Keep primary actions usable when the keyboard is open. For bottom sheets, keep Save/Delete actions outside the scrolling form when practical, and make only the field area scroll. For centered short dialogs with a `TextInput`, wrap the dialog in `KeyboardAvoidingView` even if the dialog looks small on a tall device.

Do not put `selectTextOnFocus` directly on controlled `TextInput` fields that users are expected to replace quickly, especially Android numeric time fields. It can leave the old selection active after the first typed character, so the second character replaces the first one. Use the shared `SelectAllTextInput` component for "select all on focus" behavior; pass `normalizeText` for forgiving time inputs, and let the component collapse the selection after the first edit.

Do not add `react-native-keyboard-controller`, change `android.softwareKeyboardLayoutMode`, or add another keyboard dependency for simple one-screen/modal input fixes unless the built-in approach fails. If changing Android app config is truly required, remember it only affects a new APK build and re-check `android.package`, the APK-producing `preview` profile, and `DATABASE_NAME`.

When fixing a keyboard or bottom-sheet bug reported from one window, compare the reported component against the other local modal patterns before editing. Reuse the working pattern from existing modals when possible, and then run `rg -n "<Modal|KeyboardAvoidingView|ScrollView|TextInput|SelectAllTextInput" -S src` to confirm no similar window was missed. React Native Web cannot verify Android IME or system navigation-bar behavior; confirm these on Android/Expo Go or clearly report that only code-level checks were run.

Before considering keyboard/input UI done, verify:
- bottle-feeding quick entry with the time field focused;
- manual sleep entry with the start time focused;
- manual sleep entry with the end time focused;
- editing an existing sleep record with the end time focused;
- sleep-plan range editors with the second field focused;
- replacing a selected existing time by typing several digits in a row, for example `1314`, without the first digit being eaten;
- plan name create/edit dialog with the keyboard open;
- profile name input on a narrow Android screen;
- transparent bottom sheets cover the Android system navigation area with no underlying screen visible below them;
- TypeScript checks pass, and tests pass if the touched area can affect app behavior.

## Implementation lessons from navigation/settings work

Before adding a new "tab" or settings section, inspect the current Expo Router structure first. If the app currently uses a `Stack`, keep the change in that pattern unless the task explicitly asks to introduce a real tab navigator.

When adding a new `src/app` screen:
- register it in `src/app/_layout.tsx`;
- add focused navigation entry points from the screens that need them;
- keep the new screen read-only if the task only asks to move or expose existing information;
- avoid adding icon libraries only for one button. Prefer a small local presentational icon component built with React Native views.

With Expo Router typed routes, `.expo/types/router.d.ts` can lag behind a newly added file route until Expo regenerates it. Do not edit generated `.expo` files. If TypeScript needs help for a new route, use a narrow named `Href` constant such as `const SLEEP_PLAN_ROUTE = '/sleep-plan' as Href`, then run `npm run typecheck`. If TypeScript fails inside `.expo/types/router.d.ts` after an interrupted Expo web run or Fast Refresh, inspect the file for duplicated/truncated declarations, delete only the generated `.expo/types/router.d.ts`, and rerun `npm run typecheck` so Expo/TypeScript can regenerate clean route types.

On Windows, before starting Expo/Metro, check whether running Metro is actually needed. Do not start Metro after every code change by default; TypeScript checks are enough unless the user asked to run the app, the task requires visual/manual verification, or the current change is risky without Expo Go testing.

When Metro is needed, first check whether the default port is already occupied and whether an existing Metro server can be reused. If Expo reports that `8081` is in use but no reusable server is clearly identified, make at most one alternate-port attempt. Do not keep trying multiple wrappers such as `npm`, `cmd /k`, local Expo CLI, and absolute Node paths after the first background startup failure.

Avoid short foreground timeouts as a Metro verification strategy. If Expo reaches `Waiting on http://localhost:<port>`, treat startup as successful for that run; do not kill it just to continue probing. If the process cannot be kept alive from the agent environment, stop and report the exact manual command, for example `cmd /c npm run start -- --port <port>`.

## Implementation lessons from browser UI verification

For browser-based UI checks, prefer the Codex in-app browser against the user's already-running local app. In this project the user usually keeps Expo web running at:

`http://localhost:8081/`

If the user message includes an in-app browser context with a current URL, use that exact URL and port first, for example `http://localhost:8083/`. Do not start another Expo server just because the usual `8081` port is documented here.

Before starting any new Expo/Metro process, check whether `8081` is already usable:
- `Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue`;
- a quick HTTP probe such as `Invoke-WebRequest -Uri 'http://localhost:8081/' -UseBasicParsing -TimeoutSec 5`.

If `8081` is not the active port, inspect existing Expo command lines before starting another server, for example with `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'expo start' }`. The user may already have Expo web running on another port such as `19006`.

If `http://localhost:8081/` responds and the DOM snapshot shows app content such as "Сон сегодня", "План дня", or "Справка", reuse that browser session for visual verification. Do not start another server on `8082` or another port just for routine UI checks.

When using the in-app browser, verify the changed UI with a DOM snapshot first, then take screenshots only where layout or text wrapping matters. Useful routes for smoke checks are:
- `/` for the main day state and summary cards;
- `/sleep-plan` for plan metrics, editors, and compact card layout;
- `/profile` for profile/date input behavior;
- `/info` for static help articles.

For React Native Web verification, remember that `react-native-web` `Alert.alert` is effectively a no-op. If a new delete/edit flow must be verified in the browser, implement a visible confirmation UI or a narrow `Platform.OS === 'web'` confirmation path instead of relying only on `Alert.alert`.

When visual QA needs sample local data, prefer existing records, unit fixtures, or a disposable local database/profile. Do not create persistent test records in the user's active browser/app data unless the cleanup path has already been verified. If a temporary record is unavoidable, delete it before finishing and mention any cleanup failure explicitly.

If a temporary Expo web server is truly needed because `8081` is unavailable, start only one alternate server, record the port in the progress update, and stop only the process you started after verification. Do not kill the user's long-running `8081` Metro process. Remove temporary logs such as `expo-web.log` before finishing.

For SDK 56 and `expo-sqlite` on web, a failure like `Unable to resolve module ./wa-sqlite/wa-sqlite.wasm` usually means the web/Metro setup is incomplete, not that the wasm file is missing. Keep `metro.config.js` configured with `config.resolver.assetExts.push('wasm')`, and keep the Expo Router web headers in `app.json`:
- `Cross-Origin-Embedder-Policy: credentialless`;
- `Cross-Origin-Opener-Policy: same-origin`.

For SDK 56 and `expo-sqlite` on web, `NoModificationAllowedError` from `createSyncAccessHandle` usually means another same-origin web tab or worker still holds the SQLite OPFS access handle. Close/reuse the existing same-origin tab before blaming the code change. Opening `127.0.0.1` instead of `localhost` can be useful for a smoke render check because it uses a different origin, but do not treat its local web SQLite data as the same data store as `localhost`, Expo Go, or the Android APK.

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
- numeric spaceId: `131075`;
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

Encoding safety for Russian Confluence pages:
- Prefer the Atlassian Rovo MCP tools for page search, read, create, and update when they can do the job. They avoid most local shell encoding issues.
- If a storage-body REST update is needed, do not trust `Invoke-RestMethod` / `Invoke-WebRequest` objects for Russian page bodies on Windows. They can return mojibake such as `Ð­ÐºÑÐ°Ð½...` and a follow-up PUT can permanently corrupt the page.
- For REST updates with non-ASCII content, prefer a Node `fetch` script that reads and writes JSON as UTF-8. Pass the token through `process.env.CONFLU_TOKEN`; never print it.
- If piping a Node script through PowerShell and the script contains Russian strings or Russian HTML anchors, set UTF-8 first:

```powershell
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
```

- If an anchor such as `<h2>Модальные окна</h2>` turns into `????` or fetched headings appear as mojibake, stop before writing and switch to a UTF-8-safe method.
- After every Confluence write, read the page back with `_getconfluencepage` in markdown format and confirm the new Russian headings, key bullets, and tables are readable.

Useful tested REST endpoints:
- Check current user: `GET /wiki/rest/api/user/current`.
- List spaces: `GET /wiki/rest/api/space?limit=10`.
- Read the project space: `GET /wiki/rest/api/space/BSP?expand=homepage,description.plain`.
- Resolve the project space id for REST API v2: `GET /wiki/api/v2/spaces?keys=BSP&limit=1`. Current BSP numeric id is `131075`.
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

When using the Atlassian Rovo MCP tools for Confluence:
- Always search first with Rovo Search and update an existing page when one matches the requested topic.
- `_createconfluencepage.spaceId` expects the numeric Confluence space id, not the space key. For this project pass `spaceId: "131075"`; passing `BSP` fails with `Provided value {BSP} for 'spaceId' is not the correct type. Expected type is Long`.
- The page key/URL segment remains `BSP`, but the create/update API field is numeric. Keep `cloudId` as `aa03fc2f-4fb7-4d70-ac83-74792e1a5f8c`.
- After creating or updating a page, read it back with `_getconfluencepage` in markdown format and confirm the key headings/tables are present.

## Language

The agent must always answer the user and ask clarification questions in Russian.

User-facing text in the app should be in Russian.

Always assume that project text can contain Russian letters and words: UI labels, notifications, help articles, backups, SQLite values, test fixtures, scripts, and external API payloads. Use UTF-8 explicitly when reading, writing, serializing, importing, exporting, piping, or uploading text. Do not rely on Windows default encodings, ASCII-only assumptions, or shell code pages for Russian content.

When a workflow writes or round-trips Russian text, configure the toolchain for UTF-8 up front where relevant, for example PowerShell console/output encoding, Node/file encoding, JSON serialization, SQLite text handling, HTTP headers, and document generation. After the write, verify that Russian text is still readable and not mojibake or `????` before considering the task complete.

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
