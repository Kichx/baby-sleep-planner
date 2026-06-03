import type {
  SleepDayTemporaryMode,
  SleepPlanPreset,
  TargetDayPlan,
  WakeWindowPreset,
} from '@/types/sleep';

interface SleepPlanRangeInput {
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  napCount: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
  latestEveningNapEndMinutes: number;
  maxEveningNapMinutes: number;
  minNightSleepMinutes: number;
  microNapMinutes: number;
}

interface EveningSleepRulesInput {
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  napCount: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
}

export interface EveningSleepRules {
  latestEveningNapEndMinutes: number;
  maxEveningNapMinutes: number;
  microNapMinutes: number;
}

interface BedtimeRange {
  startMinutes: number;
  endMinutes: number;
}

export interface IdealSleepPlanSegment {
  id: string;
  kind: 'awake' | 'sleep';
  order: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

const DAY_MINUTES = 24 * 60;
const EARLY_BEDTIME_OFFSET_MINUTES = 60;
const MIN_NAP_COUNT = 1;
const MAX_NAP_COUNT = 5;
const SINGLE_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 180;
const TWO_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 120;
const MANY_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 0;
const SINGLE_NAP_MAX_EVENING_NAP_MINUTES = 30;
const TWO_NAP_MAX_EVENING_NAP_MINUTES = 40;
const MANY_NAP_MAX_EVENING_NAP_MINUTES = 45;
const SINGLE_NAP_MICRO_NAP_MINUTES = 0;
const TWO_NAP_MICRO_NAP_MINUTES = 15;
const MANY_NAP_MICRO_NAP_MINUTES = 20;
const SOFT_DAY_AWAKE_REDUCTION_MINUTES = 30;
const SOFT_DAY_MAX_DAY_SLEEP_EXTENSION_MINUTES = 30;
const EARLY_WAKE_MIN_FIRST_WAKE_REDUCTION_MINUTES = 15;
const EARLY_WAKE_MAX_FIRST_WAKE_REDUCTION_MINUTES = 30;

export const EARLY_WAKE_THRESHOLD_MINUTES = 30;

interface EffectivePlanBaseInput {
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  napCount: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
  minNightSleepMinutes: number;
}

interface EarlyWakeSuggestionParams {
  planWakeWindowStartMinutes: number;
  actualWakeMinutes: number | null;
  thresholdMinutes?: number;
  alreadyEnabled: boolean;
  alreadyDismissed: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMidpoint(first: number, second: number): number {
  return Math.round((first + second) / 2);
}

function normalizeClockMinutes(minutes: number): number {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function getLocalClockMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getPlanBaseInput(plan: SleepPlanPreset): EffectivePlanBaseInput {
  return {
    minNightSleepMinutes: plan.minNightSleepMinutes,
    napCount: plan.napCount,
    targetAwakeMaxMinutes: plan.targetAwakeMaxMinutes,
    targetAwakeMinMinutes: plan.targetAwakeMinMinutes,
    targetDaySleepMaxMinutes: plan.targetDaySleepMaxMinutes,
    targetDaySleepMinMinutes: plan.targetDaySleepMinMinutes,
    wakeUpEndMinutes: plan.wakeUpEndMinutes,
    wakeUpStartMinutes: plan.wakeUpStartMinutes,
  };
}

function getEarlyWakeFirstWindowReductionMinutes(
  basePlan: SleepPlanPreset,
  actualWakeTime: Date | null,
): number {
  if (!actualWakeTime) {
    return EARLY_WAKE_MIN_FIRST_WAKE_REDUCTION_MINUTES;
  }

  const earlyByMinutes = basePlan.wakeUpStartMinutes - getLocalClockMinutes(actualWakeTime);

  return clamp(
    earlyByMinutes,
    EARLY_WAKE_MIN_FIRST_WAKE_REDUCTION_MINUTES,
    EARLY_WAKE_MAX_FIRST_WAKE_REDUCTION_MINUTES,
  );
}

function shortenWakeWindow(
  wakeWindow: WakeWindowPreset,
  reductionMinutes: number,
): WakeWindowPreset {
  const minWakeMinutes = Math.max(1, wakeWindow.minWakeMinutes - reductionMinutes);
  const maxWakeMinutes = Math.max(minWakeMinutes, wakeWindow.maxWakeMinutes - reductionMinutes);
  const targetWakeMinutes = clamp(
    wakeWindow.targetWakeMinutes - reductionMinutes,
    minWakeMinutes,
    maxWakeMinutes,
  );

  return {
    ...wakeWindow,
    maxWakeMinutes,
    minWakeMinutes,
    targetWakeMinutes,
  };
}

function applyFirstWakeWindowReduction(
  plan: SleepPlanPreset,
  reductionMinutes: number,
): SleepPlanPreset {
  if (reductionMinutes <= 0 || plan.wakeWindows.length === 0) {
    return plan;
  }

  return {
    ...plan,
    wakeWindows: plan.wakeWindows.map((wakeWindow, index) =>
      index === 0 ? shortenWakeWindow(wakeWindow, reductionMinutes) : { ...wakeWindow },
    ),
  };
}

function buildAutoDerivedPlanPreset(
  input: EffectivePlanBaseInput,
  firstWakeWindowReductionMinutes = 0,
): SleepPlanPreset {
  const eveningRules = deriveEveningSleepRulesForPlan(input);
  const plan = buildSleepPlanPreset({
    ...input,
    ...eveningRules,
  });

  return applyFirstWakeWindowReduction(plan, firstWakeWindowReductionMinutes);
}

function buildTargetDayPlanWithPreset(
  basePlan: TargetDayPlan,
  plan: SleepPlanPreset,
): TargetDayPlan {
  return {
    ...basePlan,
    eveningRulesMode: 'auto',
    plan,
  };
}

function isTemporaryModeEnabled(
  temporaryModes: SleepDayTemporaryMode[],
  mode: SleepDayTemporaryMode['mode'],
): boolean {
  return temporaryModes.some(
    (temporaryMode) => temporaryMode.mode === mode && temporaryMode.disabledAt === null,
  );
}

function getSoftDayPlanBaseInput(baseInput: EffectivePlanBaseInput): EffectivePlanBaseInput {
  const targetAwakeMinMinutes = Math.max(
    1,
    baseInput.targetAwakeMinMinutes - SOFT_DAY_AWAKE_REDUCTION_MINUTES,
  );
  const targetAwakeMaxMinutes = Math.max(
    targetAwakeMinMinutes,
    baseInput.targetAwakeMaxMinutes - SOFT_DAY_AWAKE_REDUCTION_MINUTES,
  );
  const targetDaySleepMaxMinutes = Math.max(
    baseInput.targetDaySleepMinMinutes,
    baseInput.targetDaySleepMaxMinutes + SOFT_DAY_MAX_DAY_SLEEP_EXTENSION_MINUTES,
  );

  return {
    ...baseInput,
    targetAwakeMaxMinutes,
    targetAwakeMinMinutes,
    targetDaySleepMaxMinutes,
  };
}

export function clampNapCount(napCount: number): number {
  return clamp(Math.round(napCount), MIN_NAP_COUNT, MAX_NAP_COUNT);
}

export function calculatePlanBedtimeRange(input: {
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
}): BedtimeRange {
  return {
    endMinutes: normalizeClockMinutes(
      input.wakeUpEndMinutes + input.targetAwakeMaxMinutes + input.targetDaySleepMaxMinutes,
    ),
    startMinutes: normalizeClockMinutes(
      input.wakeUpStartMinutes + input.targetAwakeMinMinutes + input.targetDaySleepMinMinutes,
    ),
  };
}

export function buildWakeWindowsForPlan(input: {
  napCount: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
}): WakeWindowPreset[] {
  const napCount = clampNapCount(input.napCount);
  const wakeSlotCount = napCount + 1;
  const minWakeMinutes = Math.max(1, Math.round(input.targetAwakeMinMinutes / wakeSlotCount));
  const maxWakeMinutes = Math.max(
    minWakeMinutes,
    Math.round(input.targetAwakeMaxMinutes / wakeSlotCount),
  );
  const targetWakeMinutes = getMidpoint(minWakeMinutes, maxWakeMinutes);

  return Array.from({ length: napCount }, (_, index) => ({
    maxWakeMinutes,
    minWakeMinutes,
    napNumber: index + 1,
    targetWakeMinutes,
  }));
}

export function deriveEveningSleepRulesForPlan(input: EveningSleepRulesInput): EveningSleepRules {
  const napCount = clampNapCount(input.napCount);
  const bedtimeRange = calculatePlanBedtimeRange(input);
  const latestEndOffsetMinutes =
    napCount === 1
      ? SINGLE_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES
      : napCount === 2
        ? TWO_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES
        : MANY_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES;
  const maxEveningNapMinutes =
    napCount === 1
      ? SINGLE_NAP_MAX_EVENING_NAP_MINUTES
      : napCount === 2
        ? TWO_NAP_MAX_EVENING_NAP_MINUTES
        : MANY_NAP_MAX_EVENING_NAP_MINUTES;
  const microNapMinutes =
    napCount === 1
      ? SINGLE_NAP_MICRO_NAP_MINUTES
      : napCount === 2
        ? TWO_NAP_MICRO_NAP_MINUTES
        : MANY_NAP_MICRO_NAP_MINUTES;

  return {
    latestEveningNapEndMinutes: normalizeClockMinutes(
      bedtimeRange.startMinutes - latestEndOffsetMinutes,
    ),
    maxEveningNapMinutes,
    microNapMinutes,
  };
}

export function buildSleepPlanPreset(input: SleepPlanRangeInput): SleepPlanPreset {
  const napCount = clampNapCount(input.napCount);
  const bedtimeRange = calculatePlanBedtimeRange(input);
  const targetAwakeMinutes = getMidpoint(
    input.targetAwakeMinMinutes,
    input.targetAwakeMaxMinutes,
  );
  const targetDaySleepMinutes = getMidpoint(
    input.targetDaySleepMinMinutes,
    input.targetDaySleepMaxMinutes,
  );

  return {
    bedtimeTargetMinutes: bedtimeRange.startMinutes,
    dayStartMinutes: input.wakeUpStartMinutes,
    earlyBedtimeMinutes: normalizeClockMinutes(
      bedtimeRange.startMinutes - EARLY_BEDTIME_OFFSET_MINUTES,
    ),
    latestEveningNapEndMinutes: input.latestEveningNapEndMinutes,
    maxEveningNapMinutes: input.maxEveningNapMinutes,
    microNapMinutes: input.microNapMinutes,
    minNightSleepMinutes: input.minNightSleepMinutes,
    napCount,
    targetAwakeMaxMinutes: input.targetAwakeMaxMinutes,
    targetAwakeMinMinutes: input.targetAwakeMinMinutes,
    targetAwakeMinutes,
    targetDaySleepMaxMinutes: input.targetDaySleepMaxMinutes,
    targetDaySleepMinMinutes: input.targetDaySleepMinMinutes,
    targetDaySleepMinutes,
    wakeUpEndMinutes: input.wakeUpEndMinutes,
    wakeUpStartMinutes: input.wakeUpStartMinutes,
    wakeWindows: buildWakeWindowsForPlan({
      napCount,
      targetAwakeMaxMinutes: input.targetAwakeMaxMinutes,
      targetAwakeMinMinutes: input.targetAwakeMinMinutes,
    }),
  };
}

export function deriveSoftDayPlan(basePlan: TargetDayPlan): TargetDayPlan {
  const planInput = getSoftDayPlanBaseInput(getPlanBaseInput(basePlan.plan));

  return buildTargetDayPlanWithPreset(basePlan, buildAutoDerivedPlanPreset(planInput));
}

export function deriveEarlyWakePlan(
  basePlan: TargetDayPlan,
  actualWakeTime: Date | null,
): TargetDayPlan {
  const firstWakeWindowReductionMinutes = getEarlyWakeFirstWindowReductionMinutes(
    basePlan.plan,
    actualWakeTime,
  );
  const plan = buildAutoDerivedPlanPreset(
    getPlanBaseInput(basePlan.plan),
    firstWakeWindowReductionMinutes,
  );

  return buildTargetDayPlanWithPreset(basePlan, plan);
}

export function buildEffectiveSleepDayPlan(
  basePlan: TargetDayPlan,
  temporaryModes: SleepDayTemporaryMode[],
  options: { actualWakeTime?: Date | null } = {},
): TargetDayPlan {
  const hasEarlyWakeMode = isTemporaryModeEnabled(temporaryModes, 'early_wake');
  const hasSoftDayMode = isTemporaryModeEnabled(temporaryModes, 'soft_day');

  if (!hasEarlyWakeMode && !hasSoftDayMode) {
    return {
      ...basePlan,
      plan: {
        ...basePlan.plan,
        wakeWindows: basePlan.plan.wakeWindows.map((wakeWindow) => ({ ...wakeWindow })),
      },
    };
  }

  let planInput = getPlanBaseInput(basePlan.plan);
  const firstWakeWindowReductionMinutes = hasEarlyWakeMode
    ? getEarlyWakeFirstWindowReductionMinutes(basePlan.plan, options.actualWakeTime ?? null)
    : 0;

  if (hasSoftDayMode) {
    planInput = getSoftDayPlanBaseInput(planInput);
  }

  return buildTargetDayPlanWithPreset(
    basePlan,
    buildAutoDerivedPlanPreset(planInput, firstWakeWindowReductionMinutes),
  );
}

export function shouldSuggestEarlyWakeMode(params: EarlyWakeSuggestionParams): boolean {
  if (params.alreadyEnabled || params.alreadyDismissed || params.actualWakeMinutes === null) {
    return false;
  }

  const thresholdMinutes = params.thresholdMinutes ?? EARLY_WAKE_THRESHOLD_MINUTES;
  const earlyByMinutes = params.planWakeWindowStartMinutes - params.actualWakeMinutes;

  return earlyByMinutes >= thresholdMinutes;
}

export function buildIdealSleepPlanSegments(plan: SleepPlanPreset): IdealSleepPlanSegment[] {
  const wakeSlotCount = plan.napCount + 1;
  const wakeDurationMinutes = Math.round(plan.targetAwakeMinutes / wakeSlotCount);
  const sleepDurationMinutes = Math.round(plan.targetDaySleepMinutes / plan.napCount);
  const wakeUpMinutes = getMidpoint(plan.wakeUpStartMinutes, plan.wakeUpEndMinutes);
  const segments: IdealSleepPlanSegment[] = [];
  let cursorMinutes = wakeUpMinutes;

  for (let index = 0; index < plan.napCount; index += 1) {
    const awakeStartMinutes = cursorMinutes;
    const awakeEndMinutes = cursorMinutes + wakeDurationMinutes;

    segments.push({
      durationMinutes: wakeDurationMinutes,
      endMinutes: normalizeClockMinutes(awakeEndMinutes),
      id: `awake-${index + 1}`,
      kind: 'awake',
      order: index + 1,
      startMinutes: normalizeClockMinutes(awakeStartMinutes),
    });

    cursorMinutes = awakeEndMinutes;

    const sleepStartMinutes = cursorMinutes;
    const sleepEndMinutes = cursorMinutes + sleepDurationMinutes;

    segments.push({
      durationMinutes: sleepDurationMinutes,
      endMinutes: normalizeClockMinutes(sleepEndMinutes),
      id: `sleep-${index + 1}`,
      kind: 'sleep',
      order: index + 1,
      startMinutes: normalizeClockMinutes(sleepStartMinutes),
    });

    cursorMinutes = sleepEndMinutes;
  }

  const finalWakeStartMinutes = cursorMinutes;
  const finalWakeEndMinutes = cursorMinutes + wakeDurationMinutes;

  segments.push({
    durationMinutes: wakeDurationMinutes,
    endMinutes: normalizeClockMinutes(finalWakeEndMinutes),
    id: `awake-${plan.napCount + 1}`,
    kind: 'awake',
    order: plan.napCount + 1,
    startMinutes: normalizeClockMinutes(finalWakeStartMinutes),
  });

  return segments;
}
