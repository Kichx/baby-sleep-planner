import { addMinutes, dateAtMinutes, getSessionKindForCalculations } from '@/core/sleepCalculations';
import { getLocalMinutesFromMidnight } from '@/core/localDateTime';
import { buildEffectiveSleepDayPlan, shouldSuggestEarlyWakeMode } from '@/core/sleepPlan';
import { dateFromSleepDayDateKey } from '@/core/sleepDay';
import type {
  SleepDayTemporaryMode,
  SleepDayTemporaryModeType,
  SleepPlanPreset,
  SleepSession,
  TargetDayPlan,
} from '@/types/sleep';

const DAY_MINUTES = 24 * 60;

export type TemporaryModeBadgeLabel =
  | 'Сегодня мягкий день'
  | 'Сегодня ранний подъём'
  | 'Сегодня график скорректирован';

export interface TodayEffectiveSleepPlanResult {
  actualWakeTime: Date | null;
  plan: SleepPlanPreset;
}

export function hasActiveTemporaryMode(
  temporaryModes: SleepDayTemporaryMode[],
  mode: SleepDayTemporaryModeType,
): boolean {
  return temporaryModes.some(
    (temporaryMode) => temporaryMode.mode === mode && temporaryMode.disabledAt === null,
  );
}

export function hasDismissedTemporaryModeSuggestion(
  temporaryModes: SleepDayTemporaryMode[],
  mode: SleepDayTemporaryModeType,
): boolean {
  return temporaryModes.some(
    (temporaryMode) => temporaryMode.mode === mode && temporaryMode.dismissedAt !== null,
  );
}

export function getTemporaryModeBadgeLabel(
  temporaryModes: SleepDayTemporaryMode[],
): TemporaryModeBadgeLabel | null {
  const hasSoftDay = hasActiveTemporaryMode(temporaryModes, 'soft_day');
  const hasEarlyWake = hasActiveTemporaryMode(temporaryModes, 'early_wake');

  if (hasSoftDay && hasEarlyWake) {
    return 'Сегодня график скорректирован';
  }

  if (hasSoftDay) {
    return 'Сегодня мягкий день';
  }

  if (hasEarlyWake) {
    return 'Сегодня ранний подъём';
  }

  return null;
}

function getSleepDayStart(sleepDayDateKey: string, plan: SleepPlanPreset): Date {
  return dateAtMinutes(dateFromSleepDayDateKey(sleepDayDateKey), plan.dayStartMinutes);
}

function getWakeWindowEnd(sleepDayStart: Date, plan: SleepPlanPreset): Date {
  let wakeWindowEnd = dateAtMinutes(sleepDayStart, plan.wakeUpEndMinutes);

  if (wakeWindowEnd.getTime() < sleepDayStart.getTime()) {
    wakeWindowEnd = addMinutes(wakeWindowEnd, DAY_MINUTES);
  }

  return wakeWindowEnd;
}

export function getActualWakeTimeForEarlyWakeMode(params: {
  now: Date;
  plan: SleepPlanPreset;
  sessions: SleepSession[];
  sleepDayDateKey: string;
}): Date | null {
  const sleepDayStart = getSleepDayStart(params.sleepDayDateKey, params.plan);
  const searchStart = addMinutes(sleepDayStart, -DAY_MINUTES);
  const wakeWindowEnd = getWakeWindowEnd(sleepDayStart, params.plan);
  const searchEnd = new Date(Math.min(params.now.getTime(), wakeWindowEnd.getTime()));
  const hasActiveNightSleep = params.sessions.some((session) => {
    if (session.endedAt !== null) {
      return false;
    }

    const startedAt = new Date(session.startedAt);

    if (startedAt.getTime() >= searchEnd.getTime()) {
      return false;
    }

    return getSessionKindForCalculations(session, params.now, params.plan) === 'night';
  });

  if (hasActiveNightSleep) {
    return null;
  }

  const wakeUps = params.sessions
    .filter((session) => session.endedAt !== null)
    .map((session) => {
      const endedAt = new Date(session.endedAt ?? '');

      return {
        endedAt,
        kind: getSessionKindForCalculations(session, endedAt, params.plan),
      };
    })
    .filter(
      ({ endedAt, kind }) =>
        kind === 'night' &&
        endedAt.getTime() >= searchStart.getTime() &&
        endedAt.getTime() <= searchEnd.getTime(),
    )
    .sort((first, second) => second.endedAt.getTime() - first.endedAt.getTime());

  return wakeUps[0]?.endedAt ?? null;
}

export function buildTodayEffectiveSleepPlan(params: {
  basePlan: TargetDayPlan;
  now: Date;
  sessions: SleepSession[];
  sleepDayDateKey: string;
  temporaryModes: SleepDayTemporaryMode[];
}): TodayEffectiveSleepPlanResult {
  const actualWakeTime = getActualWakeTimeForEarlyWakeMode({
    now: params.now,
    plan: params.basePlan.plan,
    sessions: params.sessions,
    sleepDayDateKey: params.sleepDayDateKey,
  });
  const effectivePlan = buildEffectiveSleepDayPlan(params.basePlan, params.temporaryModes, {
    actualWakeTime,
  });

  return {
    actualWakeTime,
    plan: effectivePlan.plan,
  };
}

export function shouldShowEarlyWakeModeSuggestion(params: {
  actualWakeTime: Date | null;
  basePlan: SleepPlanPreset;
  temporaryModes: SleepDayTemporaryMode[];
}): boolean {
  return shouldSuggestEarlyWakeMode({
    actualWakeMinutes: params.actualWakeTime
      ? getLocalMinutesFromMidnight(params.actualWakeTime)
      : null,
    alreadyDismissed: hasDismissedTemporaryModeSuggestion(
      params.temporaryModes,
      'early_wake',
    ),
    alreadyEnabled: hasActiveTemporaryMode(params.temporaryModes, 'early_wake'),
    planWakeWindowStartMinutes: params.basePlan.wakeUpStartMinutes,
  });
}
