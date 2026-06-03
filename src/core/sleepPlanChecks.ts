import {
  calculateTotalSleepRangeFromWakeRange,
  checkTotalSleepRangeAgainstOfficialGuideline,
  type OfficialSleepGuideline,
  type SleepGuidelineRangeStatus,
} from '@/core/officialSleepGuidelines';
import {
  getDaySleepRangeStatusForPracticalPreset,
  getPracticalSleepPresetByAgeMonths,
  type PracticalDaySleepStatus,
  type PracticalSleepPreset,
} from '@/core/practicalSleepPresets';
import {
  checkWakeWindowRangeAgainstGuideline,
  getWakeWindowGuidelineByAgeMonths,
  type WakeWindowGuideline,
  type WakeWindowRangeStatus,
} from '@/core/wakeWindowGuidelines';
import type { SleepPlanPreset } from '@/types/sleep';

export type CompactPlanCheckTone = 'default' | 'warning' | 'muted';

export interface PlanMinuteRange {
  minMinutes: number;
  maxMinutes: number;
}

export interface OfficialSleepPlanCheck {
  guideline: OfficialSleepGuideline | null;
  planRange: PlanMinuteRange;
  guidelineRange: PlanMinuteRange | null;
  status: SleepGuidelineRangeStatus;
  summaryLabel: string;
  tone: CompactPlanCheckTone;
}

export interface PracticalDaySleepPlanCheck {
  preset: PracticalSleepPreset | null;
  planRange: PlanMinuteRange;
  guidelineRange: PlanMinuteRange | null;
  status: PracticalDaySleepStatus;
  summaryLabel: string;
  tone: CompactPlanCheckTone;
}

export interface WakeWindowPlanCheck {
  guideline: WakeWindowGuideline | null;
  planRange: PlanMinuteRange | null;
  guidelineRange: PlanMinuteRange | null;
  status: WakeWindowRangeStatus | 'unknown';
  summaryLabel: string;
  tone: CompactPlanCheckTone;
}

export interface SleepPlanChecks {
  awakeRange: PlanMinuteRange | null;
  daySleep: PracticalDaySleepPlanCheck;
  officialSleep: OfficialSleepPlanCheck;
  wakeWindows: WakeWindowPlanCheck;
}

export const PLAN_CHECK_AWAKE_DESCRIPTION =
  'Это сумма всех промежутков между снами за день. От неё зависит примерный отбой.';

export function getPlanAwakeRange(plan: SleepPlanPreset | null): PlanMinuteRange | null {
  if (!plan) {
    return null;
  }

  return {
    maxMinutes: plan.targetAwakeMaxMinutes,
    minMinutes: plan.targetAwakeMinMinutes,
  };
}

export function getPlanTotalSleepRange(plan: SleepPlanPreset | null): PlanMinuteRange {
  if (!plan) {
    return {
      maxMinutes: 0,
      minMinutes: 0,
    };
  }

  const totalSleepRange = calculateTotalSleepRangeFromWakeRange({
    maxWakeMinutes: plan.targetAwakeMaxMinutes,
    minWakeMinutes: plan.targetAwakeMinMinutes,
  });

  return {
    maxMinutes: totalSleepRange.maxTotalSleepMinutes,
    minMinutes: totalSleepRange.minTotalSleepMinutes,
  };
}

export function getPlanWakeWindowRange(plan: SleepPlanPreset | null): PlanMinuteRange | null {
  if (!plan || plan.wakeWindows.length === 0) {
    return null;
  }

  const range = plan.wakeWindows.reduce(
    (currentRange, wakeWindow) => ({
      maxMinutes: Math.max(currentRange.maxMinutes, wakeWindow.maxWakeMinutes),
      minMinutes: Math.min(currentRange.minMinutes, wakeWindow.minWakeMinutes),
    }),
    {
      maxMinutes: plan.wakeWindows[0].maxWakeMinutes,
      minMinutes: plan.wakeWindows[0].minWakeMinutes,
    },
  );

  return range;
}

export function getCompactOfficialSleepStatusLabel(
  status: SleepGuidelineRangeStatus,
): string {
  switch (status) {
    case 'within_recommended':
      return 'в ориентире';
    case 'partially_within_recommended':
      return 'частично';
    case 'below_recommended':
      return 'ниже';
    case 'above_recommended':
      return 'выше';
    case 'unknown':
      return 'не рассчитано';
  }
}

export function getCompactDaySleepStatusLabel(status: PracticalDaySleepStatus): string {
  switch (status) {
    case 'within_practical_range':
      return 'подходит возрасту';
    case 'partially_within_practical_range':
    case 'below_practical_range':
    case 'above_practical_range':
      return 'отличается от ориентира';
    case 'unknown':
      return 'не рассчитано';
  }
}

export function getCompactWakeWindowStatusLabel(
  status: WakeWindowRangeStatus | 'unknown',
): string {
  switch (status) {
    case 'within':
    case 'partially_overlaps':
      return 'спокойный диапазон';
    case 'short':
      return 'короче';
    case 'long':
      return 'длиннее';
    case 'unknown':
      return 'не рассчитано';
  }
}

export function getOfficialSleepCheckTone(
  status: SleepGuidelineRangeStatus,
): CompactPlanCheckTone {
  if (status === 'unknown') {
    return 'muted';
  }

  return status === 'within_recommended' || status === 'partially_within_recommended'
    ? 'default'
    : 'warning';
}

export function getPracticalDaySleepCheckTone(
  status: PracticalDaySleepStatus,
): CompactPlanCheckTone {
  if (status === 'unknown') {
    return 'muted';
  }

  return status === 'within_practical_range' ? 'default' : 'warning';
}

export function getWakeWindowCheckTone(
  status: WakeWindowRangeStatus | 'unknown',
): CompactPlanCheckTone {
  if (status === 'unknown') {
    return 'muted';
  }

  return status === 'within' || status === 'partially_overlaps' ? 'default' : 'warning';
}

export function buildSleepPlanChecks(params: {
  ageMonths: number | null | undefined;
  plan: SleepPlanPreset | null;
}): SleepPlanChecks {
  const totalSleepRange = getPlanTotalSleepRange(params.plan);
  const officialCheck = checkTotalSleepRangeAgainstOfficialGuideline({
    ageMonths: params.ageMonths,
    maxTotalSleepMinutes: totalSleepRange.maxMinutes,
    minTotalSleepMinutes: totalSleepRange.minMinutes,
  });

  const daySleepCheck = getDaySleepRangeStatusForPracticalPreset({
    ageMonths: params.ageMonths,
    daySleepMaxMinutes: params.plan?.targetDaySleepMaxMinutes,
    daySleepMinMinutes: params.plan?.targetDaySleepMinMinutes,
  });
  const wakeWindowGuideline = getWakeWindowGuidelineByAgeMonths(params.ageMonths);
  const wakeWindowRange = getPlanWakeWindowRange(params.plan);
  const wakeWindowStatus =
    wakeWindowGuideline && wakeWindowRange
      ? checkWakeWindowRangeAgainstGuideline(
          wakeWindowRange.minMinutes,
          wakeWindowRange.maxMinutes,
          wakeWindowGuideline,
        )
      : 'unknown';

  return {
    awakeRange: getPlanAwakeRange(params.plan),
    daySleep: {
      guidelineRange: daySleepCheck.preset
        ? {
            maxMinutes: daySleepCheck.preset.daySleepMaxMinutes,
            minMinutes: daySleepCheck.preset.daySleepMinMinutes,
          }
        : null,
      planRange: {
        maxMinutes: daySleepCheck.daySleepMaxMinutes,
        minMinutes: daySleepCheck.daySleepMinMinutes,
      },
      preset: daySleepCheck.preset,
      status: daySleepCheck.status,
      summaryLabel: getCompactDaySleepStatusLabel(daySleepCheck.status),
      tone: getPracticalDaySleepCheckTone(daySleepCheck.status),
    },
    officialSleep: {
      guideline: officialCheck.guideline,
      guidelineRange:
        officialCheck.recommendedMinMinutes !== null &&
        officialCheck.recommendedMaxMinutes !== null
          ? {
              maxMinutes: officialCheck.recommendedMaxMinutes,
              minMinutes: officialCheck.recommendedMinMinutes,
            }
          : null,
      planRange: {
        maxMinutes: officialCheck.maxTotalSleepMinutes,
        minMinutes: officialCheck.minTotalSleepMinutes,
      },
      status: officialCheck.status,
      summaryLabel: getCompactOfficialSleepStatusLabel(officialCheck.status),
      tone: getOfficialSleepCheckTone(officialCheck.status),
    },
    wakeWindows: {
      guideline: wakeWindowGuideline,
      guidelineRange: wakeWindowGuideline
        ? {
            maxMinutes: wakeWindowGuideline.maxWakeWindowMinutes,
            minMinutes: wakeWindowGuideline.minWakeWindowMinutes,
          }
        : null,
      planRange: wakeWindowRange,
      status: wakeWindowStatus,
      summaryLabel: getCompactWakeWindowStatusLabel(wakeWindowStatus),
      tone: getWakeWindowCheckTone(wakeWindowStatus),
    },
  };
}
