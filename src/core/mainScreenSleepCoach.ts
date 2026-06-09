import {
  addMinutes,
  dateAtMinutes,
  minutesBetween,
} from '@/core/sleepCalculations';
import { calculatePlanBedtimeRange } from '@/core/sleepPlan';
import { formatLocalClock } from '@/core/localDateTime';
import { formatNextSleepAtText } from '@/core/mainScreenTimeText';
import type {
  RecommendationScenario,
  RecommendationScenarioId,
  SleepPlanPreset,
  SleepSnapshot,
} from '@/types/sleep';

export type SleepCoachTone = 'calm' | 'prepare' | 'actSoon' | 'adjustDay';

export type SleepCoachCardVm = {
  visible: boolean;
  tone: SleepCoachTone;
  eyebrow: string;
  badge?: string;
  title: string;
  body: string;
  anchor?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  scenarioId?: string;
  hasWhyDetails: boolean;
  hasAlternatives: boolean;
};

export type SleepCoachWhySectionVm = {
  title: string;
  lines: string[];
};

export type SleepCoachWhySheetVm = {
  visible: boolean;
  title: string;
  badge?: string;
  scenarioId?: RecommendationScenarioId;
  sections: SleepCoachWhySectionVm[];
  summary: string;
  isFallback: boolean;
};

export type SleepCoachAlternativeItemVm = {
  id: RecommendationScenarioId;
  title: string;
  body: string;
  anchor?: string;
  badge?: string;
  isRecommended: boolean;
};

export type SleepCoachAlternativesSheetVm = {
  visible: boolean;
  title: string;
  summary: string;
  items: SleepCoachAlternativeItemVm[];
  isFallback: boolean;
};

type SleepCoachSourceViewState = {
  canShowCoachBlocks: boolean;
  hasActiveTargetPlan: boolean;
  isTodaySelected: boolean;
  isTrackingOnlyWithoutPlan: boolean;
  showPlanBasedPredictions: boolean;
  showPlanStartNoDataHint: boolean;
};

export type BuildSleepCoachCardVmInput = {
  now: Date;
  plan: SleepPlanPreset | null;
  sleepDayStart: Date | null;
  snapshot: SleepSnapshot | null;
  temporaryModeBadge?: string | null;
  viewState: SleepCoachSourceViewState;
};

export type BuildSleepCoachWhySheetVmInput = BuildSleepCoachCardVmInput;
export type BuildSleepCoachAlternativesSheetVmInput = BuildSleepCoachCardVmInput;

const EYEBROW = 'Что лучше сейчас';
const WHY_TITLE = 'Почему так';
const ALTERNATIVES_TITLE = 'Другие варианты';
const RECOMMENDED_SCENARIO_BADGE = 'Рекомендуем сейчас';
const ALTERNATIVES_FALLBACK_SUMMARY =
  'Пока есть только одна подходящая рекомендация.';
const WHY_FALLBACK_SUMMARY =
  'Пока мало данных для точного объяснения. После следующей записи сна расчёт станет понятнее.';
const DAY_MINUTES = 24 * 60;
const PREPARE_THRESHOLD_MINUTES = 30;

const HIDDEN_SLEEP_COACH_CARD_VM: SleepCoachCardVm = {
  visible: false,
  tone: 'calm',
  eyebrow: EYEBROW,
  title: '',
  body: '',
  hasWhyDetails: false,
  hasAlternatives: false,
};

const HIDDEN_SLEEP_COACH_WHY_SHEET_VM: SleepCoachWhySheetVm = {
  visible: false,
  title: WHY_TITLE,
  sections: [],
  summary: '',
  isFallback: false,
};

const HIDDEN_SLEEP_COACH_ALTERNATIVES_SHEET_VM: SleepCoachAlternativesSheetVm = {
  visible: false,
  title: ALTERNATIVES_TITLE,
  summary: '',
  items: [],
  isFallback: false,
};

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

function hasSafeSnapshotDates(snapshot: SleepSnapshot): boolean {
  return (
    isValidDate(snapshot.statusStartedAt) &&
    isValidDate(snapshot.nextSleepAt) &&
    isValidDate(snapshot.predictedBedtimeAt) &&
    isValidFiniteNumber(snapshot.currentDurationMinutes) &&
    isValidFiniteNumber(snapshot.completedNaps) &&
    isValidFiniteNumber(snapshot.projectedRemainingDaySleepMinutes) &&
    isValidFiniteNumber(snapshot.remainingAwakeMinutes) &&
    isValidFiniteNumber(snapshot.totalAwakeMinutes) &&
    isValidFiniteNumber(snapshot.totalDaySleepMinutes)
  );
}

function getPrimaryScenario(snapshot: SleepSnapshot): RecommendationScenario | null {
  return (
    snapshot.scenarios.find((scenario) => scenario.priority === 'primary') ??
    snapshot.scenarios[0] ??
    null
  );
}

function getScenarioMetadata(snapshot: SleepSnapshot): {
  hasAlternatives: boolean;
  hasWhyDetails: boolean;
  scenarioId?: RecommendationScenarioId;
} | null {
  const scenario = getPrimaryScenario(snapshot);

  if (!scenario) {
    return null;
  }

  return {
    hasAlternatives: snapshot.scenarios.length > 1,
    hasWhyDetails: true,
    scenarioId: scenario.id,
  };
}

function withCommonFields(
  card: Omit<SleepCoachCardVm, 'eyebrow' | 'visible'>,
): SleepCoachCardVm {
  return {
    ...card,
    eyebrow: EYEBROW,
    visible: true,
  };
}

function getBadge(temporaryModeBadge: string | null | undefined): string | undefined {
  const badge = temporaryModeBadge?.trim();

  return badge ? badge : undefined;
}

function dateAtSleepDayMinutes(dayStart: Date, minutesFromMidnight: number): Date {
  const date = dateAtMinutes(dayStart, minutesFromMidnight);

  if (date.getTime() < dayStart.getTime()) {
    return addMinutes(date, DAY_MINUTES);
  }

  return date;
}

function getBedtimeRangeAnchor(plan: SleepPlanPreset, sleepDayStart: Date): string | undefined {
  const bedtimeRange = calculatePlanBedtimeRange(plan);
  const startAt = dateAtSleepDayMinutes(sleepDayStart, bedtimeRange.startMinutes);
  let endAt = dateAtSleepDayMinutes(sleepDayStart, bedtimeRange.endMinutes);

  if (endAt.getTime() < startAt.getTime()) {
    endAt = addMinutes(endAt, DAY_MINUTES);
  }

  if (!isValidDate(startAt) || !isValidDate(endAt)) {
    return undefined;
  }

  return `Ориентир отбоя: ${formatLocalClock(startAt)}–${formatLocalClock(endAt)}`;
}

function getNapWindowAnchor(input: {
  now: Date;
  snapshot: SleepSnapshot;
}): string | undefined {
  if (!isValidDate(input.snapshot.nextSleepAt)) {
    return `Ориентир сна: ${formatLocalClock(input.snapshot.nextSleepAt)}`;
  }

  return (
    formatNextSleepAtText({
      nextSleepAt: input.snapshot.nextSleepAt,
      now: input.now,
    }) ?? `Ориентир сна: ${formatLocalClock(input.snapshot.nextSleepAt)}`
  );
}

function getPredictedBedtimeAnchor(
  snapshot: SleepSnapshot,
  prefix: 'Отбой пока около' | 'Отбой пока можно сохранить около' | 'Отбой около',
): string | undefined {
  if (!isValidDate(snapshot.predictedBedtimeAt)) {
    return undefined;
  }

  return `${prefix} ${formatLocalClock(snapshot.predictedBedtimeAt)}`;
}

function getCurrentSleepAverageEndAt(input: {
  plan: SleepPlanPreset;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
}): Date | null {
  if (input.snapshot.nextSleepKind === 'night') {
    const averageWakeUpMinutes = Math.round(
      (input.plan.wakeUpStartMinutes + input.plan.wakeUpEndMinutes) / 2,
    );
    let endAt = dateAtSleepDayMinutes(input.sleepDayStart, averageWakeUpMinutes);

    while (endAt.getTime() <= input.snapshot.statusStartedAt.getTime()) {
      endAt = addMinutes(endAt, DAY_MINUTES);
    }

    return endAt;
  }

  const targetNapMinutes = getTargetNapMinutes(input.plan);

  if (targetNapMinutes <= 0) {
    return null;
  }

  return addMinutes(input.snapshot.statusStartedAt, targetNapMinutes);
}

function getCurrentSleepAverageEndAnchor(input: {
  now: Date;
  plan: SleepPlanPreset;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
}): string | undefined {
  const endAt = getCurrentSleepAverageEndAt({
    plan: input.plan,
    sleepDayStart: input.sleepDayStart,
    snapshot: input.snapshot,
  });

  if (!endAt || !isValidDate(endAt)) {
    return undefined;
  }

  const remainingDuration = formatDurationForWhy(minutesBetween(input.now, endAt));

  if (!remainingDuration) {
    return undefined;
  }

  return `Средний ориентир: до ${formatLocalClock(endAt)}, осталось ${remainingDuration}`;
}

function getTargetNapMinutes(plan: SleepPlanPreset): number {
  return Math.max(0, Math.round(plan.targetDaySleepMinutes / Math.max(1, plan.napCount)));
}

function canActiveSleepContinue(snapshot: SleepSnapshot, plan: SleepPlanPreset): boolean {
  if (snapshot.nextSleepKind === 'night') {
    return true;
  }

  const shortNapLimitMinutes = Math.max(
    1,
    Math.min(getTargetNapMinutes(plan), plan.maxEveningNapMinutes),
  );

  return (
    snapshot.projectedRemainingDaySleepMinutes > 0 ||
    snapshot.currentDurationMinutes < shortNapLimitMinutes
  );
}

function formatDurationForWhy(minutes: number): string | null {
  if (!isValidFiniteNumber(minutes)) {
    return null;
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const restMinutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatNapCountForWhy(count: number): string | null {
  if (!isValidFiniteNumber(count)) {
    return null;
  }

  const roundedCount = Math.max(0, Math.round(count));
  const mod10 = roundedCount % 10;
  const mod100 = roundedCount % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? 'дневной сон'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'дневных сна'
        : 'дневных снов';

  return `${roundedCount} ${suffix}`;
}

function normalizeWhyLine(line: string | null | undefined): string | null {
  const trimmedLine = line?.trim();

  if (!trimmedLine || /undefined|null|NaN/.test(trimmedLine)) {
    return null;
  }

  return trimmedLine;
}

function buildWhySection(
  title: string,
  rawLines: Array<string | null | undefined>,
): SleepCoachWhySectionVm | null {
  const lines = rawLines
    .map((line) => normalizeWhyLine(line))
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return null;
  }

  return { title, lines };
}

function compactWhySections(
  sections: Array<SleepCoachWhySectionVm | null>,
): SleepCoachWhySectionVm[] {
  return sections.filter((section): section is SleepCoachWhySectionVm => section !== null);
}

function buildFallbackWhySheetVm(badge: string | undefined): SleepCoachWhySheetVm {
  return {
    visible: true,
    title: WHY_TITLE,
    badge,
    sections: [],
    summary: WHY_FALLBACK_SUMMARY,
    isFallback: true,
  };
}

function buildFallbackAlternativesSheetVm(): SleepCoachAlternativesSheetVm {
  return {
    visible: true,
    title: ALTERNATIVES_TITLE,
    summary: ALTERNATIVES_FALLBACK_SUMMARY,
    items: [],
    isFallback: true,
  };
}

function canShowWhySheetShell(viewState: SleepCoachSourceViewState): boolean {
  return (
    viewState.canShowCoachBlocks &&
    viewState.hasActiveTargetPlan &&
    viewState.isTodaySelected &&
    !viewState.isTrackingOnlyWithoutPlan &&
    !viewState.showPlanStartNoDataHint &&
    viewState.showPlanBasedPredictions
  );
}

function getScenariosWithRecommendedFirst(
  scenarios: RecommendationScenario[],
  recommendedScenarioId: RecommendationScenarioId,
): RecommendationScenario[] {
  const recommendedIndex = scenarios.findIndex(
    (scenario) => scenario.id === recommendedScenarioId,
  );

  if (recommendedIndex < 0) {
    return scenarios;
  }

  return [
    scenarios[recommendedIndex],
    ...scenarios.filter((_, index) => index !== recommendedIndex),
  ];
}

function getScenarioAnchor(input: {
  now: Date;
  plan: SleepPlanPreset;
  scenario: RecommendationScenario;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
}): string | undefined {
  if (input.scenario.id === 'earlyBedtime') {
    return (
      getPredictedBedtimeAnchor(input.snapshot, 'Отбой около') ??
      getBedtimeRangeAnchor(input.plan, input.sleepDayStart)
    );
  }

  if (input.snapshot.state === 'sleeping') {
    return getPredictedBedtimeAnchor(input.snapshot, 'Отбой пока около');
  }

  if (input.snapshot.nextSleepKind === 'night') {
    return getPredictedBedtimeAnchor(input.snapshot, 'Отбой около');
  }

  return getNapWindowAnchor({
    now: input.now,
    snapshot: input.snapshot,
  });
}

function buildAlternativeItem(input: {
  now: Date;
  plan: SleepPlanPreset;
  scenario: RecommendationScenario;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
  recommendedScenarioId: RecommendationScenarioId;
}): SleepCoachAlternativeItemVm {
  const isRecommended = input.scenario.id === input.recommendedScenarioId;

  return {
    id: input.scenario.id,
    title: normalizeWhyLine(input.scenario.title) ?? 'Вариант',
    body: normalizeWhyLine(input.scenario.detail) ?? 'Можно оставить как запасной вариант.',
    anchor: getScenarioAnchor(input),
    badge: isRecommended ? RECOMMENDED_SCENARIO_BADGE : undefined,
    isRecommended,
  };
}

function getScenarioLine(scenario: RecommendationScenario): string | null {
  const title = normalizeWhyLine(scenario.title);

  return title ? `Рекомендация: ${title}.` : null;
}

function getScenarioDetailLine(scenario: RecommendationScenario): string | null {
  const detail = normalizeWhyLine(scenario.detail);

  return detail ? `Причина: ${detail}` : null;
}

function getPredictedBedtimeLine(snapshot: SleepSnapshot, prefix: string): string | null {
  if (!isValidDate(snapshot.predictedBedtimeAt)) {
    return null;
  }

  return `${prefix} ${formatLocalClock(snapshot.predictedBedtimeAt)}.`;
}

function getActiveSleepShiftLine(input: {
  plan: SleepPlanPreset;
  scenario: RecommendationScenario;
  snapshot: SleepSnapshot;
}): string | null {
  const sleepCanContinue = canActiveSleepContinue(input.snapshot, input.plan);
  const scenarioText = `${input.scenario.title} ${input.scenario.detail}`.toLowerCase();
  const scenarioMentionsEveningShift =
    scenarioText.includes('позже') ||
    scenarioText.includes('сдвин') ||
    scenarioText.includes('вечер');

  if (!sleepCanContinue || scenarioMentionsEveningShift) {
    return 'Если сон продлится ещё, отбой может сдвинуться.';
  }

  return null;
}

function getNextSleepProjectionLine(input: {
  now: Date;
  snapshot: SleepSnapshot;
}): string | null {
  if (!isValidDate(input.snapshot.nextSleepAt)) {
    return null;
  }

  if (input.snapshot.nextSleepKind === 'night') {
    return `Ориентир следующего сна: около ${formatLocalClock(input.snapshot.nextSleepAt)}.`;
  }

  const nextSleepText = formatNextSleepAtText({
    nextSleepAt: input.snapshot.nextSleepAt,
    now: input.now,
  });

  if (nextSleepText) {
    return `${nextSleepText}.`;
  }

  return `Ориентир следующего сна: около ${formatLocalClock(input.snapshot.nextSleepAt)}.`;
}

function buildTodayWhySection(input: {
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
}): SleepCoachWhySectionVm | null {
  const totalDaySleep = formatDurationForWhy(input.snapshot.totalDaySleepMinutes);
  const projectedDaySleep = formatDurationForWhy(
    input.snapshot.projectedRemainingDaySleepMinutes,
  );
  const completedNaps = isValidFiniteNumber(input.snapshot.completedNaps)
    ? Math.max(0, Math.round(input.snapshot.completedNaps))
    : null;
  const plannedNaps = isValidFiniteNumber(input.plan.napCount)
    ? Math.max(0, Math.round(input.plan.napCount))
    : null;

  return buildWhySection('Сегодня', [
    totalDaySleep ? `Дневной сон уже ${totalDaySleep}.` : null,
    completedNaps !== null && plannedNaps !== null
      ? `Дневных снов: ${completedNaps} из ${plannedNaps}.`
      : null,
    projectedDaySleep && input.snapshot.projectedRemainingDaySleepMinutes > 0
      ? `В прогнозе ещё дневного сна ${projectedDaySleep}.`
      : null,
  ]);
}

function buildPlanWhySection(input: {
  plan: SleepPlanPreset;
}): SleepCoachWhySectionVm | null {
  const plannedNaps = formatNapCountForWhy(input.plan.napCount);
  const targetDaySleep = formatDurationForWhy(input.plan.targetDaySleepMinutes);
  const targetAwake = formatDurationForWhy(input.plan.targetAwakeMinutes);

  return buildWhySection('План на сегодня', [
    plannedNaps ? `В эффективном плане ${plannedNaps}.` : null,
    targetDaySleep ? `Цель дневного сна: ${targetDaySleep}.` : null,
    targetAwake ? `Цель бодрствования: ${targetAwake}.` : null,
  ]);
}

function getActiveSleepWhySummary(input: {
  plan: SleepPlanPreset;
  scenarioId: RecommendationScenarioId;
  snapshot: SleepSnapshot;
}): string {
  if (!canActiveSleepContinue(input.snapshot, input.plan)) {
    return 'Поэтому сейчас лучше мягко завершить сон в ближайшее время, чтобы вечер остался спокойным.';
  }

  if (input.scenarioId === 'capLastNap') {
    return 'Поэтому сейчас лучше дать поспать ещё, но не затягивать вечерний сон слишком сильно.';
  }

  return 'Поэтому сейчас лучше дать поспать ещё, а после пробуждения пересчитать следующий шаг.';
}

function getAwakeWhySummary(input: {
  minutesUntilNextSleep: number;
  scenarioId: RecommendationScenarioId;
  snapshot: SleepSnapshot;
}): string {
  if (input.snapshot.nextSleepKind === 'night' || input.scenarioId === 'earlyBedtime') {
    return 'Поэтому сейчас лучше спокойно двигаться к отбою без ещё одного дневного сна.';
  }

  if (input.scenarioId === 'microNap') {
    return 'Поэтому лучше держать следующий сон коротким и оставить вечер спокойным.';
  }

  if (input.scenarioId === 'capLastNap') {
    return 'Поэтому следующий сон лучше не затягивать, чтобы отбой остался ближе к плану.';
  }

  if (input.scenarioId === 'stretchWakeWindow') {
    return 'Поэтому можно бодрствовать ещё немного и начать подготовку ближе к окну.';
  }

  if (input.minutesUntilNextSleep <= 0 || input.snapshot.remainingAwakeMinutes <= 0) {
    return 'Поэтому сейчас лучше начать сон спокойно, без спешки.';
  }

  if (input.minutesUntilNextSleep <= PREPARE_THRESHOLD_MINUTES) {
    return 'Поэтому лучше начать подготовку ко сну сейчас, спокойно и без спешки.';
  }

  return 'Поэтому пока можно бодрствовать, а ближе к окну перейти к спокойной подготовке.';
}

function buildActiveSleepWhySheetVm(input: {
  badge?: string;
  plan: SleepPlanPreset;
  scenario: RecommendationScenario;
  snapshot: SleepSnapshot;
}): SleepCoachWhySheetVm {
  const currentDuration = formatDurationForWhy(input.snapshot.currentDurationMinutes);
  const sections = compactWhySections([
    buildWhySection('Сейчас', [currentDuration ? `Сон длится ${currentDuration}.` : null]),
    buildTodayWhySection({ plan: input.plan, snapshot: input.snapshot }),
    buildWhySection('Прогноз', [
      getPredictedBedtimeLine(input.snapshot, 'Если сон закончится сейчас, отбой около'),
      getActiveSleepShiftLine({
        plan: input.plan,
        scenario: input.scenario,
        snapshot: input.snapshot,
      }),
    ]),
    buildPlanWhySection({ plan: input.plan }),
    buildWhySection('Расчёт', [
      getScenarioLine(input.scenario),
      getScenarioDetailLine(input.scenario),
    ]),
  ]);
  const summary = normalizeWhyLine(
    getActiveSleepWhySummary({
      plan: input.plan,
      scenarioId: input.scenario.id,
      snapshot: input.snapshot,
    }),
  );

  if (sections.length === 0 || !summary) {
    return buildFallbackWhySheetVm(input.badge);
  }

  return {
    visible: true,
    title: WHY_TITLE,
    badge: input.badge,
    scenarioId: input.scenario.id,
    sections,
    summary,
    isFallback: false,
  };
}

function buildAwakeWhySheetVm(input: {
  badge?: string;
  now: Date;
  plan: SleepPlanPreset;
  scenario: RecommendationScenario;
  snapshot: SleepSnapshot;
}): SleepCoachWhySheetVm {
  const currentDuration = formatDurationForWhy(input.snapshot.currentDurationMinutes);
  const remainingAwake = formatDurationForWhy(input.snapshot.remainingAwakeMinutes);
  const minutesUntilNextSleep = minutesBetween(input.now, input.snapshot.nextSleepAt);
  const sections = compactWhySections([
    buildWhySection('Сейчас', [
      currentDuration ? `Бодрствует ${currentDuration}.` : null,
      remainingAwake ? `До цели бодрствования осталось ${remainingAwake}.` : null,
    ]),
    buildWhySection('Ориентир', [
      getNextSleepProjectionLine({
        now: input.now,
        snapshot: input.snapshot,
      }),
    ]),
    buildTodayWhySection({ plan: input.plan, snapshot: input.snapshot }),
    buildWhySection('Прогноз', [
      getPredictedBedtimeLine(input.snapshot, 'Отбой пока около'),
    ]),
    buildPlanWhySection({ plan: input.plan }),
    buildWhySection('Расчёт', [
      getScenarioLine(input.scenario),
      getScenarioDetailLine(input.scenario),
    ]),
  ]);
  const summary = normalizeWhyLine(
    getAwakeWhySummary({
      minutesUntilNextSleep,
      scenarioId: input.scenario.id,
      snapshot: input.snapshot,
    }),
  );

  if (sections.length === 0 || !summary) {
    return buildFallbackWhySheetVm(input.badge);
  }

  return {
    visible: true,
    title: WHY_TITLE,
    badge: input.badge,
    scenarioId: input.scenario.id,
    sections,
    summary,
    isFallback: false,
  };
}

function buildActiveSleepCard(input: {
  badge?: string;
  metadata: NonNullable<ReturnType<typeof getScenarioMetadata>>;
  now: Date;
  plan: SleepPlanPreset;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
}): SleepCoachCardVm {
  const anchor =
    getCurrentSleepAverageEndAnchor({
      now: input.now,
      plan: input.plan,
      sleepDayStart: input.sleepDayStart,
      snapshot: input.snapshot,
    }) ?? getPredictedBedtimeAnchor(input.snapshot, 'Отбой пока около');
  const sleepCanContinue = canActiveSleepContinue(input.snapshot, input.plan);

  if (sleepCanContinue) {
    return withCommonFields({
      ...input.metadata,
      anchor,
      badge: input.badge,
      body: 'Сон пока короткий. Пусть доберёт, а после пробуждения пересчитаем следующий шаг.',
      primaryActionLabel: 'Завершить сон',
      secondaryActionLabel: 'Внести сон',
      title: 'Дать поспать ещё',
      tone: 'calm',
    });
  }

  return withCommonFields({
    ...input.metadata,
    anchor,
    badge: input.badge,
    body: 'Если сон сильно затянется, отбой может уйти позже. Лучше мягко завершить сон в ближайшее время.',
    primaryActionLabel: 'Завершить сон',
    secondaryActionLabel: 'Внести сон',
    title: 'Скоро завершить сон',
    tone: 'adjustDay',
  });
}

function buildNightCard(input: {
  badge?: string;
  metadata: NonNullable<ReturnType<typeof getScenarioMetadata>>;
  plan: SleepPlanPreset;
  sleepDayStart: Date;
  snapshot: SleepSnapshot;
}): SleepCoachCardVm {
  const anchor =
    getBedtimeRangeAnchor(input.plan, input.sleepDayStart) ??
    getPredictedBedtimeAnchor(input.snapshot, 'Отбой около');

  return withCommonFields({
    ...input.metadata,
    anchor,
    badge: input.badge,
    body: 'День немного сдвинулся, но ночь можно мягко выровнять ранним укладыванием.',
    primaryActionLabel: 'Начать ночь',
    secondaryActionLabel: 'Внести сон',
    title: 'Лучше ранний отбой',
    tone: 'adjustDay',
  });
}

function buildAwakeCard(input: {
  badge?: string;
  metadata: NonNullable<ReturnType<typeof getScenarioMetadata>>;
  now: Date;
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
}): SleepCoachCardVm {
  const minutesUntilNextSleep = minutesBetween(input.now, input.snapshot.nextSleepAt);

  if (minutesUntilNextSleep <= 0 || input.snapshot.remainingAwakeMinutes <= 0) {
    return withCommonFields({
      ...input.metadata,
      anchor: getPredictedBedtimeAnchor(input.snapshot, 'Отбой пока можно сохранить около'),
      badge: input.badge,
      body: 'Бодрствование уже затянулось. Сон сейчас поможет не разогнать вечер.',
      primaryActionLabel: 'Начать сон',
      secondaryActionLabel: 'Внести сон',
      title: 'Лучше укладывать сейчас',
      tone: 'actSoon',
    });
  }

  if (minutesUntilNextSleep <= PREPARE_THRESHOLD_MINUTES) {
    return withCommonFields({
      ...input.metadata,
      anchor: getNapWindowAnchor({
        now: input.now,
        snapshot: input.snapshot,
      }),
      badge: input.badge,
      body: 'Окно бодрствования уже близко к ориентиру. Лучше начать укладывание спокойно, без спешки.',
      primaryActionLabel: 'Начать сон',
      secondaryActionLabel: 'Внести сон',
      title: 'Пора готовиться ко сну',
      tone: 'prepare',
    });
  }

  return withCommonFields({
    ...input.metadata,
    anchor: getNapWindowAnchor({
      now: input.now,
      snapshot: input.snapshot,
    }),
    badge: input.badge,
    body: 'Следующий сон ожидается не сразу. Ближе к окну лучше перейти к спокойной подготовке.',
    primaryActionLabel: 'Начать сон',
    secondaryActionLabel: 'Внести сон',
    title: 'Пока можно бодрствовать',
    tone: 'calm',
  });
}

export function buildSleepCoachCardVm(input: BuildSleepCoachCardVmInput): SleepCoachCardVm {
  if (
    !input.viewState.canShowCoachBlocks ||
    !input.viewState.hasActiveTargetPlan ||
    !input.viewState.isTodaySelected ||
    input.viewState.isTrackingOnlyWithoutPlan ||
    input.viewState.showPlanStartNoDataHint ||
    !input.viewState.showPlanBasedPredictions ||
    !input.snapshot ||
    !input.plan ||
    !isValidDate(input.now) ||
    !isValidDate(input.sleepDayStart) ||
    !hasSafeSnapshotDates(input.snapshot)
  ) {
    return HIDDEN_SLEEP_COACH_CARD_VM;
  }

  const metadata = getScenarioMetadata(input.snapshot);

  if (!metadata) {
    return HIDDEN_SLEEP_COACH_CARD_VM;
  }

  const badge = getBadge(input.temporaryModeBadge);

  if (input.snapshot.state === 'sleeping') {
    return buildActiveSleepCard({
      badge,
      metadata,
      now: input.now,
      plan: input.plan,
      sleepDayStart: input.sleepDayStart,
      snapshot: input.snapshot,
    });
  }

  if (input.snapshot.nextSleepKind === 'night') {
    return buildNightCard({
      badge,
      metadata,
      plan: input.plan,
      sleepDayStart: input.sleepDayStart,
      snapshot: input.snapshot,
    });
  }

  return buildAwakeCard({
    badge,
    metadata,
    now: input.now,
    plan: input.plan,
    snapshot: input.snapshot,
  });
}

export function buildSleepCoachWhySheetVm(
  input: BuildSleepCoachWhySheetVmInput,
): SleepCoachWhySheetVm {
  const badge = getBadge(input.temporaryModeBadge);

  if (!canShowWhySheetShell(input.viewState)) {
    return HIDDEN_SLEEP_COACH_WHY_SHEET_VM;
  }

  if (
    !input.snapshot ||
    !input.plan ||
    !isValidDate(input.now) ||
    !isValidDate(input.sleepDayStart) ||
    !hasSafeSnapshotDates(input.snapshot)
  ) {
    return buildFallbackWhySheetVm(badge);
  }

  const scenario = getPrimaryScenario(input.snapshot);

  if (!scenario) {
    return buildFallbackWhySheetVm(badge);
  }

  if (input.snapshot.state === 'sleeping') {
    return buildActiveSleepWhySheetVm({
      badge,
      plan: input.plan,
      scenario,
      snapshot: input.snapshot,
    });
  }

  return buildAwakeWhySheetVm({
    badge,
    now: input.now,
    plan: input.plan,
    scenario,
    snapshot: input.snapshot,
  });
}

export function buildSleepCoachAlternativesSheetVm(
  input: BuildSleepCoachAlternativesSheetVmInput,
): SleepCoachAlternativesSheetVm {
  if (!canShowWhySheetShell(input.viewState)) {
    return HIDDEN_SLEEP_COACH_ALTERNATIVES_SHEET_VM;
  }

  const { now, plan, sleepDayStart, snapshot } = input;

  if (
    !snapshot ||
    !plan ||
    !isValidDate(now) ||
    !isValidDate(sleepDayStart) ||
    !hasSafeSnapshotDates(snapshot)
  ) {
    return buildFallbackAlternativesSheetVm();
  }

  const recommendedScenario = getPrimaryScenario(snapshot);

  if (!recommendedScenario || snapshot.scenarios.length <= 1) {
    return buildFallbackAlternativesSheetVm();
  }

  const scenarios = getScenariosWithRecommendedFirst(
    snapshot.scenarios,
    recommendedScenario.id,
  );
  const items = scenarios.map((scenario) =>
    buildAlternativeItem({
      now,
      plan,
      scenario,
      sleepDayStart,
      snapshot,
      recommendedScenarioId: recommendedScenario.id,
    }),
  );

  if (items.length <= 1) {
    return buildFallbackAlternativesSheetVm();
  }

  return {
    visible: true,
    title: ALTERNATIVES_TITLE,
    summary: '',
    items,
    isFallback: false,
  };
}
