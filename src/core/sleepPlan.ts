import type { SleepPlanPreset, WakeWindowPreset } from '@/types/sleep';

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMidpoint(first: number, second: number): number {
  return Math.round((first + second) / 2);
}

function normalizeClockMinutes(minutes: number): number {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
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
