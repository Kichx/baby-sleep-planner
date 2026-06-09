import {
  addMinutes,
  dateAtMinutes,
  getWakeWindowForNextNap,
  minutesBetween,
} from '@/core/sleepCalculations';
import { calculatePlanBedtimeRange } from '@/core/sleepPlan';
import { formatLocalClock } from '@/core/localDateTime';
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

const EYEBROW = 'Что лучше сейчас';
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

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidFiniteNumber(value: number): boolean {
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
    isValidFiniteNumber(snapshot.remainingAwakeMinutes)
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
    hasWhyDetails: scenario.detail.trim().length > 0,
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
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
  variant: 'relative' | 'clock';
}): string | undefined {
  const wakeWindow = getWakeWindowForNextNap(input.snapshot.completedNaps, input.plan);
  const startAt = addMinutes(input.snapshot.statusStartedAt, wakeWindow.minWakeMinutes);
  const endAt = addMinutes(input.snapshot.statusStartedAt, wakeWindow.maxWakeMinutes);

  if (!isValidDate(startAt) || !isValidDate(endAt) || endAt.getTime() < startAt.getTime()) {
    return `Ориентир сна: ${formatLocalClock(input.snapshot.nextSleepAt)}`;
  }

  if (input.variant === 'relative') {
    const minMinutes = minutesBetween(input.now, startAt);
    const maxMinutes = Math.max(minMinutes, minutesBetween(input.now, endAt));

    if (maxMinutes > 0) {
      return minMinutes === maxMinutes
        ? `Сон примерно через ${minMinutes} мин`
        : `Сон примерно через ${minMinutes}–${maxMinutes} мин`;
    }
  }

  return `Ориентир сна: ${formatLocalClock(startAt)}–${formatLocalClock(endAt)}`;
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

function buildActiveSleepCard(input: {
  badge?: string;
  metadata: NonNullable<ReturnType<typeof getScenarioMetadata>>;
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
}): SleepCoachCardVm {
  const anchor = getPredictedBedtimeAnchor(input.snapshot, 'Отбой пока около');
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
        plan: input.plan,
        snapshot: input.snapshot,
        variant: 'clock',
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
      plan: input.plan,
      snapshot: input.snapshot,
      variant: 'relative',
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
      plan: input.plan,
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
