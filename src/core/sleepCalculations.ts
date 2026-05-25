import { buildRecommendationScenarios } from '@/core/recommendations';
import type {
  SleepKind,
  SleepPlanPreset,
  SleepSession,
  SleepSnapshot,
  WakeWindowPreset,
} from '@/types/sleep';

const MS_PER_MINUTE = 60_000;
const MAX_NAP_INDEX_OFFSET = 1;

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function dateAtMinutes(referenceDate: Date, minutesFromMidnight: number): Date {
  const date = new Date(referenceDate);
  date.setHours(0, minutesFromMidnight, 0, 0);
  return date;
}

export function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function inferSleepKindForStart(startedAt: Date, plan: SleepPlanPreset): SleepKind {
  return inferSleepKindForInterval(startedAt, null, plan);
}

export function inferSleepKindForInterval(
  startedAt: Date,
  endedAt: Date | null,
  plan: SleepPlanPreset,
): SleepKind {
  const minutesFromMidnight = getMinutesFromMidnight(startedAt);

  if (
    minutesFromMidnight < plan.dayStartMinutes ||
    minutesFromMidnight >= plan.earlyBedtimeMinutes
  ) {
    return 'night';
  }

  if (!endedAt) {
    return 'nap';
  }

  const endMinutesFromMidnight = getMinutesFromMidnight(endedAt);
  const crossesMidnight = startedAt.toDateString() !== endedAt.toDateString();

  if (
    crossesMidnight ||
    endMinutesFromMidnight < plan.dayStartMinutes ||
    endMinutesFromMidnight >= plan.earlyBedtimeMinutes
  ) {
    return 'night';
  }

  return 'nap';
}

export function getDayStart(now: Date, plan: SleepPlanPreset): Date {
  const dayStart = dateAtMinutes(now, plan.dayStartMinutes);

  if (now.getTime() >= dayStart.getTime()) {
    return dayStart;
  }

  return addMinutes(dayStart, -24 * 60);
}

export function getWakeWindowForNextNap(
  completedNaps: number,
  plan: SleepPlanPreset,
): WakeWindowPreset {
  const index = Math.min(completedNaps, plan.wakeWindows.length - MAX_NAP_INDEX_OFFSET);
  return plan.wakeWindows[index];
}

export function getActiveSleepSession(sessions: SleepSession[]): SleepSession | undefined {
  return sessions.find((session) => session.endedAt === null);
}

export function getSessionDurationMinutes(session: SleepSession, now: Date): number {
  const startedAt = new Date(session.startedAt);
  const endedAt = session.endedAt ? new Date(session.endedAt) : now;

  return minutesBetween(startedAt, endedAt);
}

export function buildTodaySleepSnapshot(
  sessions: SleepSession[],
  now: Date,
  plan: SleepPlanPreset,
): SleepSnapshot {
  const dayStart = getDayStart(now, plan);
  const todaySessions = sessions.filter((session) => {
    const startedAt = new Date(session.startedAt);
    const endedAt = session.endedAt ? new Date(session.endedAt) : now;

    return startedAt.getTime() >= dayStart.getTime() || endedAt.getTime() >= dayStart.getTime();
  });
  const activeSession = getActiveSleepSession(todaySessions);
  const completedSessions = todaySessions.filter((session) => session.endedAt !== null);
  const completedNaps = completedSessions.filter((session) => session.kind === 'nap').length;
  const lastCompletedSession = completedSessions[completedSessions.length - 1];
  const statusStartedAt = activeSession
    ? new Date(activeSession.startedAt)
    : lastCompletedSession?.endedAt
      ? new Date(lastCompletedSession.endedAt)
      : dayStart;

  const totalDaySleepMinutes = todaySessions.reduce(
    (total, session) =>
      session.kind === 'nap' ? total + getSessionDurationMinutes(session, now) : total,
    0,
  );
  const elapsedDayMinutes = minutesBetween(dayStart, now);
  const totalAwakeMinutes = Math.max(0, elapsedDayMinutes - totalDaySleepMinutes);
  const remainingAwakeMinutes = Math.max(0, plan.targetAwakeMinutes - totalAwakeMinutes);
  const wakeWindow = getWakeWindowForNextNap(completedNaps, plan);
  const state = activeSession ? 'sleeping' : 'awake';
  const currentDurationMinutes = minutesBetween(statusStartedAt, now);
  const nextSleepAt =
    state === 'sleeping' ? now : addMinutes(statusStartedAt, wakeWindow.targetWakeMinutes);
  const predictedBedtimeAt = addMinutes(now, remainingAwakeMinutes);
  const onTrackLabel =
    currentDurationMinutes > wakeWindow.maxWakeMinutes || remainingAwakeMinutes === 0
      ? 'День уходит от плана'
      : 'День близко к плану';

  return {
    state,
    statusStartedAt,
    currentDurationMinutes,
    nextSleepAt,
    predictedBedtimeAt,
    totalAwakeMinutes,
    remainingAwakeMinutes,
    totalDaySleepMinutes,
    completedNaps,
    onTrackLabel,
    scenarios: buildRecommendationScenarios({
      currentWakeMinutes: state === 'awake' ? currentDurationMinutes : 0,
      remainingAwakeMinutes,
      completedNaps,
      wakeWindow,
      isSleeping: state === 'sleeping',
    }),
  };
}
