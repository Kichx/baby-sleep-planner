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

Small clock-time differences must not create anxious advice. For main-screen recommendation scenarios, treat bedtime forecast deltas within `RECOMMENDATION_TIME_TOLERANCE_MINUTES` from `src/core/recommendations.ts` as on-plan. Keep the current default at 10 minutes unless a later product decision changes it. Do not duplicate this tolerance in UI components; normalize it in pure core recommendation logic and cover both slightly early and slightly late bedtime forecasts with tests.

When a single planned daytime nap remains but the remaining awake budget cannot fit both the current average wake window and the average final wake window before night, prefer a micro-nap bridge instead of stretching the current wake window or projecting a full nap. The micro-nap may start at the current time only after the minimum current wake window is reached; otherwise schedule it at that minimum boundary. After the micro-nap, bedtime projection must preserve the plan's average final wake window. Keep this in pure core logic and make shared-day projections reuse the same `buildTodaySleepSnapshot` result instead of recalculating bedtime from the projected micro-nap as a shorter leftover wake budget.

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

## Implementation lessons from Android safe-area handling

Android-first UI must account for the system navigation bar at the bottom of the screen, including devices that use the three-button navigation strip. Bottom buttons, fixed CTAs, bottom sheets, and dialogs must never rely on visual padding alone if they can sit near the bottom edge.

Use `react-native-safe-area-context` for this:
- keep the root `SafeAreaProvider` in `src/app/_layout.tsx`;
- wrap bottom sheets and fixed bottom action areas with `SafeAreaView edges={['bottom']}` or the shared `BottomSheetSafeArea` component;
- for `Modal` screens with `navigationBarTranslucent` or `statusBarTranslucent`, still apply bottom safe-area to the sheet or dialog content that contains actions;
- avoid duplicating safe-area math inline when a shared wrapper can keep behavior consistent.

When changing a screen with bottom actions, smoke-test the relevant view on Android or at least in a narrow Expo web viewport, and explicitly check that the lowest actionable button remains fully visible and tappable above the navigation area.

## Implementation lessons from effective sleep day plan work

Temporary day modes such as `soft_day` and `early_wake` are effective-plan overlays for one sleep day. They must not rewrite the permanent `target_day_plan`, saved sleep-day snapshots, SQLite schema, or user history unless a later task explicitly asks for persistence changes.

Keep the plan layers explicit:
- `preset_template` is a non-persisted starter recommendation from core, usually age-based. It can prefill or preview a plan but must not create rows until the parent explicitly applies it.
- `target_day_plan` is the persisted permanent base plan. It is the source of plan name, active state, source plan id, saved snapshots, and long-term history context.
- `effective_plan` is a one-day calculated overlay built from a base `target_day_plan` or saved snapshot plus active temporary modes. It is used for calculations and display only, and is never saved as a replacement plan.

Keep summed 24-hour awake time (`Бодрствование за 24 часа (ВБ)`) as detail content in expanded `/sleep-plan` calculation checks. The main "Сон сегодня" screen may show remaining awake time to the day target, but not a standalone summed-WB card or first-level `всего ...` awake metric.

Keep effective-plan derivation in `src/core/sleepPlan.ts` or another pure `src/core` module. UI, repository, notifications, and screens should pass the base active/snapshot plan plus `SleepDayTemporaryMode[]` into core logic and use the returned plan for calculations.

Use the existing core entry points instead of duplicating schedule math:
- `buildEffectiveSleepDayPlan(basePlan, temporaryModes, options)` for combined modes;
- `deriveSoftDayPlan(basePlan)` for soft-day-only derivation;
- `deriveEarlyWakePlan(basePlan, actualWakeTime)` for early-wake-only derivation;
- `shouldSuggestEarlyWakeMode(...)` and `EARLY_WAKE_THRESHOLD_MINUTES` for suggestion logic.

Apply temporary modes in this order:
1. base target day plan;
2. `early_wake` first-window adjustment;
3. `soft_day` awake/day-sleep adjustment;
4. auto-derived evening rules through `deriveEveningSleepRulesForPlan`.

Do not chain `deriveEarlyWakePlan` and `deriveSoftDayPlan` manually when both modes are enabled. Use `buildEffectiveSleepDayPlan`, because rebuilding a plan can overwrite adjusted wake windows if the order is implemented ad hoc.

For `soft_day` MVP:
- keep `napCount`, wake-up range, and `dayStartMinutes` unchanged;
- reduce both target awake range boundaries by 30 minutes;
- allow the max day-sleep boundary to increase by 30 minutes only while keeping ranges valid;
- rebuild through `buildSleepPlanPreset` and auto evening rules so midpoints, wake windows, bedtime, early bedtime, and evening limits stay coherent.

For `early_wake` MVP:
- keep the permanent plan unchanged and never enable the mode automatically;
- suggest it only when actual wake-up is at least `EARLY_WAKE_THRESHOLD_MINUTES` before `plan.wakeUpStartMinutes`, unless already enabled or dismissed;
- make the one-day effective plan start from the actual early wake-up when `actualWakeTime` is earlier than `plan.wakeUpStartMinutes`: collapse only the effective `dayStartMinutes`, `wakeUpStartMinutes`, and `wakeUpEndMinutes` to that local clock time, then make the first wake window softer by 15-30 minutes;
- do not change `napCount` or total awake target for `early_wake`;
- treat `actualWakeTime` as local clock time when deriving the one-day adjustment.

When changing effective-plan logic, cover at least:
- soft day reduces total awake time by 30 minutes;
- soft day keeps `napCount` and wake-up range;
- early wake starts the effective day from actual wake-up and softens the first wake window;
- early wake before the normal `dayStartMinutes` still finds the completed night wake-up and counts awake time from that fact;
- suggestion true/false cases for threshold, enabled, and dismissed states;
- combined mode order;
- base `TargetDayPlan` is not mutated.

## Implementation lessons from preset wake-up defaults and no-record plan state

Default wake-up time for starter plans is a product decision, not screen-local copy. Keep default wake-up constants in `src/core/sleepPlanDefaults.ts` and use them for both `DEFAULT_SLEEP_PLAN` and age-based preset templates. If the default wake-up range changes, update related projection/share/calculation fixtures, evening-rule expectations, and focused tests for both fallback and age preset plans.

When a preset preview says `Подъём около ...`, derive the displayed time from the midpoint of the wake-up range, not from the lower boundary. If the preview needs to explain that the plan can be adjusted, keep the note short, one-line, muted, and visually secondary so it does not compete with the plan facts or action buttons.

On the main `/` screen, when an active plan exists but today's selected sleep day has no sleep records (`showPlanStartNoDataHint=true`), the hero status must not say only `План готов`. That reads as if the day is already okay. Use explicit copy that says the app is waiting for facts, for example `План готов, ждём записи сна`, keep forecast/coach blocks hidden, and keep the supporting no-data card focused on entering the first sleep record.

## Implementation lessons from main screen effective-plan integration

The main `/` screen must use the effective plan for today's calculations, but it must keep the base `SleepDayPlan` as the source of truth for plan name, source plan id, and temporary mode persistence.

For today only, load `sleep_day_temporary_mode` by `sleepDayPlan.sleepDayDate`, not by the selected calendar date. This matters before `dayStartMinutes`, when the current sleep-day can still be yesterday.

Use a pure helper such as `src/core/todayEffectiveSleepPlan.ts` to:
- derive the actual wake time for early-wake mode from sleep records;
- call `buildEffectiveSleepDayPlan(basePlan, temporaryModes, { actualWakeTime })`;
- decide the temporary-mode badge label;
- decide whether the early-wake suggestion should be shown.

On the main screen, feed the effective `SleepPlanPreset` into:
- `buildTodaySleepSnapshot`;
- next sleep projection;
- night projection;
- recommendation scenarios;
- current start/stop and manual-entry sleep kind inference for today.

Do not use the effective plan to rename the active plan or overwrite `target_day_plan`, saved snapshots, history, schema, or export/import data. The effective plan is a one-day calculation result.

When computing early-wake suggestion on `/`, use nearby sleep sessions around the current sleep-day, not only selected-day display rows. A completed night sleep ending at least `EARLY_WAKE_THRESHOLD_MINUTES` before `plan.wakeUpStartMinutes` can suggest `early_wake`; an active night sleep should suppress the suggestion until wake-up is known.

Before the base `dayStartMinutes`, the current sleep-day key can still point to yesterday even though the child has already woken for today. `getActualWakeTimeForEarlyWakeMode` must handle this by searching the nearest morning wake window, so a 06:30 wake-up before a 07:00 plan can still drive the current effective plan and `buildTodaySleepSnapshot` counts awake time from 06:30.

When fixing or extending the main `/` screen around early wake-ups, keep the displayed "today" boundary separate from the persisted sleep-day key. A completed night sleep ending before the base `dayStartMinutes` may become the actual display/calculation boundary for today even when `early_wake` is only suggested and not enabled. Use a pure helper such as `getActualWakeDayStartForToday(...)` and pass the resulting `dayStart` into snapshot, summary, timeline, sharing, and current start/stop calculations. Do not write `sleep_day_temporary_mode`, rewrite `target_day_plan`, or change `sleepDayPlan.sleepDayDate` merely because the display boundary moved.

Do not keep a stale `selectedSessions` state calculated before the actual early-wake boundary is known. Load nearby sessions around the current sleep-day, derive the actual wake-up, then compute visible selected-day sessions from `nearbySessions`, the final `selectedDayStart`, and `selectedDayEnd`. Include the completed night sleep that ends exactly at the actual wake boundary so the parent sees the wake-up context, but exclude previous-day daytime naps from today's metrics and timeline.

The main screen may show only a compact temporary-mode badge near the scenario plan line:
- `Сегодня мягкий день`;
- `Сегодня ранний подъём`;
- `Сегодня график скорректирован` when both modes are active.

The badge should navigate to `/sleep-plan`. Do not add temporary-mode toggles for past or future days on `/`, and do not offer mode activation from `/` when the selected date is not today.

For early-wake recommendation on `/`:
- show one calm card only when `shouldSuggestEarlyWakeMode` is true;
- never enable the mode automatically;
- `Включить` writes `early_wake` for the current sleep-day and then reloads the screen;
- `Не сейчас` writes dismissed state for the current sleep-day and suppresses the card until the next sleep-day;
- require a persisted active/source plan id before enabling from `/`, so first-run fallback plans do not create confusing temporary mode rows.

Do not add a separate total-awake-time or summed 24-hour wake card to the main screen. Today may show remaining awake time (`До цели бодрств.`), while detailed `Бодрствование за 24 часа (ВБ)` remains only in expanded `/sleep-plan` checks.

When changing this integration, cover at least:
- main screen snapshot uses effective plan under `soft_day`;
- main screen next sleep projection uses effective plan under `early_wake`;
- early-wake recommendation appears at the 30-minute threshold;
- recommendation does not reappear after `Не сейчас` for the same sleep-day;
- recommendation does not appear when `early_wake` is enabled;
- today UI still has no standalone summed-WB card.

## Implementation lessons from main screen view-state gating

Before redesigning or rearranging the main `/` screen, keep forecast, coach, temporary-mode, and onboarding visibility in the pure `deriveMainScreenSleepUiState(...)` helper in `src/core/mainScreenFlow.ts`. Do not spread equivalent inline conditions across `src/app/index.tsx`; React should read named flags such as `isTodaySelected`, `isPastSelected`, `isFutureSelected`, `hasActiveTargetPlan`, `onboardingMode`, `isTrackingOnlyWithoutPlan`, `canShowPlanBasedBlocks`, `canShowCoachBlocks`, `canShowTemporaryModeBadges`, and `canShowEveningPlanPrompt`.

For `tracking_only` without an active persisted `target_day_plan`, the main screen must keep factual tracking available while hiding plan-dependent guidance:
- keep actual status, start/stop for today, manual sleep entry, and the sleep-first timeline;
- hide forecast cards, scenarios/coach guidance, next-sleep and bedtime projections, remaining-awake-to-target metrics, temporary-mode badges, early-wake suggestions, and planned share text;
- do not use `DEFAULT_SLEEP_PLAN` as a reason to show plan-based UI;
- do not create `target_day_plan`, write temporary modes, request notifications, or change schema.

Current-moment coach blocks are today-only. Past and future selected days may show appropriate day/history views, but must not show today's coach, temporary-mode badges, or early-wake prompt. The evening tracking-only plan prompt should continue to use the existing `shouldShowEveningPlanPrompt(...)` rules, with the final visibility surfaced through `deriveMainScreenSleepUiState(...)`.

When changing these gates, cover at least:
- tracking-only without active plan keeps factual tracking controls and timeline;
- tracking-only without active plan hides plan-based and coach blocks;
- active plan + today allows coach blocks except the active-plan/no-records calm state;
- past/future selected days hide current-moment coach blocks;
- evening plan prompt still follows its dismissal/date/time/session rules.

## Implementation lessons from main screen sleep coach card

The main `/` screen should show one calm "Что лучше сейчас" coach card instead of exposing the full recommendation scenario list on the first level. Keep the decision in a pure core view-model helper such as `src/core/mainScreenSleepCoach.ts`; React should pass the already-built `buildTodaySleepSnapshot`, effective plan, selected sleep-day start, temporary-mode badge label, and `deriveMainScreenSleepUiState(...)`, then render the returned `SleepCoachCardVm`.

Do not recalculate wake windows, bedtime projections, temporary modes, active-plan state, or onboarding visibility ad hoc in `src/app/index.tsx`. The coach card may inspect existing snapshot fields and scenario metadata, but it must not change `buildTodaySleepSnapshot`, recommendation algorithms, SQLite schema, `target_day_plan`, saved snapshots, history, notifications, or temporary-mode rows.

Visibility must stay conservative:
- hide for `tracking_only` without an active target day plan;
- hide for past/future selected dates;
- hide for today's active-plan/no-records onboarding state;
- hide when there is no safe snapshot or no scenario metadata.

The card copy must be short, calm, and safe for a tired parent. Always set the eyebrow to `Что лучше сейчас`; return one title/body/anchor at most; never let user-facing strings contain `undefined`, `null`, or `NaN`; and do not show "Следующий сон после сна" or similar next-sleep wording while an active sleep is running. If `soft_day`, `early_wake`, or both temporary modes are active, pass the existing badge label through to the VM instead of deriving modes again.

For an active daytime sleep, keep the first-level coach anchor aligned with the same snapshot data used by `Почему так`. Do not show only the average nap duration from the plan when `snapshot.projectedRemainingDaySleepMinutes` or evening limits shorten the current nap. Cap the displayed remaining active-nap time by the already-built snapshot projection, current nap duration, and `plan.latestEveningNapEndMinutes`, and cover the "projected day sleep left is less than average nap left" case in `src/core/mainScreenSleepCoach.test.ts`.

For the awake coach card, keep the preparation prompt conservative. `Пора готовиться ко сну` should appear only when `snapshot.nextSleepAt` is within `PREPARE_THRESHOLD_MINUTES` from `src/core/mainScreenSleepCoach.ts`; keep the current default at 15 minutes unless a later product decision changes it. When the next sleep is farther away than that threshold, keep the card in calm mode with `Пока бодрствуем спокойно` and copy that explicitly supports `спокойное бодрствование`, not immediate laying down. Cover both sides of the threshold in `src/core/mainScreenSleepCoach.test.ts`.

When an awake recommendation materially changes the parent's next action, do not hide it only under `Другие варианты`. In particular, `capLastNap` / `Укоротить сон` must be surfaced on the first-level coach card when it is the current recommendation: make it primary in pure recommendation logic, use `plan.maxEveningNapMinutes` in the short calm copy, keep `Другие варианты` as secondary context, and cover both `src/core/recommendations.test.ts` and `src/core/mainScreenSleepCoach.test.ts`. This protects bedtime without requiring a tired parent to open a bottom sheet.

For first-level next-sleep copy on the main screen, show one target time from `snapshot.nextSleepAt` plus one human-readable relative duration, for example `Следующий сон в 10:25 (через 2 часа 15 минут)`. Use the shared pure formatter in `src/core/mainScreenTimeText.ts` instead of duplicating min/max wake-window text in `src/core/mainScreenSleepCoach.ts`, `src/core/todayShortSummary.ts`, presentational components, or `src/app/index.tsx`. Do not show first-level ranges like `примерно через 142–147 мин`; wake-window ranges can remain in detailed planning/check screens when they are explicitly useful.

For first-level bedtime copy on the main screen, keep the coach card and `Сегодня коротко` aligned around one current forecast from `snapshot.predictedBedtimeAt`. When the next step is night or the primary scenario is early bedtime, show one action time plus one human-readable relative duration, for example `Отбой около 20:51 (через 25 минут)` / `Отбой: около 20:51 (через 25 минут)`, instead of mixing that forecast with the wider plan bedtime range from `calculatePlanBedtimeRange(...)`. Use the shared pure formatter in `src/core/mainScreenTimeText.ts` for clock-plus-relative text; do not duplicate relative-duration math in `src/core/mainScreenSleepCoach.ts`, `src/core/todayShortSummary.ts`, presentational components, or `src/app/index.tsx`. A plan range may appear in detailed planning/check views or as a fallback when no safe forecast exists, but it must not sit next to the current forecast on the first level because it looks like conflicting advice.

When `snapshot.nextSleepKind === 'night'`, do not automatically label the coach card as `Лучше ранний отбой`. Use early-bedtime wording only when the primary scenario id is `earlyBedtime`. If the primary scenario is `normal` because the bedtime forecast is close to the plan, keep the card calm, for example `Переходим к ночи`, and do not say that the day shifted.

Keep `src/components/SleepCoachCard.tsx` as a presentational component. It should accept `SleepCoachCardVm`, return `null` when `vm.visible=false`, render secondary actions only from `hasWhyDetails` / `hasAlternatives`, and receive navigation or modal callbacks from the screen. Do not put sleep calculations, SQLite calls, temporary-mode writes, or direct Expo Router calls inside the component.

The coach card `Почему так` action should open a local bottom sheet on `/`, not navigate to `/sleep-plan` and not create a new route. Keep the exact explanation in a pure core helper such as `buildSleepCoachWhySheetVm(...)`; React may pass the current snapshot, selected scenario/scenario id, active/effective plan, next-sleep projection, predicted bedtime, day-sleep summary, active/awake duration, and temporary-mode badge, but must not recalculate bedtime or wake windows inline. The sheet is read-only UI state: do not write SQLite rows, temporary modes, snapshots, history, notifications, export/import data, or app settings when opening or closing it.

The coach card `Другие варианты` action should open a local bottom sheet on `/`, not navigate to `/sleep-plan`, and not expose the full `snapshot.scenarios` list on the first level. Keep the alternatives list in a pure core helper such as `buildSleepCoachAlternativesSheetVm(...)`: source it from `snapshot.scenarios`, place the currently recommended scenario first when it can be matched by `scenarioId`, mark it with `Рекомендуем сейчас`, and show a calm fallback such as `Пока есть только одна подходящая рекомендация.` when there are no real alternatives.

Keep `src/components/SleepCoachAlternativesSheet.tsx` presentational and use the established `Modal` + `BottomSheetSafeArea` bottom-sheet pattern. Opening or closing the alternatives sheet must be read-only UI state: do not save the selected scenario, do not create temporary modes, do not rewrite active plans or target day plans, and do not change `buildTodaySleepSnapshot`.

Keep `src/components/SleepCoachWhySheet.tsx` presentational and use the established `Modal` + `BottomSheetSafeArea` bottom-sheet pattern. The sheet should render only available VM sections, use a calm fallback when data is incomplete, and never show empty lines or user-facing `undefined`, `null`, or `NaN`. Active-sleep explanations should focus on current sleep duration, day sleep, and bedtime projection; awake explanations should focus on current wake duration, next sleep window/projection, bedtime projection, and the calm reason for the current recommendation.

On the main `/` screen, render the coach card after the hero status and primary sleep actions, before `Сегодня коротко`, old scenario/regression blocks, bottle-feeding cards, and the mixed timeline. For today with an active plan, do not render the old first-level scenario list or the old first-level `Поделиться` button near the coach recommendation; keep any legacy scenario/share flow behind explicit details or fallback screens only. The card should be visually stronger than ordinary info cards through a calm primary accent, but avoid red, bright yellow, or warning/error styling for normal day drift. Bottle feeding must not visually outrank the sleep actions or the coach card.

Before wiring the coach card into UI, lock the core view-model contract with unit tests next to `src/core/mainScreenSleepCoach.ts`. Test visible today states, hidden non-today/tracking-only/no-data states, unsafe or partial snapshots, temporary-mode badge passthrough, alternatives metadata, calm bedtime wording, absence of `undefined`/`null`/`NaN`, and that the helper does not mutate the plan or snapshot inputs.

When changing the coach card, cover at least:
- tracking-only without active plan returns `visible=false`;
- past/future selected date returns `visible=false`;
- active-plan/no-records today returns `visible=false`;
- active sleep copy does not contain `после сна`;
- awake states cover calm, preparation, and act-now recommendations;
- next step is night uses early-bedtime copy only for the `earlyBedtime` scenario and calm night copy for on-plan `normal` scenarios;
- temporary-mode badge and alternatives metadata pass through;
- `Почему так` bottom sheet opens through the existing modal pattern and remains read-only;
- `Другие варианты` bottom sheet opens through the existing modal pattern, uses `snapshot.scenarios`, puts the recommended scenario first, and remains read-only;
- tracking-only without active plan and empty/one-scenario states do not show competing scenario UI on the main screen;
- active-sleep and awake explanation VM sections show only available data and fall back calmly when data is incomplete;
- bedtime anchors and explanation lines include both the clock time and relative duration, including the short `< 1 hour` case and the longer `> 1 hour` case;
- all user-facing strings are free of `undefined`, `null`, and `NaN`.

## Implementation lessons from main screen short summary

The main `/` screen should use one compact `Сегодня коротко` block for lightweight forecast and factual rows instead of four equal-weight first-level cards for `Следующий сон`, `Прогноз ночи`, `Сон днем`, and `До цели бодрств.`. Keep this decision in a pure helper such as `src/core/todayShortSummary.ts`; React should pass the already-built snapshot, day summary, latest feeding, and `deriveMainScreenSleepUiState(...)`, then render the returned `TodayShortSummaryVm`.

Keep `src/components/TodayShortSummary.tsx` presentational. It should accept `TodayShortSummaryVm`, return `null` when `vm.visible=false`, render only rows provided by the VM, and receive the `Подробнее` callback from the screen. Do not put sleep calculations, SQLite calls, feeding writes, temporary-mode writes, or direct Expo Router calls inside the component.

For today with an active plan, show `Сегодня коротко` after `SleepCoachCard` and before plan detail blocks, bottle-feeding cards, and the timeline. It may show 2-4 short rows when data exists:
- `Следующий сон в HH:MM (через X часов Y минут)` only while the child is awake and a next nap target is available;
- `Отбой: около HH:MM (через X часов Y минут)` only when predicted bedtime is available;
- `Дневной сон: X` only when factual day-sleep summary is available;
- `Кормление: X назад` only when bottle feeding is enabled and a latest feeding exists.

During an active sleep, do not show a first-level next-sleep row or card such as `Следующий сон: после сна`. Use calm copy like `После пробуждения покажем следующее окно`, while bedtime and factual day-sleep rows may still be shown if available.

The `Подробнее` action should reuse an existing read-only bottom sheet when possible, such as the sleep coach `Почему так` sheet, rather than adding a route or writing any state. If there are no safe details, hide the action while keeping available summary rows.

For `tracking_only` without an active persisted target plan, `Сегодня коротко` must not show plan-based rows such as next sleep, bedtime, scenarios, or remaining awake time. It may show factual rows only, such as day sleep or latest bottle feeding, when those facts already exist.

Keep `До цели бодрств.` and summed 24-hour awake time off the first-level main screen. Detailed `Бодрствование за 24 часа (ВБ)` belongs in expanded `/sleep-plan` checks; the main screen must not reintroduce it through `Сегодня коротко`.

When changing `Сегодня коротко`, cover at least:
- today + active plan shows available compact forecast and factual rows;
- next sleep uses one target clock time from `snapshot.nextSleepAt` with a long relative duration, not a min/max minute range;
- bedtime uses one predicted clock time from `snapshot.predictedBedtimeAt` with a long relative duration and stays aligned with the coach card wording;
- active sleep does not show `Следующий сон: после сна`;
- `tracking_only` without active plan hides plan rows and can keep factual rows;
- bottle feeding stays secondary and does not affect sleep calculations or recommendations;
- past/future selected days keep their existing retrospective/planning behavior;
- all user-facing strings are free of `undefined`, `null`, and `NaN`.

## Implementation lessons from main screen all-in-order records

The main `/` screen should show the full editable mixed record block `Всё по порядку` on the first level. Do not replace it with a compact `Последние записи` preview, and do not hide it behind a `Все записи` expansion action unless a later task explicitly asks for that product change. The preview added an extra decision and step for parents, so the simpler default is to show the operational feed immediately.

Use `src/core/dayFeed.ts` as the source for displayed mixed rows. Do not duplicate nested/standalone feeding assignment or same-time sorting rules in `src/app/index.tsx` or presentational components. If `dayFeed.ts` changes, update or add `src/core/dayFeed.test.ts`.

For the first-level `Всё по порядку` block:
- render selected-day and previous-day groups immediately;
- keep record counts, `Нет записей` empty rows, and direct edit access through the existing sleep and bottle-feeding editors;
- keep bottle feedings nested inside sleep when appropriate, standalone outside sleep, and a feeding with the same visible time after the sleep row;
- show the compact local `Кормление` switch only when bottle feeding is enabled;
- keep the switch as local UI state only and do not persist it;
- avoid `LastRecordsPreview`, `isFullTimelineExpanded`, `openAllRecords`, or similar preview/expand plumbing unless explicitly requested.

When changing this area, cover at least:
- default main screen shows `Всё по порядку` without requiring `Все записи`;
- old first-level `Последние записи` / `Все записи` copy is absent;
- nested feedings do not duplicate as standalone rows;
- feeding visibility follows the profile setting and the local `Кормление` switch;
- `cmd /c npm run typecheck` and `cmd /c npm run test` pass;
- smoke-test the main screen in a narrow Expo web viewport or on Android and check that `Всё по порядку` is visible directly on the page.

## Implementation lessons from first active plan with no sleep records

When a parent chooses a permanent target day plan for the first time and returns to the main `/` screen later in the same day, the app may have an active plan but no sleep records for the current sleep day. Do not treat this as a real all-day awake interval from `plan.dayStartMinutes`.

For today's active-plan/no-records state:
- do not show plan-based prediction cards, recommendation scenarios, `onTrackLabel`, remaining-awake metrics, nap counts, or predicted bedtime as if they were factual;
- show a calm onboarding state such as `План готов` / `Сегодня ещё без оценки`;
- offer simple actions to `Внести сон` and start the nearest sleep, with the start button label allowed to become `Начать ночь` when `inferSleepKindForStart(now, effectivePlan)` returns `night`;
- keep this state UI-only: do not write `target_day_plan`, `sleep_day_temporary_mode`, saved snapshots, history, schema, export/import data, or app settings merely because the user skipped backfilling today's sleep;
- once the first sleep record exists, return to normal effective-plan calculations automatically.

Keep the branch decision in a pure helper such as `src/core/mainScreenFlow.ts`, and let `src/app/index.tsx` only render the resulting state. Future or past selected days with an active plan may still show plan-oriented views according to their existing screen rules; the no-data calming state is specifically for today after plan selection.

When changing this area, cover at least:
- active plan + today + zero selected sleep records shows the calm no-data state instead of plan predictions;
- active plan + today + at least one sleep record restores normal predictions;
- no active plan + zero records still uses the tracking-only empty state;
- non-today plan views are not accidentally hidden by the today-only no-data state.

## Implementation lessons from main screen performance optimization

On the main `/` screen, do not load child profile, target plans, and selected-day sleep data as separate focus effects that trigger each other through a reload counter. Load profile first, then selected-day data with the fresh profile settings, then plan list in one coordinated focus load so birth-date/age-dependent UI does not visibly update after the first render.

Keep frequently changing timer state local to the smallest component that displays it. During active sleep, seconds may update in a dedicated timer text component for the first few minutes, but the parent screen should keep a coarse refresh such as 30 seconds so cards, scenarios, timeline rows, header actions, and feeding rows are not re-rendered every second.

Do not add unused data loads to the home screen. If a stat is not rendered or needed for sharing/current UI, do not query it on every home-screen reload; keep feeding and sleep range queries scoped to the visible card/timeline behavior.

After local sleep or feeding writes, update the local UI first and run notification synchronization in the background with swallowed errors. Notification state must not keep the main sleep button or editor in a saving state after SQLite has already accepted the change.

When optimizing `/`, preserve the existing effective-plan boundaries: no schema changes, no `target_day_plan` rewrites, no temporary-mode writes except the explicit parent action, and no new standalone summed-WB card.

## Implementation lessons from main screen timeline filtering

The main `/` screen should show the lower operational record list as the full mixed `Всё по порядку` block by default. Do not add a separate collapsed/expanded state for this list unless the task explicitly asks for it.

When bottle feeding is enabled, feeding rows may appear in `Всё по порядку` by default. The block may show a compact local switch such as `Кормление` near the title so the parent can temporarily hide both standalone bottle feeding rows and bottle feedings nested inside sleep rows. When the feature is disabled in the profile, feeding rows and the switch must not be visible.

The feeding visibility switch is UI state only. Do not write it to SQLite, `child_profile`, app settings, sleep-day plans, temporary modes, snapshots, history, export/import data, or notification state unless a later task explicitly asks for persistence.

Keep the separate bottle feeding card, editor, reminders, settings, and share summary behavior intact. Timeline feeding visibility should only affect what is displayed in `Всё по порядку` and its visible record counts.

For implementation, prefer passing an empty feeding array into the existing day-feed composition path when feedings are hidden instead of duplicating timeline rendering logic. When changing this area, cover at least:
- default first-level main screen shows the full editable `Всё по порядку` block;
- no extra `Все записи` action is required to see selected/previous day groups;
- bottle feeding enabled includes standalone feedings;
- bottle feeding enabled includes feedings nested inside sleep;
- temporarily hiding feedings removes nested feeding rows as well as standalone rows;
- the mini sleep timeline remains sleep-only.

## Implementation lessons from final main screen regression checks

After broad changes to the main `/` screen, run a final regression pass that combines focused core tests with a small manual UI matrix. Do not rely only on screenshots of the happy path, because most main-screen regressions come from view-state gates crossing each other.

At minimum, cover these states before calling the main screen stable:
- first-run and `tracking_only` without an active plan;
- today with an active plan while the child is sleeping;
- today with an active plan while the child is awake;
- past selected date opened directly and from `/sleep-retrospective`;
- future/tomorrow selected date while today has or recently had an active sleep;
- temporary modes off, `soft_day`, `early_wake`, and combined mode order;
- bottle feeding disabled and enabled;
- full `Всё по порядку` block, nested feedings, standalone feedings, and same-visible-time ordering;
- bottom navigation plus every bottom sheet/modal touched by the change.

Use unit tests for pure logic that is expensive or brittle to recreate manually in the browser, especially `early_wake` derivation, combined temporary mode ordering, evening prompt gates, notification permission boundaries, and mixed timeline sorting. Use the browser smoke check to verify what tests cannot see: text hierarchy, missing or duplicate first-level blocks, active tab highlighting, and bottom safe-area behavior.

For `tracking_only` smoke checks, confirm that factual sleep logging still works while plan-dependent guidance stays hidden: no `SleepCoachCard`, no plan forecast rows, no temporary-mode badge, no plan share prompt, and no standalone remaining-awake or summed-WB card. For active-plan smoke checks, confirm that `SleepCoachCard`, `TodayShortSummary`, and `Всё по порядку` stay in the intended order and that bottle feeding never visually outranks the sleep action or coach surfaces.

If manual browser checks require creating local sleep or feeding records, use a disposable web origin/database when possible. If records are created in the user's active local browser data, either clean them up before finishing or explicitly report that the local smoke data remains.

## Implementation lessons from `/sleep-plan` active state simplification

The active state of `/sleep-plan` should stay a calm parent-facing overview before plan management. When an active plan exists, keep the first-level order:
- active plan summary;
- `Сегодня` temporary mode controls;
- `План на сегодня`;
- collapsed `Проверка и расчёт`;
- `Управлять планами`.

The active plan summary must describe the permanent active `target_day_plan`: plan name, nap count, active state, wake-up around time, and a soft tolerance note. Do not replace this summary with `effective_plan` values when `soft_day` or `early_wake` is enabled.

The `План на сегодня` block must use the active temporary modes for the current sleep-day and call `buildEffectiveSleepDayPlan`. Temporary mode toggles on this screen must write only `sleep_day_temporary_mode`; they must not update `target_day_plan`, saved snapshots, history, export/import format, or schema unless a later task explicitly asks for that.

For `early_wake`, `/sleep-plan` must not call `buildEffectiveSleepDayPlan(..., { actualWakeTime: null })` when today's sleep sessions are available. Load nearby sleep sessions for the current morning, derive `actualWakeTime` with the same pure helper used by `/`, and pass it into the effective plan so `План на сегодня` starts from the real wake-up instead of the permanent wake-up range.

For the compact daily preview, calculate the full planned sequence from the effective plan's `wakeWindows`. Use a pure core helper such as `buildSleepPlanTimelineItems` in `src/core/sleepPlanTimeline.ts`; UI should only format labels, badges, and row layout. Do not revive `buildIdealSleepPlanSegments` or an equal-slot schedule preview for this top block: `early_wake` changes only the first wake window, so a preview that ignores `wakeWindows` can fail to visibly change after the mode is enabled.

The `План на сегодня` block on `/sleep-plan` is a full planned timeline, visually close to the main screen timeline: show `Подъём`, every planned `ВБ`, every daytime `Сон`, the final `ВБ`, and `Ночь` inline in one list. Do not hide planned wake windows behind `Показать окна бодрствования` here. Each `ВБ` row should show the target duration and calm min/max range so the parent can see the next step without opening another detail layer.

When `early_wake` shifts the effective start, the `Подъём` row should show the actual start as fact and keep the permanent range secondary, for example `факт · обычно 07:00 - 07:30`. Do not label the actual early wake-up as a changed permanent plan.

Do not confuse planned `ВБ` rows in the `/sleep-plan` timeline with summed 24-hour awake time. Inline planned `ВБ` belongs to the daily sequence. Summed `Бодрствование за 24 часа (ВБ)` remains detail content inside expanded `Проверка и расчёт` and must not become a standalone first-level card on `/` or `/sleep-plan`.

Keep `/sleep-plan` guideline checks as a compact `Проверка и расчёт` block, not as three large A/B/C cards. The collapsed state should show only the title, three short statuses for 24-hour sleep, daytime sleep, and wake windows, plus `Подробнее о расчёте`. The expanded state can show Level A/B/C details and `i` links.

Keep the compact check calculation in pure core code such as `src/core/sleepPlanChecks.ts`. UI should pass the current draft/effective plan into core and render returned labels/ranges; it should not duplicate A/B/C status math in React.

When the child age is unknown on `/sleep-plan`, the compact `Проверка и расчёт` block must explain what is missing instead of showing unexplained `не рассчитано`. Use a short calm status such as `нужен возраст`, show a compact prompt to enter the child's age or birth date, and open the existing local `Профиль ребёнка` prompt. Do not create a plan, write temporary modes, navigate away to `/profile`, or make medical claims from this prompt.

For compact checks, Level A must continue to compare only total sleep over 24 hours against the official guideline. Level B compares practical daytime sleep, and Level C compares practical wake windows. Do not call Level B or Level C an official medical norm, and do not merge them into one combined "sleep norm" status.

Show total awake time (`Бодрствование за 24 часа (ВБ)`) only inside expanded `Проверка и расчёт` on `/sleep-plan`. Do not show summed 24-hour awake time on the main "Сон сегодня" screen; the main screen may show remaining awake time, but not `всего ...` awake time. If temporary modes are active on `/sleep-plan`, the expanded awake-time detail should compare `Обычный план` and `Сегодня`.

Do not reintroduce `Применить к плану` or a similar primary CTA into the first-level `Проверка и расчёт` block. If an apply/customization flow is needed later, put it in `Настроить вручную` or the preset/manual plan flow so guideline checks stay explanatory.

Keep plan deletion off the main top surface. Prefer the bottom of `Управлять планами` or an overflow action, so the active overview focuses on today's plan rather than destructive management.

Under the active plan summary on `/sleep-plan`, keep exactly two equal-width quick actions when an active plan exists:
- `Сменить шаблон` opens the explicit preset/template flow;
- `Редактировать график` scrolls to the selected-plan editor inside `Управлять планами`.

Do not duplicate `Сменить шаблон` again inside the lower `Управлять планами` block. The quick action is allowed above `Сегодня` because it reduces hunting through the long screen, but it must still open the same explicit flow and must not auto-create plans, temporary modes, snapshots, or schema changes.

When implementing scroll-to-section actions in React Native / React Native Web, remember that nested `onLayout` `layout.y` is relative to the parent, not a global scroll offset. For a target inside `Управлять планами`, store both the parent section `y` and the target local `y`, then scroll to `parentY + targetY` with a small top offset. A fallback `scrollToEnd` is acceptable only when the layout target has not been measured yet.

When smoke-testing Expo web and local SQLite throws `NoModificationAllowedError` from an existing origin lock, test on a fresh port/origin such as `localhost:19006` and stop any temporary server afterwards. Treat that as a web storage locking issue, not as a `/sleep-plan` UI regression.

## Implementation lessons from `/sleep-plan` preset template selection flow

The `/sleep-plan` preset selection flow is the first-run path for choosing a permanent base `target_day_plan`. It is not a temporary day mode and must not create `sleep_day_temporary_mode` rows.

Keep the empty active-plan state reachable. `listTargetDayPlans` and other UI-facing reads that need the real plan list must not silently insert a default `target_day_plan`. Fallback helpers such as `getTargetDayPlan` / `getSleepDayPlan` may still return `DEFAULT_SLEEP_PLAN` for calculations when no plan exists, but they should not create a persistent row unless the user explicitly applies a plan.

For age-based preset selection:
- if `child_profile.birthDate` exists, derive the catalog from the profile age and ignore manual age band selection;
- if birth date is missing, show `Указать дату рождения ребёнка` plus manual age-band chips, and do not block plan selection without birth date;
- manual age-band selection is screen-local and must not write to `child_profile`;
- show only `recommendedPreset` and one `alternativePreset` on the first selection level;
- highlight the recommended preset with `Рекомендуем`, but never auto-select or auto-save it;
- require an explicit `Выбрать этот план`, then show `Ваш базовый план` preview;
- create and activate a `target_day_plan` only after `Использовать этот план`;
- use a readable preset name such as `4 сна · 5–6 мес`;
- keep `eveningRulesMode: "auto"` for plans created directly from a preset template.

In the first-run empty-plan state, `Указать дату рождения ребёнка` must open a local profile prompt instead of navigating away to `/profile`. The prompt should mirror the simple profile fields for `name` and `birthDate`, use the same local validation and Android date picker pattern, save through `updateChildProfile`, close after a successful save, and leave the parent in the template selection flow. Saving a birth date should clear any screen-local manual age-band selection so the catalog is recalculated from the saved profile age. This prompt must not create or activate a `target_day_plan`, write temporary day modes, or hide the manual age-band fallback for parents who do not want to fill the profile yet.

The manual path starts from a selected/recommended preset, not an empty form. If the parent changes details before saving, create an active custom plan such as `Свой план · 5–6 мес`; do not mutate an existing active plan just because the user opened the manual flow.

When an active plan already exists, the change-template entry point must live in `Управлять планами`. It should open the same explicit preset flow, but it must not become a top-level CTA in the calm active overview, must not create `sleep_day_temporary_mode`, and must not delete or mutate the current plan before the parent confirms a new preview with `Использовать этот план` or saves a custom plan.

For change-template with an active plan, keep the current-age recommendation first, but do not render every age template as one long card list. Show the current-age `recommendedPreset`/`alternativePreset` first under a calm `Подходит сейчас` section. Put all other age groups behind a simple dropdown/list control such as `Другой возраст` -> age band -> two templates for that age. This keeps the screen short, avoids forcing a tired parent to scan all variants, and still allows viewing any template.

Keep the first-run state stricter than change-template: without an active plan, the first selection level should still show only the selected/recommended age band's two templates. Do not expose all other age templates on first-run unless a later product task explicitly asks for a broader onboarding flow.

For all preset-template surfaces, only the first current-age recommendation should get the `Рекомендуем` emphasis. Recommended presets from other age bands can be selectable, but they should read as age-specific alternatives (`Когда рассматривать`), not as the app's primary recommendation for the current child.

When changing this flow, cover at least:
- no birth date: manual age group can reveal presets and save a plan;
- no birth date: `Указать дату рождения ребёнка` opens the local profile prompt with child name, birth date, and `Сохранить`;
- saving the first-run profile prompt updates `child_profile`, closes the prompt, and recalculates preset recommendations without leaving `/sleep-plan`;
- birth date: profile age drives the recommended preset;
- recommended preset is not selected before the user taps `Выбрать этот план`;
- the first selection level has no more than two preset cards;
- change-template shows current-age templates first and keeps other age groups behind a dropdown;
- selecting another age in change-template reveals only that age group's templates;
- active state has the two quick actions under the summary: `Сменить шаблон` and `Редактировать график`;
- `Сменить шаблон` is not duplicated inside lower `Управлять планами`;
- `Редактировать график` scrolls to the selected-plan editor, not merely to the next visible block;
- `Использовать этот план` creates an active `target_day_plan`;
- returning to `/sleep-plan` shows the normal active state for the created plan;
- TypeScript checks and unit tests pass.

## Implementation lessons from explicit first-run onboarding state

The app has an explicit app-level onboarding state. A clean database with no `app_settings` row and no active `target_day_plan` is `not_started`, not an error and not a reason to insert a default plan.

Keep onboarding state separate from child profile, sleep sessions, target plans, temporary modes, snapshots, and backup/import format unless a later task explicitly asks for those formats to change. The current minimal storage is `app_settings`:
- `onboarding_completed_at`;
- `onboarding_mode`, where valid saved modes are `tracking_only` and `plan_saved`;
- `evening_plan_prompt_dismissed_date_key` for hiding the main-screen evening plan prompt only for one sleep-day;
- `tracking_only_bridge_dismissed_date_key` is legacy state for the old always-visible tracking-only bridge and must not drive new main-screen plan prompts unless a later task explicitly revives that behavior.

Use the existing app settings repository for app-level flags:
- `getOnboardingState(db)` for derived state;
- `completeOnboardingTrackingOnly(db)` after the parent chooses `Пока просто записывать сны`;
- `markOnboardingPlanSaved(db)` after an explicit target day plan save/activation;
- `dismissEveningPlanPrompt(db, dateKey)` when the parent taps `Не сегодня` on the main-screen evening plan prompt;
- `dismissTrackingOnlyBridgePrompt(db, dateKey)` only for legacy bridge compatibility.

Keep derivation pure in `src/core/onboarding.ts`. `deriveOnboardingState` must treat an existing active `target_day_plan` as `plan_saved` so old databases with a plan do not return to first-run, but it must treat an empty plan list without app settings as `not_started`.

Do not automatically persist `DEFAULT_SLEEP_PLAN`, preset templates, or any fallback plan into `target_day_plan`. Fallback helpers such as `getTargetDayPlan` and `getSleepDayPlan` may return `DEFAULT_SLEEP_PLAN` for calculations, but they must not create persistent `target_day_plan` rows without an explicit parent action.

On `/sleep-plan`, first-run can offer two calm paths:
- choose and confirm a base plan, which creates/activates `target_day_plan` and marks onboarding `plan_saved`;
- `Пока просто записывать сны`, which marks onboarding `tracking_only` and leaves `target_day_plan` empty.

Use a dedicated `src/app/first-run.tsx` route as the clean-install entry screen when onboarding is `not_started`. The main `/` screen should check `getOnboardingState(db)` before loading child profile, target plans, selected-day sessions, snapshots, recommendations, feeding data, or notification-derived state; if the state is `not_started`, replace navigation with `/first-run` so parents do not see the overloaded empty home screen.

Keep `/first-run` intentionally smaller than `/sleep-plan`. It may show only:
- title `План дня для сна малыша`;
- one short value statement;
- 2-3 example outputs such as next sleep, current awake time, and bedtime;
- primary action `Выбрать План дня`;
- secondary action `Пока просто записывать сны`;
- `Как это работает` as a bottom sheet, not a separate help route.

Keep clean-install first screens visually compact. On `/first-run`, the preset-selection entry state on `/sleep-plan`, preset cards, and the local profile prompt, avoid oversized hero typography and very heavy text weights. Prefer compact headings, short line lengths, calm captions, and dense-but-tappable controls; verify in a narrow Android-like Expo web viewport such as `360x760` that text wraps instead of clipping and bottom actions stay visible above the navigation area.

The `/first-run` `Как это работает` bottom sheet should stay short and practical:
- explain that the parent chooses a `План дня`;
- explain that the app counts current wake time and suggests the next sleep;
- explain that a day can be handled flexibly with softer scenarios after a difficult night or early wake-up.
Use `Понятно` as the primary close action. An optional `Выбрать План дня` secondary action should close the sheet and navigate to `/sleep-plan?source=first-run&returnTo=home`. Closing the sheet must not write onboarding state, create a plan, write temporary modes, or navigate to `/info`. Do not use the word `идеальный` here and do not add medical, scientific, or research explanations.

Do not put forecasts, scenario cards, retrospective, temporary modes, feeding, notifications, export/import, local-storage explanations, or detailed help on `/first-run`. The screen's job is to choose the next onboarding path, not to teach the full app.

From `/first-run`, `Выбрать План дня` should navigate to `/sleep-plan` with explicit parameters such as `source=first-run` and `returnTo=home`. `/sleep-plan` should still require the existing explicit preset confirmation; after a plan is saved from this first-run path, replace navigation with `/` so the parent lands on the main sleep screen with the chosen plan. Do not create a plan merely by opening `/sleep-plan`.

Do not duplicate base-plan selection UI on `/first-run`. Age-band chips, `Указать дату рождения ребёнка`, the local `Профиль ребёнка` prompt with name and birth date, preset cards, preview, manual edits, and `Использовать этот план` all belong to the existing `/sleep-plan` flow. If first-run needs to start plan selection, route to `/sleep-plan?source=first-run&returnTo=home`; `/sleep-plan` should treat that return behavior only while onboarding is still `not_started`, so a completed user who opens `/sleep-plan` with stale params stays in the normal plan-management scenario.

From `/first-run`, `Пока просто записывать сны` should open a short local name prompt, save the child name through the existing profile repository, mark onboarding with `completeOnboardingTrackingOnly(db)`, and then replace navigation with `/`. It should not ask for birth date, notifications, feeding setup, export/import, or plan details.

For the `/first-run` tracking-only name prompt:
- keep the input empty by default; do not prefill or save `DEFAULT_CHILD_NAME`;
- use the shared child-name helper in `src/core/childProfile.ts` for trim/max-length validation;
- `Продолжить` with a non-empty trimmed name may call `updateChildProfileName`, but an empty trimmed name should skip the profile write and still complete tracking-only onboarding;
- `Пропустить` is a completion action that writes `tracking_only` and replaces navigation with `/`, not a modal cancel;
- do not call `updateChildProfile` from this prompt, because it can accidentally reset birth date or unrelated profile fields.

Do not request or trigger notification permission while onboarding is `not_started` or `tracking_only`. Sleep reminder and active-sleep notification synchronization must return before loading fallback target plans, active sessions, or calling the shared notification permission helper unless onboarding is `plan_saved`; otherwise tracking-only sleep logging can accidentally cause a notification permission prompt before the parent has chosen a plan.

Keep notification permission checks and permission requests separate. `hasNotificationPermission(...)` must be a read-only check that calls `getPermissionsAsync()` only; it must not call `requestPermissionsAsync()`. The system permission prompt may be triggered only from an explicit parent action such as a calm in-app prompt after `target_day_plan` has been saved/activated and onboarding is `plan_saved`.

The root notification sync component must also respect onboarding state. Do not configure notification handlers, Android channels, active-sleep notification modules, sleep reminders, or bottle-feeding reminders on app startup until `getOnboardingState(db)` is `plan_saved`. A manual sleep entry, active sleep start/stop, tracking-only onboarding completion, profile save, feeding write, or restore/import must not accidentally create a notification channel or request notification permission before a plan exists.

After the first successful plan save/activation, the main `/` screen may show one calm optional notification prompt. `Включить` may call the explicit permission request helper and then best-effort notification sync; `Позже`, system denial, or sync failure must only hide/skip notification setup for the current UI flow and must not break the saved plan, local sleep logging, or tracking-only history.

When `onboardingState === 'tracking_only'` and no active `target_day_plan` exists, the main `/` screen must render a real tracking-only factual state instead of plan-based recommendations from fallback `DEFAULT_SLEEP_PLAN`.

In this main-screen tracking-only state:
- `loadMainScreenData` or the nearest view-model layer should expose `hasActiveTargetPlan`, `onboardingMode`, and `eveningPlanPromptDismissedDateKey`;
- show the current factual sleep/awake status when it can be derived from real sleep sessions, the `Начать сон` / `Завершить сон` action, `Внести сон`, the factual timeline, and a simple empty hint when there are no sleep records;
- show the evening plan prompt only when all conditions are true: `onboarding_mode = tracking_only`, no active `target_day_plan`, selected date is today, at least one sleep record exists in the current sleep-day, local time is `18:00` or later, and `evening_plan_prompt_dismissed_date_key` is not the current sleep-day key;
- keep the prompt text exactly calm and optional: title `Уже есть первые записи сна`, primary `Выбрать План дня`, secondary `Не сегодня`;
- `Выбрать План дня` routes to `/sleep-plan?source=evening-prompt&returnTo=home`;
- `Не сегодня` writes only `evening_plan_prompt_dismissed_date_key` for the current sleep-day and must not complete or leave tracking-only mode, create plans, write temporary modes, or request notifications.

Keep evening prompt visibility in pure core code such as `shouldShowEveningPlanPrompt(...)` in `src/core/onboarding.ts`; the UI should pass already-derived facts such as current sleep-day key, sleep session count, local minutes from midnight, onboarding mode, active-plan state, and dismissed key.

In this main-screen tracking-only state, do not show `Следующий сон`, `Прогноз ночи`, `До цели бодрств.`, `Сценарии`, `Проверка и расчёт`, temporary-mode badges, early-wake suggestions, share text based on a plan, or any forecast/recommendation derived from fallback `DEFAULT_SLEEP_PLAN`.

When no active `target_day_plan` exists, `/sleep-plan` should show the explicit base-plan preset selection as the main function, including after the parent previously chose `Пока просто записывать сны`. Do not show an empty `Управлять планами` surface as the first-level state. Keep `Пока просто записывать сны` visible only for true first-run or evening-prompt entry points where it is a meaningful exit; after the parent is already in `tracking_only`, ordinary `/sleep-plan` visits should focus on choosing a template. After the parent explicitly saves a plan from `/sleep-plan?source=evening-prompt&returnTo=home`, replace navigation with `/`.

When adding or changing onboarding persistence, bump `DATABASE_VERSION`, keep the fresh schema and migration idempotent with `CREATE TABLE IF NOT EXISTS` / additive changes, and do not use `DROP TABLE`, database resets, or `DELETE FROM` user data. Cover:
- pure onboarding derivation: `not_started`, `tracking_only`, `plan_saved`, and old database with active plan;
- schema/migration guard for `app_settings`;
- `tracking_only` save;
- evening plan prompt visibility and dismissal for one sleep-day without writing `target_day_plan`;
- `target_day_plan` save/activation marks `plan_saved`;
- notification synchronization does not request permissions in `not_started` or `tracking_only`;
- notification permission helpers keep read-only checks separate from explicit requests;
- first manual sleep entry without a plan does not import/configure notification scheduling or ask for permission;
- fallback plan reads do not insert into `target_day_plan`.

Keep first-run/tracking-only view decisions in pure core helpers when possible. For the main `/` screen, use a small view-state helper such as `deriveMainScreenSleepUiState(...)` to make the permanent boundary explicit: no active `target_day_plan` hides plan predictions, but start/stop sleep, manual sleep entry, and the factual timeline stay available.

Keep `/sleep-plan` return behavior after preset/manual plan save in pure onboarding/navigation decision code such as `getSleepPlanChoiceNavigationAction(...)`. `source=first-run&returnTo=home` should replace to `/` only while onboarding is still `not_started`; `source=evening-prompt&returnTo=home` should replace to `/` only while onboarding is `tracking_only`. Ordinary `/sleep-plan` visits and stale query params after onboarding is complete must stay in normal plan management.

When adding tests for first-run/tracking-only flows, prefer fast pure/repository tests over fragile React Native render tests unless the visual tree itself changed. Cover:
- onboarding state derivation and repository transitions;
- fallback plan reads without `target_day_plan` writes;
- explicit plan save/activation as the only target-plan creation path;
- main-screen no-plan UI state: predictions hidden, factual actions and timeline available;
- evening prompt morning/no-session/evening/dismissed/plan-saved cases;
- `/sleep-plan` first-run/evening-prompt return navigation and ordinary non-return flow.

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

## Implementation lessons from Android sleep widget

For the Android home-screen sleep widget, keep the user-facing behavior minimal: one compact widget that shows `Бодрствует` / `Сон идёт`, a short timestamp detail, and one action button. Do not show a live elapsed timer in the widget; Android widget updates are not continuous enough for that. Keep the live timer in the active sleep notification and in the app UI.

In Expo SDK 56, `expo-widgets` is not the right path for Android home-screen widgets. Use a native Android `AppWidgetProvider` plus `RemoteViews`, registered through the existing config plugin. Keep Android widget XML resources as source files under `native/android/res/...` and have the config plugin copy them into the generated Android project. Do not edit or commit generated `/android` files.

Widget button taps can run while the React/JS runtime is not alive. Do not route the core start/stop action through React state, Expo Router, screen handlers, or selected-day UI arrays. The widget must perform a small native SQLite transaction against the global active sleep state, then refresh itself and the active sleep notification. JS may only request a best-effort widget refresh after normal in-app mutations.

When native widget code reads the Expo SQLite database, use the Expo SQLite default location: `context.filesDir/SQLite/<DATABASE_NAME>`. Do not use `context.getDatabasePath(DATABASE_NAME)`, because that points at Android's default `/databases` directory and will not see the app's `SQLiteProvider` database.

Before allowing the widget to write, check `PRAGMA user_version >= DATABASE_VERSION`. If the database does not exist or is older than the bundled schema, show `Откройте приложение` and avoid writing. The app migration should refresh the widget after `migrateDatabase` completes.

Widget writes must preserve the same product boundaries as the app:
- create or stop only `sleep_sessions`;
- update needed `sleep_day_plan_snapshot` rows from the active target plan or fallback plan;
- do not create `target_day_plan`, write temporary modes, rewrite saved history beyond affected snapshots, request notification permissions, or add backend/cloud behavior.

After running `expo prebuild --platform android --no-install` for verification, check for and undo unrelated generated side effects such as `package.json` script rewrites. The generated `/android` folder is ignored and should be removed after inspection unless the task explicitly asks to keep native project output.

TypeScript checks and Vitest do not compile Android widget Kotlin or validate `RemoteViews` resources. For widget changes, at minimum verify the config plugin with prebuild and inline-module scanner, but the feature is not fully verified until an Android APK/dev build is compiled and smoke-tested on a device with the widget added to the home screen.
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

On the main screen, the first-level record section is named `Всё по порядку`. It is the full sleep/feed-capable operational feed, not a preview and not an analytics table. If bottle feeding is enabled, feeding rows can appear in this block and the local `Кормление` switch can hide or show them; if bottle feeding is disabled, no feeding rows or feeding switch appear.

For the main two-day timeline, group sleep rows by displayed overlap with the selected sleep-day window, not only by raw `startedAt`. A night sleep that started yesterday and ends in the selected day should appear in the selected day's group because that is where the parent sees the wake-up context. For sleep that crosses midnight, show enough date context in the time range, for example `22:10 вчера - 06:40 сегодня`, so parents can understand the overnight transition without opening the editor.

When the `Кормления` filter mixes sleep and bottle-feeding rows on the main screen, use one explicit display item model, such as `src/core/dayFeed.ts`, instead of separate ad hoc sort/group logic in React. Keep a display `sortAt` separate from the persisted `startedAt`: bottle feedings sort by their `startedAt`; sleep rows sort by `max(session.startedAt, groupStart)` so clipped overnight sleep is ordered by its visible place in that day. Sort rows newest-first inside each day group, with the records closest to "now" at the top. If two records have the same visible time, keep sleep before feeding. Cover this with focused core tests such as `src/core/dayFeed.test.ts`.

When the `Кормления` filter is enabled, standalone bottle-feeding rows should be grouped by the local calendar day, not by the sleep-day boundary. A feeding at 04:00 today should appear under "Сегодня" even if the selected sleep day started yesterday. However, sleep nesting has priority over standalone calendar grouping: if a feeding timestamp falls inside a displayed sleep interval, show it inside that sleep card and do not duplicate it as a separate row in either day group. Pass a broader nearby-feeding set into the core day-feed builder for nesting candidates, and pass a separately filtered standalone-feeding set for the rows that may appear independently. This prevents an overnight feeding before midnight from being stranded under "Вчера" when the parent is looking at the selected-day night sleep.

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

For each retrospective day, load that day's saved plan snapshot via `getSleepDayPlan`, not only the currently active plan. Build the range from that base plan's `dayStartMinutes`, load sessions for `[dayStart, dayEnd)`, and use the same open-session guard as other history screens: an active session ends at `min(now, dayEnd)` for overlap checks.

If `soft_day` or `early_wake` was active for a retrospective sleep-day, read `sleep_day_temporary_mode` by that exact `sleepDayDate`. Derive any retrospective `effective_plan` from the saved snapshot/base `SleepDayPlan` plus those modes; do not substitute the current active `target_day_plan`. If modes are absent, retrospective behavior should stay the same as before.

Keep effective-plan derivation out of `buildSleepRetrospectiveDay`: the screen or a pure helper should load the saved/base `SleepDayPlan`, derive actual wake for `early_wake` from that day's sleep sessions, call `buildEffectiveSleepDayPlan`, and pass the resulting `SleepDaySummary` plus temporary modes into the retrospective core view model. `buildSleepRetrospectiveDay` should not read SQLite or silently swap plans.

Keep daily cards compact and scannable:
- date and calm status;
- small temporary-mode badges such as "Мягкий день" or "Ранний подъём" only when active modes existed for that sleep-day;
- подъём;
- дневной сон with nap count;
- отбой;
- бодрствование vs plan;
- one short hint.

Retrospective hints should account for temporary day context without sounding corrective. For `soft_day`, acknowledge that the day was intentionally softer and suggest returning to the main plan. For `early_wake`, explain that the day started earlier and the first sleep was shifted softer. Avoid turning this into a dashboard, score, or long explanation.

Details belong on the existing day screen. A retrospective card should navigate to the selected day, for example with a stable `YYYY-MM-DD` sleep-day key route param, instead of duplicating timeline, editing, or record-list UI inside the retrospective screen.

Retrospective copy must be non-judgmental. Prefer statuses like "Близко к плану", "Немного сдвинулся", and "Сильно сдвинулся". Avoid "плохо", "ошибка", "нарушение", medical claims, or guilt language.

Before considering retrospective work done, verify:
- 7, 14, and 21 day periods;
- early morning before day start does not include the still-open current sleep day;
- empty days render calmly;
- active sleep does not leak into future or unrelated days;
- tapping a card opens the correct existing day screen;
- soft-day and early-wake days show compact badges and mode-aware hints;
- old days without temporary modes render as before;
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

For the main screen `Поделиться` button, keep the share message assembly in pure core code (`src/core/shareTodayPlan.ts`). The UI should only pass already-loaded state into `buildTodayPlanShareText`: sleep sessions/effective plan, and, when `bottleFeedingEnabled` is true, `todayBottleFeedings`, the global `latestBottleFeeding`, and `bottleFeedingTopUpThresholdMl`. Today's feedings in share mean the real local calendar day, not the sleep-day boundary or selected display group. The latest feeding must remain a global latest query so the share text can say how much time passed since the last feeding even when today's list is empty. Feedings in the share text are informational only and must not affect sleep snapshots, projections, recommendations, active sleep state, plans, or wake-window calculations.

On the main screen, keep the `Поделиться` action in the `План дня` header next to the active plan label, not beside `SleepCoachCard` and not as a standalone first-level scenario/share block. Gate it through the same today + active-plan view state that allows plan-based blocks. If the share title needs the child name, load it from `ChildProfile` alongside the other profile fields instead of introducing a separate profile query inside the handler.

When changing the `Поделиться` copy or data contract, update `src/core/shareTodayPlan.test.ts`. Cover at least: feedings today, no feedings today with latest feeding yesterday, top-up labeling through the current profile threshold, future/tomorrow feedings excluded from today's section, and the feeding block omitted when bottle feeding is disabled.

On the main screen, if the feeding block is enabled, keep it below the sleep-first surfaces: hero status, sleep start/stop actions, `SleepCoachCard`, and `TodayShortSummary`. Place it above the `План дня` block so the parent can add or open feeding without scrolling past plan controls, but do not place bottle feeding directly under the current sleep status or between the status and sleep action buttons. The home feeding block should be a compact secondary row, not a large competing card: one short title, one latest-feeding line, one today-stats line, and a small secondary quick-add action such as `+ Кормление`. The text area should still open `/bottle-feeding`, and the quick action should reuse the existing bottle-feeding editor. Reload feeding state after create, edit, delete, selected-day changes, and setting toggles.

During feeding UI polish, keep the home block visually secondary to sleep: it should stay smaller than the current sleep status block, use tighter typography and spacing than sleep action areas, and never push the main sleep start/stop flow or coach card out of immediate reach. If the latest-feeding copy can be long, constrain it with `numberOfLines` / `adjustsFontSizeToFit` instead of making the block taller.

When showing bottle feedings inside the mixed sleep/feed day list, keep feeding rows visually secondary to sleep rows. Sleep rows are the main timeline: they may use stronger titles, larger row height, and clearer icon badges. Feeding rows should stay compact, use muted copy/icon treatment, avoid strong green highlighting, and never make the sleep timeline harder to scan. If adding event icons, prefer a small local presentational component built with React Native views over adding an icon dependency for one list.

When a bottle feeding happens during a sleep interval, display it as a compact nested row inside the sleep card instead of splitting the sleep or showing a duplicate standalone row. The top part of the card should still edit the sleep session; the nested feeding row should edit that feeding. Keep the nested row muted and short, for example `04:00 · 150 мл`, so it explains what happened without implying that the sleep ended or that wake-window calculations changed. Cover night-sleep, nap, outside-sleep, and cross-midnight nesting cases in `src/core/dayFeed.test.ts`.

For bottle-feeding quick entry, reuse one bottom sheet for create/edit instead of adding a separate form flow. In v1 keep the sheet limited to date, time, and volume in ml. For the create flow, put volume first because date and time already default to now; the fastest path should be open sheet, choose or type volume, save. Keep date and time controls below volume for correction only. Defaults should minimize effort: today, current time, and saved `bottleFeedingDefaultVolumeMl` from the child profile, defaulting to 180 ml. Do not use the latest feeding volume as the create default unless explicitly requested; the settings preset owns that default. Keep quick volume buttons compact, validate volume as 1-999 ml, reject future feeding times, and keep edit/delete copy specific to the selected record. After create, edit, or delete, reload the global latest feeding, today stats, last-24-hours stats, selected-period lists, and resync notifications.

For the bottle-feeding editor, keep the date display unambiguous with the year visible, for example `2 июня 2026 г.`. Time entry should use the same numeric `SelectAllTextInput` pattern as manual sleep editing: accept compact digits such as `1234`, normalize to `12:34`, keep partial input as text, parse on save, and reject invalid or future feeding times. Do not replace this with the Android clock picker unless the task explicitly asks for picker-only input.

For default bottle-feeding volume settings, persist `bottleFeedingDefaultVolumeMl` on the child profile with default `180`. Store presets in `src/constants/bottleFeeding.ts`, update fresh SQLite schema, idempotent profile-column migrations, repository update helpers, TypeScript types, backup/export, restore validation/defaults for old exports, and focused tests together. Changing the default volume must not edit existing feeding rows, must not resync notifications unnecessarily, and must affect new quick-add sheets from both the home screen and the dedicated "Кормление" screen.

For bottle-feeding "доешка" labeling, keep it as a calculated display state from `volumeMl <= bottleFeedingTopUpThresholdMl`, not as a persisted feeding type. Store the inclusive threshold on the child profile with default `30` ml, keep presets in `src/constants/bottleFeeding.ts`, and update schema, idempotent migrations, repository helpers, TypeScript types, backup/restore, and focused tests together. Changing the threshold must reclassify existing rows on display without rewriting `bottle_feedings`.

Keep "доешка" calculation, count forms, and copy in `src/core/bottleFeeding.ts`, for example `isBottleFeedingTopUp`, `calculateBottleFeedingTopUpStats`, and `formatTodayBottleFeedingStatsWithTopUpsLine`. UI screens should pass the profile threshold into shared helpers and render the returned labels; do not duplicate inclusive-boundary or Russian-count math inside React components.

On the home feeding card, if top-ups exist, show the ordinary feeding count excluding top-ups plus the top-up count, for example `2 кормления и 1 доешка`. Total ml still includes all today's bottle feedings. Load real current-calendar-day feedings separately from selected-day or nearby timeline rows so the card remains a "Сегодня" summary even when the main screen is viewing another date.

Show the `Доешка` badge consistently in the dedicated `/bottle-feeding` timeline, standalone mixed sleep/feed rows on `/`, and nested feeding rows inside sleep cards. The badge is display-only and must not affect sleep timelines, wake-window calculations, recommendations, active sleep state, reminders, or persisted bottle-feeding rows.

Use the shared `BottleFeedingIcon` component for bottle-feeding visual markers across the home feeding card, the main mixed `Всё по порядку` timeline, and the dedicated `/bottle-feeding` timeline. For timeline rows, use the `timeline` variant so the bottle icon matches the size and framed badge treatment of sleep icons. Do not revive `EventTypeBadge kind="bottleFeeding"` or duplicate bottle-icon View styles inside screens unless the shared component is explicitly being replaced.

When the home feeding card caption can include `... и 1 доешка`, keep the `+ Добавить` action from stealing caption width: position it on the top/right or otherwise reserve space only for the latest-feeding line, and allow the caption to wrap to two lines on narrow screens. Verify the layout with web/native UI where possible.

When showing bottle feedings in day feeds, treat them as display-only events. It is fine to mix `BottleFeeding` rows with sleep rows in chronological order, but do not pass feedings into sleep timelines, day summaries, recommendations, active sleep state, or start/stop logic. A feeding inside a sleep interval must not split the sleep session, change sleep duration, end active sleep, start a new sleep, or affect sleep recommendations.

The dedicated feeding screen is named "Кормление" and should stay a simple operational screen, not a general analytics page. Gate the route and all entry points behind `bottleFeedingEnabled`. Show latest feeding, compact selected-day and rolling "24 часа" stats, a selected-calendar-day switch using the same calm pattern as the main screen, then the editable feeding list for that selected local calendar day. The rows should be sorted newest-first. Reuse the shared bottom sheet for add/edit/delete, and default a new past-day feeding to local noon of the selected day instead of "now".

For the `/bottle-feeding` charts, keep the default range at 7 days and use one shared range selector with quick buttons `7`, `14`, and `30 дней`. When showing both volume and feeding count, use two separate synchronized charts instead of a combined dual-axis chart: one chart for daily `Объём` in ml and one chart for daily `Количество` of feedings. This is easier to scan than mixing bars and a second-axis line in one plot. Keep chart data derivation in `src/core/bottleFeeding.ts` as pure local-calendar-day helpers, include empty days in the returned points, and cover date-range behavior in `src/core/bottleFeeding.test.ts`. Avoid chart dependencies unless a later task explicitly requires them; compact React Native `View` bars are enough for this screen.

When `/bottle-feeding` charts show average daily volume or average daily feeding count, calculate those averages in pure `src/core/bottleFeeding.ts` helpers from trend points that have records only. Empty days should still remain in the chart points as zero bars so the selected 7/14/30-day axis stays readable, but they must not lower the average. Keep average labels short, for example `Ср. 180 мл` and `Ср. 1,5 кормления`, and cover both mixed periods and all-empty periods in `src/core/bottleFeeding.test.ts`.

Do not add feeding filters, age norms, recommendations, milk type, duration, notes, export, or sleep-impact interpretations unless explicitly requested. Feeding facts must remain informational and must not affect sleep timelines, wake-window calculations, recommendations, active sleep state, plans, or notification decisions.

Keep bottle-feeding settings off the operational "Кормление" screen. The parent-facing route `/bottle-feeding` should show quick status, `+ Добавить кормление`, compact selected-day and "24 часа" stats, a single navigation row "Настройки кормления" with a short hint such as "Объём по умолчанию, доешка и напоминания", the selected-day timeline, and the synchronized trend charts. Put default volume, top-up threshold, and feeding reminder controls on `/bottle-feeding-settings`, registered in Expo Router stack as "Настройки кормления". Gate the settings route behind `bottleFeedingEnabled` just like `/bottle-feeding`; direct navigation while disabled must not flash settings. After returning from settings, `/bottle-feeding` must reload the child profile so quick-add uses the updated default volume and top-up badges use the updated threshold. A setting change must not rewrite existing `bottle_feedings` rows.

For disabled bottle feeding, gate more than visible entry points. A direct visit to `/bottle-feeding` must not render the feeding screen content while profile loading or redirect is in progress; keep route content empty or minimal until `bottleFeedingEnabled` is confirmed, reset stale feeding screen state to empty, then redirect home. This prevents hidden optional data from flashing after the feature is disabled.

For bottle-feeding reminders, persist settings on the child profile: `bottleFeedingRemindersEnabled` default `false`, `bottleFeedingReminderIntervalMinutes` default `180`, and `bottleFeedingNotifyDuringSleep` default `true`. Store these in SQLite with fresh-schema columns, idempotent migrations, TypeScript types, repository update helpers, and backup/restore defaults for old exports. Keep constants such as default interval, max volume, and interval presets in `src/constants/bottleFeeding.ts`.

Keep feeding reminder decisions in `src/core` as pure TypeScript and scheduling in `src/notifications`. Derive notification state from global local data such as `getChildProfile`, `getLatestBottleFeeding`, and `getActiveSleepSession`, never from screen lists or selected-day display arrays. Use one stable scheduled-notification identifier, lazy-load `expo-notifications` through the shared guard, treat permission/scheduling failures as non-blocking, and never request push tokens, FCM, backend services, accounts, or cloud sync.

For feeding reminder UI, keep the disabled state compact: show a calm status such as "Напоминания выключены" and the main switch only. Hide interval presets, custom interval input, and "Уведомлять во время сна" controls until reminders are enabled. Keep reminder status copy in `src/core/bottleFeeding.ts` with focused tests instead of composing it inside React screens.

For custom feeding reminder intervals, use the same numeric duration-entry pattern as other time inputs, not raw minutes or a picker-only flow. Display and save the interval as `hours:minutes`, accept compact digits such as `001 -> 0:01`, `030 -> 0:30`, `100 -> 1:00`, and `1230 -> 12:30`, then persist the result as minutes. Keep the custom field inside the existing keyboard-safe scroll layout, and after an explicit save show a short, non-blocking confirmation such as "Сохранено".

When feeding reminders are disabled, when bottle feeding is disabled, or when imported/restored data disables them, cancel the scheduled feeding reminder and clear any suppressed reminder state. If `bottleFeedingNotifyDuringSleep` is false and the baby is sleeping, do not leave a system notification scheduled for delivery during sleep, even if the due time is still in the future. Cancel/suppress it immediately, store planner state such as `suppressedDueToSleep` and `suppressedReminderAt`, and resync after sleep ends. If the baby wakes before the suppressed due time, clear suppression and schedule the future reminder again. If the baby wakes after the suppressed due time, show the suppressed reminder immediately only if there was no newer feeding after `suppressedReminderAt`; otherwise clear suppression and schedule from the new latest feeding. Resync feeding reminders after feeding create/edit/delete, reminder setting changes, bottle-feeding feature toggles, sleep start/stop, and data restore/import.

Distinguish ordinary reminder sync from an explicit user save of reminder settings. Ordinary app-start, restore, sleep, and data-mutation sync must not resurrect stale overdue feeding reminders. A settings-screen save may opt into immediate overdue delivery, for example when a parent changes a custom interval to a value that has already elapsed since the latest feeding.

Before considering bottle-feeding UI or reminders done, verify:
- quick add for today and a past selected day;
- edit date, time, and volume;
- the feeding editor shows a full date with year and accepts numeric time input such as `1234 -> 12:34`;
- default volume is 180 ml on fresh/old data, selecting a preset persists it, and new quick-add sheets use the saved default instead of the latest feeding volume;
- delete with confirmation;
- feeding rows appear in the same newest-first mixed timeline as sleep on the main screen but do not alter sleep durations or recommendations;
- the "Кормление" screen switches selected local calendar days with previous/next and quick "Сегодня"/"Вчера" controls, while selected-day and "24 часа" stats remain separate summary cards;
- the "Кормление" screen shows two synchronized 7/14/30-day charts, `Объём` and `Количество`, with readable independent scales and no combined dual-axis chart;
- the home card remains below the current sleep status and above sleep action buttons, and is visibly smaller than the sleep status block;
- the quick-add sheet opens with volume first and has no milk type, duration, notes, recommendations, norms, or charts;
- the "Кормление" screen has no inline default-volume, top-up, or reminder controls; it has one settings navigation row with a short hint and opens `/bottle-feeding-settings`;
- changing the default volume on `/bottle-feeding-settings`, returning to `/bottle-feeding`, and opening quick add uses the new default volume;
- direct navigation to `/bottle-feeding-settings` while bottle feeding is disabled redirects home without flashing settings content;
- reminder defaults are off, interval is 3 hours, notify-during-sleep is on;
- disabling reminders cancels scheduled notification state;
- disabling bottle feeding hides UI and prevents reminder scheduling without deleting rows;
- direct navigation to `/bottle-feeding` while bottle feeding is disabled redirects home without flashing feeding content;
- disabled reminders show only the status and main switch; interval and during-sleep controls appear only after enabling reminders;
- custom reminder intervals use a `ч:мм` duration input, compact digit normalization works, the keyboard does not cover the field, saving shows a brief confirmation, and the saved value resyncs notifications;
- ordinary reminder sync ignores stale overdue reminders, while explicit reminder-setting saves can show a newly overdue reminder immediately;
- turning off "Уведомлять во время сна" cancels/suppresses reminders during active sleep, reschedules them if wake happens before the due time, then either shows the suppressed reminder after wake or discards it when a newer feeding happened;
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

Keep transfer code in `src/db` and keep the UI thin. Export should ensure storage is readable and the default child profile exists, then read SQLite tables in stable order. Do not create a persistent `target_day_plan` just because export/import ran: the first-run preset flow allows `targetDayPlans: []` until the parent explicitly chooses a base plan. Import should parse and validate unknown file content before writing anything: reject invalid JSON, unsupported format versions, missing default child profile, duplicate ids, unknown child references, invalid sleep kinds, invalid dates, and sleep sessions where `ended_at <= started_at`.

Treat an empty `targetDayPlans` array as valid for first-run backups. Fallback helpers can still return `DEFAULT_SLEEP_PLAN` for calculations, but backup parsing and restore must not require a permanent plan row and must not insert one implicitly. Add or update tests whenever backup parsing, restore summary, or first-run plan persistence changes.

Treat restore as a destructive replace of local app data unless the task explicitly asks for merge behavior. Always show a confirmation before opening the picker, run the delete/insert sequence inside a SQLite transaction, delete child-dependent tables before `child_profile`, and normalize active target plans after import so each child has exactly one active plan.

Use Expo SDK-versioned APIs for files. For SDK 56, use `expo-file-system` `File`/`Paths` for reading and writing, `expo-document-picker` with `copyToCacheDirectory: true` so the picked file is readable immediately, and `expo-sharing` for handing the export file to Android's share/save sheet. Install these with `cmd /c npx expo install ...` so package versions match the current Expo SDK, and check the versioned docs before coding.

When changing backup or restore logic, add focused tests for backup parsing/validation. Before considering the feature ready, verify:
- TypeScript checks pass;
- tests pass;
- parsing accepts a first-run backup with `targetDayPlans: []`;
- restoring rejects a malformed or unrelated JSON file;
- restoring a valid file updates profile, plans, and sleep rows;
- returning to the main screen uses restored profile, active plan, and sleep sessions;
- `android.package` and `DATABASE_NAME` are unchanged.

## Implementation lessons from full application reset

Full application reset is a deliberately destructive profile/settings feature, not an ordinary settings reset. Keep the entry point only on `/profile` in the bottom "Опасная зона" block, with the button text "Сбросить приложение". Do not expose this action on the main sleep screen, `/sleep-plan`, onboarding, data transfer, or debug-style surfaces unless a later task explicitly asks for that.

The reset UI must require two confirmations:
- first: explain that sleep records, План дня, child profile, feedings, temporary modes, and local settings will be deleted and that the action cannot be undone;
- second: offer "Сделать резервную копию", "Удалить всё", and "Отмена";
- backup must run the existing export flow and then return to the reset confirmation, but must never automatically continue into deletion.

Keep the destructive database operation in one data-layer method such as `resetApplicationData(db)`. It should run inside a SQLite transaction, delete child-dependent tables before `child_profile`, clear `app_settings`, leave the database/schema valid, and not delete the database file. Do not call helpers such as `getChildProfile`, `getTargetDayPlan`, `getSleepDayPlan`, or export/restore bootstrap paths inside reset if they can create default profile or plan rows.

After a successful reset, cancel all local scheduled/displayed notifications, clear notification runtime state such as active sleep and bottle-feeding reminder suppression, clear screen state, close modals, and navigate with `router.replace('/first-run')`. System notification permission is OS-owned and must not be treated as resettable app data.

If reset fails, do not navigate away, do not clear UI state as if reset succeeded, and show a calm error such as "Не удалось сбросить данные. Попробуйте ещё раз." Log the error for development diagnostics.

Before considering reset behavior done, verify:
- `child_profile`, `sleep_sessions`, active sleep, `target_day_plan`, `sleep_day_plan_snapshot`, `sleep_day_temporary_mode`, `bottle_feedings`, and `app_settings` are cleared;
- onboarding derives `not_started`;
- `DEFAULT_SLEEP_PLAN` is not persisted into `target_day_plan` after reset or after fallback plan reads;
- reset is idempotent;
- fresh-schema reset stays valid;
- scheduled sleep and feeding notifications are cancelled;
- `/profile` routes to `/first-run` after success and does not leave old sessions/timers visible.

## Implementation lessons from sleep-day temporary modes

Temporary sleep-day modes are a day-level sleep context, not a target plan setting. Keep `soft_day` and `early_wake` in the separate `sleep_day_temporary_mode` table and domain type. Enabling, disabling, or dismissing a temporary mode must not mutate `target_day_plan`, active-plan state, sleep sessions, sleep-day plan snapshots, bottle feeding rows, or notifications unless a later task explicitly asks for that behavior.

When changing temporary mode persistence, update the whole local-data chain together:
- fresh SQLite schema in `src/db/schema.ts`;
- idempotent migration guard in `src/db/database.ts`, before any early return based on `PRAGMA user_version`;
- `DATABASE_VERSION`;
- `src/types/sleep.ts`;
- repository methods in `src/db/sleepDayTemporaryModeRepository.ts`;
- backup/export-import in `src/db/dataTransfer.ts`;
- `APP_DATA_BACKUP_FORMAT_VERSION` and support for older backups without `sleepDayTemporaryModes`;
- focused tests for schema, migration, repository, and data transfer.

Use a unique key on `child_id + sleep_day_date_key + mode`. Re-enabling the same mode for the same child and sleep-day should reuse the existing row, clear `disabled_at` and `dismissed_at`, and avoid duplicate rows. Keep `dismissed_at` explicit so dismissing an `early_wake` suggestion can be remembered without pretending the mode is active.

Current UI consumers should keep temporary modes narrow:
- `/sleep-plan` owns compact controls for today's sleep-day and writes only `sleep_day_temporary_mode`;
- `/` applies active modes only for today through an `effective_plan` and may show one compact badge or early-wake suggestion;
- `/sleep-retrospective` reads modes for completed sleep-days, derives calculations from the saved snapshot plus modes, and shows only small badges and one calm hint;
- `SleepDayTimeline`, start/stop sleep, active sleep notification state, and bottle feeding logic should not become temporary-mode management surfaces.

Temporary-mode UI should stay compact and calm near the relevant screen-day decision. It should reduce parent decision load, offer a safe default action, and keep `target_day_plan` unchanged unless the parent explicitly edits the permanent plan.

## Implementation lessons from sleep retrospective summary statistics

The `/sleep-retrospective` screen is a calm history view, not an analytics dashboard. Keep the first-level screen focused on period selector, compact period summary, and the daily list. Put richer statistics behind the secondary `Сводная информация` action for the selected period.

Keep retrospective statistics in pure core code such as `src/core/sleepRetrospective.ts`. UI should render already prepared labels, metric cards, and trend points; it should not duplicate average, sorting, status, or empty-state math inside React components.

Useful summary metrics for this app are limited to sleep-planning context:
- average total sleep per 24-hour sleep-day;
- average daytime sleep and average naps per day;
- average night sleep;
- approximate average wake window;
- simple trends for total sleep split into night/day and awake-time drift against the plan.

Avoid turning history into complex analytics. Do not add medical claims, official-norm comparisons, feeding/diaper/growth metrics, cloud-backed reports, or heavy chart dependencies unless a later task explicitly asks for them. Prefer simple React Native `View`-based visualizations for compact trends when they are enough.

For `/sleep-retrospective` summary UI, use a bottom sheet or comparable secondary surface with bottom safe-area handling through `BottomSheetSafeArea`/`SafeAreaView edges={['bottom']}`. The sheet must remain scrollable and usable in a narrow Android/Web viewport, and the close action plus the lowest visible content must not be hidden by the navigation area.

When changing retrospective statistics, cover at least:
- empty selected period;
- average total/day/night sleep and naps per day;
- approximate wake-window calculation;
- chronological trend ordering even when screen days are loaded newest first;
- readable empty trend rows;
- narrow-viewport smoke-test for the summary sheet.

When adding or changing temporary mode behavior, update Confluence along with code. At minimum update the page "Временные режимы sleep-day" plus any affected screen pages such as "Экран: Сон сегодня", "Экран: План дня", "Экран: Ретроспектива сна", "Экран: Профиль", and the technical/project map pages. After Confluence writes, read the pages back in markdown and verify Russian headings and key bullets are readable.

When a feature moves from "not implemented yet" to implemented, search affected Confluence pages for stale negative statements such as "пока не отображается", "отдельного UI пока нет", or "если будет добавлено позже". Replace them in the same documentation pass so future implementation work does not follow outdated boundaries.

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

## Implementation lessons from age-based sleep plan preset templates

Age-based plan templates for 0-12 months are a starter layer on top of Level B practical presets and the existing `src/core/sleepPlan.ts` schedule builders. Keep template catalogs in pure `src/core` code, such as `src/core/ageSleepPlanPresetTemplates.ts`, and build `SleepPlanPreset` values through `buildSleepPlanPreset`, `deriveEveningSleepRulesForPlan`, and `buildWakeWindowsForPlan`. Do not duplicate bedtime, wake-window, or evening-rule math in React screens.

Treat age templates as `preset_template` recommendations, not as 20+ persisted user plans. Showing a template on `/sleep-plan` must not automatically create a plan, activate a plan, rewrite `target_day_plan`, rewrite snapshots, change SQLite schema, or enable a temporary sleep-day mode. A recommended template can be highlighted as "Рекомендуем", but it is applied only after an explicit user action.

When an age band has two neighboring nap-count modes, recommend the softer option with more daytime naps and show the lower-nap option as the alternative. This is a conservative default for tired parents because more naps usually means shorter wake intervals. Keep the copy non-medical: these are practical plan starters, not official medical norms.

If the child profile has a valid birth date, derive the age from the profile and ignore manual age-band selection. Manual age-band selection is only a fallback when the birth date is missing; it does not need to be persisted to the profile unless a separate task asks for persistence.

Keep Level B and Level C boundaries explicit in age-template UI and documentation. Level B can guide nap count and daytime sleep range; Level C wake windows remain practical guidance and must be produced by the plan builder, not by hard-coded UI math. Do not call daytime naps or wake windows official medical norms.

Before considering age-based preset templates done, verify:
- every age from 0 through 12 months returns a `recommendedPreset`;
- transition bands recommend the higher nap count and expose a non-duplicated alternative;
- `whyRecommendedText` is non-empty and the recommended preset is not marked as automatically selected;
- returned plans are compatible with `buildSleepPlanPreset` and `buildWakeWindowsForPlan`;
- `/sleep-plan` works both with a profile birth date and with missing birth date plus manual age-band selection;
- Confluence pages for A/B/C, `Экран: План дня`, `Экран: Справка`, technical information, and the app screen map are updated when this layer changes;
- TypeScript checks pass and core tests pass.

Before considering practical daytime sleep guidance done, verify:
- `/sleep-plan` shows Level A and Level B as separate details inside the compact `Проверка и расчёт` block;
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
- `/sleep-plan` shows Level C as the `Окна бодрствования` detail inside the expanded compact `Проверка и расчёт` block;
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

When documenting Level A/B/C/D changes in Confluence, update both the conceptual and screen-level pages. The current conceptual page is `Уровни доверия сна: A, B и C`. The screen pages that usually need updates are `Экран: План дня` for the compact checks/actions, `Экран: Справка` for help articles and deep links, `Экран: Сон сегодня` when a guideline or awake-time status affects the main screen, plus `Экраны приложения` and `Техническая информация` when routes or core modules change. This prevents Confluence from describing only the core principle while missing visible UI behavior and implementation boundaries.

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

For full-screen `ScrollView` forms with inputs near the bottom, `KeyboardAvoidingView` can resize the screen without automatically scrolling the focused field into view on Android. Prefer a small local fix first: add a `ScrollView` ref and a delayed `scrollTo`/`scrollToEnd` from the input `onFocus` or `keyboardDidShow`. Do not add large fallback bottom insets that make the whole screen jump to the top.

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

The main app sections use a custom bottom navigation in `src/components/MainBottomNavigation.tsx`, mounted from `src/app/_layout.tsx` around the existing `Stack`. Keep this as a minimal shared app shell unless a later task explicitly asks for a real Expo Router tabs group. The bottom navigation should be visible only on:
- `/`;
- `/sleep-plan`;
- `/sleep-retrospective`;
- `/profile`.

Do not add `/bottle-feeding`, `/bottle-feeding-settings`, `/info`, or `/first-run` to the bottom navigation. Keep bottle feeding reachable from the main/profile flows when enabled, and keep help reachable from profile and contextual info links.

Do not re-add duplicate header navigation icons for `План`, `История`, or `Профиль` on the main `/` screen. The main header should stay calm with `Сон`; the selected day/date belongs in the on-screen date navigator.

Keep the bottom navigation as normal layout below the stack, not an absolute overlay. It must use bottom safe area and must not cover screen CTAs. Bottom sheets and modal dialogs should stay in their own modal layer with `BottomSheetSafeArea` / `SafeAreaView edges={['bottom']}` so their actions remain tappable above the Android navigation area and above the app bottom navigation.

When verifying bottom navigation on Expo Web, check item geometry in a narrow viewport. `Link asChild` can collapse React Native Web pressable items to content width; if tab hit targets are not evenly distributed, prefer `Pressable` with `router.replace(...)` and verify each tab remains a large one-handed target.

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

If the in-app browser gets stuck on `about:blank`, stops attaching after a failed local navigation, or keeps showing stale local UI while HTTP probes and Metro logs show the server is alive, reset the browser-control session and close the stale tab once. Do not keep starting more Metro servers or repeatedly opening new same-origin tabs. If the webview still cannot attach, verify what you can with `cmd /c npm run typecheck`, tests, HTTP probes, Metro logs, or bundle markers, then report the browser limitation clearly.

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

## Implementation lessons from Android EAS build work

Before changing build configuration or starting a new Android build, read the Expo SDK 56 docs at `https://docs.expo.dev/versions/v56.0.0/` and the EAS build docs for the specific command/profile being used.

For the normal internal Android APK build, use the `preview` profile. It is configured for `distribution: "internal"` and `android.buildType: "apk"`. Do not add production/AAB/iOS profiles unless the user explicitly asks for release work.

Use the pinned package scripts instead of ad hoc CLI commands:
- `cmd /c npm run verify` before builds;
- `cmd /c npm run eas:build:android:preview -- --message "1.0.1: short release note"` for a blocking preview APK build;
- `cmd /c npm run eas:build:android:preview:no-wait -- --message "1.0.1: short release note"` when the user only needs the build queued;
- `cmd /c npm run eas:build:view -- <build-id> --json` to monitor an existing build.

`npm run verify` intentionally runs TypeScript, unit tests, and `expo-doctor`. If `expo-doctor` reports SDK patch mismatches, fix them with Expo's installer path such as `cmd /c npx expo install --check` and `cmd /c npx expo install --fix`, then rerun verification. Do not use `npm audit fix --force` as part of routine build preparation because it can introduce broad dependency churn.

Do not run `expo lint` for build preflight unless the project already has an ESLint config and dependencies installed. This project currently relies on TypeScript, tests, and `expo-doctor` for build preflight.

If an EAS build stays in `IN_QUEUE`, do not start another build just to retry. A second build can consume another `versionCode` because `autoIncrement` is enabled. Keep the original build id and monitor it with `npm run eas:build:view -- <build-id> --json`.

Before starting a build, run `git status --short --branch` and report any dirty files. EAS can upload uncommitted local changes; do not assume the finished APK exactly matches the latest Git commit if the working tree was dirty or changed while the build was running.

If the build is intentionally started from a dirty tree, for example after bumping `expo.version` for a user-facing release, treat those local files as build input. In the release record, add a short note when EAS `gitCommitHash` points to the last commit but the uploaded archive also contained local uncommitted changes. Do not describe the APK as exactly matching that commit unless the tree was clean at upload time.

Keep local workspace artifacts out of the EAS archive. `.easignore` and `.gitignore` should continue to exclude `.codex-remote-attachments/`, local logs, generated native folders, local credentials, and editor/cache folders.

For important APKs, keep release information human-readable:
- update `CHANGELOG.md` before the build;
- bump `expo.version` only for meaningful user-facing releases, not for every technical rebuild;
- rely on EAS remote `autoIncrement` for Android `versionCode` on every build;
- use a concise EAS `--message` so the build dashboard explains what changed;
- after a successful build, create a release record from `docs/releases/_template.md` with the EAS build URL, APK URL, commit, version, `versionCode`, checks, and Android smoke-check results.

The app should expose the installed version in a low-noise place such as the "Справка" screen. Use `expo-application` for native APK version/build values and keep the copy short, for example `Версия 1.0.1 (11)`.

When the user asks to "собери новый билд", "собери APK", or otherwise requests a new Android build, follow this full release-build workflow unless they explicitly ask for a narrower action:

1. Read `AGENTS.md`, `CHANGELOG.md`, `RELEASE_CHECKLIST.md`, `eas.json`, `package.json`, and run `git status --short --branch`.
2. Identify dirty files before the build. Treat them as intended input unless they are clearly unrelated generated logs ignored by `.gitignore`/`.easignore`. Never revert, stash, or discard them.
3. Decide whether this is a user-facing release or a technical rebuild:
   - for a user-facing release, bump `expo.version` in `app.json` by the smallest sensible semver step and keep `package.json` version unchanged unless the user explicitly asks to publish the package;
   - for a technical rebuild, do not bump `expo.version`; EAS remote `autoIncrement` will still create a new Android `versionCode`.
4. Make sure `CHANGELOG.md` has a useful `## Следующий релиз` section. If it is empty or stale and the current diff clearly explains the release, fill "Что изменилось", "Что проверить", and "Известные ограничения" concisely. Do not invent product claims or medical claims.
5. Build a concise EAS message from the app version and changelog summary, for example `1.0.1: release notes and version display`. Prefer ASCII in the command-line message on Windows unless the shell encoding has explicitly been set to UTF-8.
6. Run `cmd /c npm run verify`. If it fails, stop before EAS Build, report the failing check, and do not consume a `versionCode`.
7. Start exactly one build with `cmd /c npm run eas:build:android:preview -- --message "<message>"` unless the user asked for queue-only, in which case use `cmd /c npm run eas:build:android:preview:no-wait -- --message "<message>"`.
8. Capture the build id from EAS output. Monitor only that build with `cmd /c npm run eas:build:view -- <build-id> --json`. If it stays in `IN_QUEUE`, keep waiting or report the queue status; do not start a duplicate build.
9. After the build reaches a terminal status, use the JSON from `build:view` as the source of truth for release metadata: `id`, `status`, `artifacts.buildUrl` / `artifacts.applicationArchiveUrl`, `appVersion`, `appBuildVersion`, `gitCommitHash`, `createdAt`, and `completedAt`.
10. Create a release record from `docs/releases/_template.md` at `docs/releases/YYYY-MM-DD-v<appVersion>-build-<appBuildVersion>.md`. Fill every known field. Use the EAS build page URL `https://expo.dev/accounts/kichx/projects/baby-sleep-planner/builds/<build-id>` even if the direct APK URL exists, because direct artifact URLs can expire.
   - if the EAS archive included uncommitted local changes, add a `Примечание` that names the relevant files or reason, such as an `app.json` version bump.
11. Fill "Что нового" and "Что проверить" in the release record from `CHANGELOG.md` and the build message. Mark preflight checks as passed if `npm run verify` passed. Mark Android smoke-check items as `not checked` unless the APK was actually installed and tested on Android during this turn.
12. If the build failed or was canceled, still create a short release record with `Статус: failed` or `canceled`, no APK URL, the failed build URL, preflight status, and the known failure summary. Do not move `CHANGELOG.md` out of `Следующий релиз` for failed builds.
13. If the build finished and it represents a real release, move the current `## Следующий релиз` content in `CHANGELOG.md` into a dated section named `## <appVersion> (<appBuildVersion>) — <YYYY-MM-DD>`, then recreate an empty `## Следующий релиз` section at the top with placeholders. For a technical rebuild, leave `CHANGELOG.md` as-is unless the user asked to record it there.
14. Final response must include: EAS build URL, APK URL if available, `appVersion`, Android `versionCode`, release record path, checks run, smoke-check status, and whether any Git actions were performed.

After an Android APK build that affects native modules, notification behavior, permissions, app config, or build plugins, the build is not fully verified until it has been installed on Android and smoke-tested. At minimum, verify the main sleep start/stop flow, active sleep notification behavior, manual ongoing sleep sync, denied notification permission behavior, and app relaunch with existing local data.

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
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
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

Confluence diagrams and flowcharts:
- This Confluence site does not render Mermaid blocks created through Markdown/Rovo as visual diagrams; they appear as code macros. Do not use Mermaid for user-facing Confluence diagrams unless the user explicitly wants source code.
- If the user asks for an editable/native Confluence diagram, build it from ordinary Confluence content such as tables, headings, panels, and highlighted cells in storage XHTML. Keep conditions and outcomes in separate editable cells so the page can be changed later in the Confluence editor.
- If the user asks for a visual-only diagram, a generated PNG/SVG attachment can be used, but first state that it will not be easily editable in Confluence.
- After updating a page with a diagram-like section, verify the storage body has no unintended `<ac:structured-macro ac:name="code">` Mermaid macros and read the page back or inspect storage XHTML to confirm the Russian text and editable tables are present.

For large existing Confluence pages, use a storage-body patch workflow instead of manual partial updates:
- Treat the fetched body as Confluence storage XHTML, not rendered Markdown. Rendered headings and rows can be stored as `<h2>Отдельный экран <code>Кормление</code></h2>`, links can be `<ac:link>...`, and punctuation can be HTML entities such as `&mdash;`. Before writing, inspect the exact storage slice around every target marker instead of matching a copied Markdown line.
- Do not pass a small snippet to `_updateconfluencepage` for a page update. Page update tools and REST `PUT /wiki/api/v2/pages/<pageId>` replace the page body. Use them only with the full desired body.
- For multi-page documentation updates, write the script in two phases: fetch every target page and compute every replacement first; if any marker is missing, throw and perform no `PUT`. Only after all replacements are verified should the script update pages with `version.number + 1`.
- Make replacements idempotent enough for repeated runs. Prefer bounded section replacements between stable headings, or targeted row replacements after confirming the exact storage form. Avoid broad regexes that can cross unrelated sections.
- Log only page id/title/version and replacement status. Never log tokens, auth headers, full page bodies, or local secret paths.
- After `PUT`, verify the returned version number, then read the page back through `_getconfluencepage` with `contentFormat: "markdown"` and check the body text itself. Rovo summaries/snippets may lag or show stale text; do not treat the summary field as proof that the body update failed.

Quick paths for Confluence updates:
- Small page or new page: use Rovo `_search` first, then `_getconfluencepage` in `markdown`, then `_updateconfluencepage` / `_createconfluencepage` only with the full intended page body. Read back with `_getconfluencepage` in `markdown` and confirm Russian headings, tables, and key bullets are readable.
- Existing large page: use Rovo only to find page ids/titles. Then use a Node `fetch` storage-body patch against Confluence REST API v2: `GET /wiki/api/v2/pages/<pageId>?body-format=storage`, compute idempotent replacements by stable `<h2>` headings, and `PUT /wiki/api/v2/pages/<pageId>` with `version.number + 1`. This avoids Rovo output truncation and accidental partial-page replacement.
- Multi-page documentation pass: first fetch all target pages and verify every insertion/replacement anchor exists; only then write pages. If one anchor is missing, write nothing and adjust the script or search result. This keeps related screen, technical, and map pages consistent.
- Fast verification: after writes, read every changed page back through `_getconfluencepage` in `markdown`. Check the actual body text, not the search result summary. Rovo summaries and snippets can lag or omit newly inserted sections even when the page update succeeded.
- Windows Node scripts: if using top-level `await`, write the script as ESM with `import { execSync } from 'node:child_process'`. Do not mix `require(...)` with top-level `await`, because Node can fail with `ERR_AMBIGUOUS_MODULE_SYNTAX`. If CommonJS is preferred, wrap all `await` calls in an async IIFE instead.
- UTF-8 fast setup: before piping a Node script that contains Russian strings or storage HTML through PowerShell, set `[Console]::InputEncoding`, `[Console]::OutputEncoding`, and `$OutputEncoding` to UTF-8. If the fetched headings show mojibake or inserted Russian turns into `????`, stop before writing.

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

On Windows, when using `cmd /c` with `&&`, pipes, or redirection for UTF-8 verification, quote the whole command string so PowerShell does not parse shell operators first, for example `cmd /c "chcp 65001 >NUL && type CHANGELOG.md"`.

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
