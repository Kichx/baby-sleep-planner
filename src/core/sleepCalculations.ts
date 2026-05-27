import { buildRecommendationScenarios } from '@/core/recommendations';
import { calculatePlanBedtimeRange } from '@/core/sleepPlan';
import type {
  SleepDaySummary,
  SleepKind,
  SleepPlanPreset,
  SleepSession,
  SleepSnapshot,
  SleepState,
  SleepTimelineSegment,
  WakeWindowPreset,
} from '@/types/sleep';

const MS_PER_MINUTE = 60_000;
const MAX_NAP_INDEX_OFFSET = 1;
const DAY_MINUTES = 24 * 60;
const SUMMARY_TOLERANCE_MINUTES = 30;
const MAX_SUMMARY_FEEDBACK_LINES = 3;

interface BedtimeProjectionInput {
  activeSession: SleepSession | undefined;
  activeSessionKind: SleepKind | null;
  completedNaps: number;
  dayStart: Date;
  now: Date;
  plan: SleepPlanPreset;
  remainingAwakeMinutes: number;
  state: SleepState;
  statusStartedAt: Date;
  totalDaySleepMinutes: number;
}

interface BedtimeProjection {
  nextSleepAt: Date;
  nextSleepKind: SleepKind;
  predictedBedtimeAt: Date;
  projectedRemainingDaySleepMinutes: number;
}

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
  const startMinutesFromMidnight = getMinutesFromMidnight(startedAt);

  if (startMinutesFromMidnight < plan.dayStartMinutes) {
    return 'night';
  }

  if (!endedAt) {
    return startMinutesFromMidnight >= plan.bedtimeTargetMinutes ? 'night' : 'nap';
  }

  const endMinutesFromMidnight = getMinutesFromMidnight(endedAt);
  const durationMinutes = minutesBetween(startedAt, endedAt);
  const crossesMidnight = startedAt.toDateString() !== endedAt.toDateString();

  if (crossesMidnight || startMinutesFromMidnight >= plan.bedtimeTargetMinutes) {
    return 'night';
  }

  if (startMinutesFromMidnight >= plan.earlyBedtimeMinutes) {
    const isShortEveningNap =
      durationMinutes <= plan.maxEveningNapMinutes &&
      endMinutesFromMidnight <= plan.latestEveningNapEndMinutes;

    return isShortEveningNap ? 'nap' : 'night';
  }

  if (
    durationMinutes >= plan.minNightSleepMinutes &&
    endMinutesFromMidnight >= plan.bedtimeTargetMinutes
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

  return addMinutes(dayStart, -DAY_MINUTES);
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

export function getSessionKindForCalculations(
  session: SleepSession,
  effectiveEndedAt: Date,
  plan: SleepPlanPreset,
): SleepKind {
  return inferSleepKindForInterval(new Date(session.startedAt), effectiveEndedAt, plan);
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function getSessionOverlapMinutes(session: SleepSession, rangeStart: Date, rangeEnd: Date): number {
  const startedAt = maxDate(new Date(session.startedAt), rangeStart);
  const endedAt = minDate(session.endedAt ? new Date(session.endedAt) : rangeEnd, rangeEnd);

  if (endedAt.getTime() <= startedAt.getTime()) {
    return 0;
  }

  return minutesBetween(startedAt, endedAt);
}

function dateAtSleepDayMinutes(dayStart: Date, minutesFromMidnight: number): Date {
  const date = dateAtMinutes(dayStart, minutesFromMidnight);

  if (date.getTime() < dayStart.getTime()) {
    return addMinutes(date, DAY_MINUTES);
  }

  return date;
}

function getTargetNapMinutes(plan: SleepPlanPreset): number {
  return Math.max(0, Math.round(plan.targetDaySleepMinutes / Math.max(1, plan.napCount)));
}

function canProjectPlannedNap(
  napStartAt: Date,
  napDurationMinutes: number,
  earlyBedtimeAt: Date,
  latestEveningNapEndAt: Date,
): boolean {
  const napEndAt = addMinutes(napStartAt, napDurationMinutes);

  return (
    napStartAt.getTime() < earlyBedtimeAt.getTime() &&
    napEndAt.getTime() <= latestEveningNapEndAt.getTime()
  );
}

function buildBedtimeProjection(input: BedtimeProjectionInput): BedtimeProjection {
  if (input.activeSession && input.activeSessionKind === 'night') {
    return {
      nextSleepAt: new Date(input.activeSession.startedAt),
      nextSleepKind: 'night',
      predictedBedtimeAt: new Date(input.activeSession.startedAt),
      projectedRemainingDaySleepMinutes: 0,
    };
  }

  const earlyBedtimeAt = dateAtSleepDayMinutes(input.dayStart, input.plan.earlyBedtimeMinutes);
  const latestEveningNapEndAt = dateAtSleepDayMinutes(
    input.dayStart,
    input.plan.latestEveningNapEndMinutes,
  );
  const targetNapMinutes = getTargetNapMinutes(input.plan);
  let cursor = input.now;
  let awakeLeft = input.remainingAwakeMinutes;
  let usedNaps = input.completedNaps;
  let sleepDeficitMinutes = Math.max(
    0,
    input.plan.targetDaySleepMinutes - input.totalDaySleepMinutes,
  );
  let nextSleepAt: Date | null = null;
  let nextSleepKind: SleepKind = 'night';
  let projectedRemainingDaySleepMinutes = 0;
  let wakeStartedAt = input.state === 'awake' ? input.statusStartedAt : cursor;

  if (input.activeSession && input.activeSessionKind === 'nap') {
    const activeNapDurationMinutes = minutesBetween(new Date(input.activeSession.startedAt), cursor);
    const activeNapRemainingMinutes = Math.min(
      sleepDeficitMinutes,
      Math.max(0, targetNapMinutes - activeNapDurationMinutes),
      Math.max(0, minutesBetween(cursor, latestEveningNapEndAt)),
    );

    if (activeNapRemainingMinutes > 0) {
      cursor = addMinutes(cursor, activeNapRemainingMinutes);
      projectedRemainingDaySleepMinutes += activeNapRemainingMinutes;
      sleepDeficitMinutes -= activeNapRemainingMinutes;
    }

    usedNaps += 1;
    wakeStartedAt = cursor;
  }

  while (awakeLeft > 0 && usedNaps < input.plan.napCount && sleepDeficitMinutes > 0) {
    const wakeWindow = getWakeWindowForNextNap(usedNaps, input.plan);
    const currentWakeMinutes = minutesBetween(wakeStartedAt, cursor);
    const awakeBeforeNextNap = Math.max(0, wakeWindow.targetWakeMinutes - currentWakeMinutes);

    if (awakeLeft <= awakeBeforeNextNap) {
      break;
    }

    const napStartAt = addMinutes(cursor, awakeBeforeNextNap);
    const napDurationMinutes = Math.min(targetNapMinutes, sleepDeficitMinutes);

    if (
      napDurationMinutes <= 0 ||
      !canProjectPlannedNap(
        napStartAt,
        napDurationMinutes,
        earlyBedtimeAt,
        latestEveningNapEndAt,
      )
    ) {
      break;
    }

    if (!nextSleepAt) {
      nextSleepAt = napStartAt;
      nextSleepKind = 'nap';
    }

    cursor = addMinutes(napStartAt, napDurationMinutes);
    awakeLeft -= awakeBeforeNextNap;
    sleepDeficitMinutes -= napDurationMinutes;
    projectedRemainingDaySleepMinutes += napDurationMinutes;
    usedNaps += 1;
    wakeStartedAt = cursor;
  }

  if (awakeLeft > 0 && usedNaps >= input.plan.napCount && input.plan.microNapMinutes > 0) {
    const wakeWindow = getWakeWindowForNextNap(usedNaps, input.plan);
    const currentWakeMinutes = minutesBetween(wakeStartedAt, cursor);
    const finalWakeMinutes = currentWakeMinutes + awakeLeft;
    const awakeBeforeMicroNap = Math.max(0, wakeWindow.targetWakeMinutes - currentWakeMinutes);
    const microNapStartAt = addMinutes(cursor, awakeBeforeMicroNap);
    const microNapEndAt = addMinutes(microNapStartAt, input.plan.microNapMinutes);
    const canAddMicroNap =
      finalWakeMinutes > wakeWindow.maxWakeMinutes &&
      awakeLeft > awakeBeforeMicroNap &&
      microNapEndAt.getTime() <= latestEveningNapEndAt.getTime() &&
      input.totalDaySleepMinutes +
        projectedRemainingDaySleepMinutes +
        input.plan.microNapMinutes <=
        input.plan.targetDaySleepMaxMinutes;

    if (canAddMicroNap) {
      if (!nextSleepAt) {
        nextSleepAt = microNapStartAt;
        nextSleepKind = 'nap';
      }

      cursor = microNapEndAt;
      awakeLeft -= awakeBeforeMicroNap;
      projectedRemainingDaySleepMinutes += input.plan.microNapMinutes;
    }
  }

  const predictedBedtimeAt = maxDate(addMinutes(cursor, awakeLeft), earlyBedtimeAt);

  return {
    nextSleepAt: nextSleepAt ?? predictedBedtimeAt,
    nextSleepKind,
    predictedBedtimeAt,
    projectedRemainingDaySleepMinutes,
  };
}

function getTimelineSessionEnd(session: SleepSession, now: Date, dayEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return minDate(now, dayEnd);
}

function formatSummaryDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatNapCount(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? 'сон'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'сна'
        : 'снов';

  return `${value} ${suffix}`;
}

function getPlanBedtimeRange(dayStart: Date, plan: SleepPlanPreset) {
  const bedtimeRange = calculatePlanBedtimeRange(plan);
  const startAt = dateAtSleepDayMinutes(dayStart, bedtimeRange.startMinutes);
  let endAt = dateAtSleepDayMinutes(dayStart, bedtimeRange.endMinutes);

  if (endAt.getTime() < startAt.getTime()) {
    endAt = addMinutes(endAt, DAY_MINUTES);
  }

  return { endAt, startAt };
}

function getDeltaOutsideRange(date: Date, rangeStart: Date, rangeEnd: Date): number {
  if (date.getTime() < rangeStart.getTime()) {
    return -minutesBetween(date, rangeStart);
  }

  if (date.getTime() > rangeEnd.getTime()) {
    return minutesBetween(rangeEnd, date);
  }

  return 0;
}

function getClosingNightSegment(segments: SleepTimelineSegment[], dayStart: Date, dayEnd: Date) {
  return [...segments]
    .reverse()
    .find(
      (segment) =>
        segment.kind === 'night' &&
        segment.actualStartedAt.getTime() >= dayStart.getTime() &&
        segment.actualStartedAt.getTime() < dayEnd.getTime(),
    );
}

function buildSummaryFeedback(input: {
  sleepSessionCount: number;
  targetAwakeDeltaMinutes: number;
  targetDaySleepDeltaMinutes: number;
  napCountDelta: number;
  targetBedtimeDeltaMinutes: number | null;
}): string[] {
  if (input.sleepSessionCount === 0) {
    return ['Итоги появятся после первой записи сна.'];
  }

  const feedbackLines: string[] = [];

  if (Math.abs(input.targetAwakeDeltaMinutes) > SUMMARY_TOLERANCE_MINUTES) {
    feedbackLines.push(
      `Бодрствования на ${formatSummaryDuration(
        Math.abs(input.targetAwakeDeltaMinutes),
      )} ${input.targetAwakeDeltaMinutes > 0 ? 'больше цели' : 'меньше цели'}`,
    );
  }

  if (Math.abs(input.targetDaySleepDeltaMinutes) > SUMMARY_TOLERANCE_MINUTES) {
    feedbackLines.push(
      `Дневного сна на ${formatSummaryDuration(
        Math.abs(input.targetDaySleepDeltaMinutes),
      )} ${input.targetDaySleepDeltaMinutes > 0 ? 'больше цели' : 'меньше цели'}`,
    );
  }

  if (input.napCountDelta !== 0) {
    feedbackLines.push(
      `Дневных снов на ${formatNapCount(Math.abs(input.napCountDelta))} ${
        input.napCountDelta > 0 ? 'больше плана' : 'меньше плана'
      }`,
    );
  }

  if (
    input.targetBedtimeDeltaMinutes !== null &&
    Math.abs(input.targetBedtimeDeltaMinutes) > SUMMARY_TOLERANCE_MINUTES
  ) {
    feedbackLines.push(
      `Отбой на ${formatSummaryDuration(Math.abs(input.targetBedtimeDeltaMinutes))} ${
        input.targetBedtimeDeltaMinutes > 0 ? 'позже плана' : 'раньше плана'
      }`,
    );
  }

  return feedbackLines.length > 0
    ? feedbackLines.slice(0, MAX_SUMMARY_FEEDBACK_LINES)
    : ['Основные показатели близко к плану'];
}

function getSummaryVerdict(input: {
  sleepSessionCount: number;
  targetAwakeDeltaMinutes: number;
  targetDaySleepDeltaMinutes: number;
  napCountDelta: number;
  targetBedtimeDeltaMinutes: number | null;
}): string {
  if (input.sleepSessionCount === 0) {
    return 'Нет записей сна';
  }

  if (input.targetAwakeDeltaMinutes > SUMMARY_TOLERANCE_MINUTES) {
    return 'Бодрствования больше цели';
  }

  if (input.targetAwakeDeltaMinutes < -SUMMARY_TOLERANCE_MINUTES) {
    return 'Бодрствования меньше цели';
  }

  if (input.targetDaySleepDeltaMinutes < -SUMMARY_TOLERANCE_MINUTES) {
    return 'Дневного сна меньше цели';
  }

  if (input.targetDaySleepDeltaMinutes > SUMMARY_TOLERANCE_MINUTES) {
    return 'Дневного сна больше цели';
  }

  if (
    input.targetBedtimeDeltaMinutes !== null &&
    input.targetBedtimeDeltaMinutes > SUMMARY_TOLERANCE_MINUTES
  ) {
    return 'Отбой позже плана';
  }

  if (
    input.targetBedtimeDeltaMinutes !== null &&
    input.targetBedtimeDeltaMinutes < -SUMMARY_TOLERANCE_MINUTES
  ) {
    return 'Отбой раньше плана';
  }

  if (input.napCountDelta < 0) {
    return 'Снов меньше плана';
  }

  if (input.napCountDelta > 0) {
    return 'Снов больше плана';
  }

  return 'День близко к плану';
}

export function buildSleepTimelineSegments(
  sessions: SleepSession[],
  dayStart: Date,
  dayEnd: Date,
  now: Date,
  plan: SleepPlanPreset,
): SleepTimelineSegment[] {
  return sessions
    .map((session) => {
      const actualStartedAt = new Date(session.startedAt);
      const actualEndedAt = session.endedAt ? new Date(session.endedAt) : null;
      const effectiveEndedAt = getTimelineSessionEnd(session, now, dayEnd);
      const visibleStartedAt = maxDate(actualStartedAt, dayStart);
      const visibleEndedAt = minDate(effectiveEndedAt, dayEnd);

      if (visibleEndedAt.getTime() <= visibleStartedAt.getTime()) {
        return null;
      }

      return {
        id: session.id,
        kind: getSessionKindForCalculations(session, effectiveEndedAt, plan),
        startOffsetMinutes: minutesBetween(dayStart, visibleStartedAt),
        durationMinutes: minutesBetween(visibleStartedAt, visibleEndedAt),
        actualStartedAt,
        actualEndedAt,
        isClippedStart: actualStartedAt.getTime() < dayStart.getTime(),
        isClippedEnd: effectiveEndedAt.getTime() > dayEnd.getTime(),
      };
    })
    .filter((segment): segment is SleepTimelineSegment => segment !== null)
    .sort((first, second) => first.startOffsetMinutes - second.startOffsetMinutes);
}

export function buildSleepDaySummary(
  sessions: SleepSession[],
  referenceDate: Date,
  now: Date,
  plan: SleepPlanPreset,
): SleepDaySummary {
  const dayStart = getDayStart(referenceDate, plan);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const segments = buildSleepTimelineSegments(sessions, dayStart, dayEnd, now, plan);
  const totalDaySleepMinutes = segments.reduce(
    (total, segment) => (segment.kind === 'nap' ? total + segment.durationMinutes : total),
    0,
  );
  const totalNightSleepMinutes = segments.reduce(
    (total, segment) => (segment.kind === 'night' ? total + segment.durationMinutes : total),
    0,
  );
  const elapsedEnd = minDate(maxDate(now, dayStart), dayEnd);
  const elapsedMinutes = minutesBetween(dayStart, elapsedEnd);
  const elapsedSleepMinutes = segments.reduce((total, segment) => {
    const segmentStart = addMinutes(dayStart, segment.startOffsetMinutes);
    const segmentEnd = addMinutes(segmentStart, segment.durationMinutes);
    const countedEnd = minDate(segmentEnd, elapsedEnd);

    if (countedEnd.getTime() <= segmentStart.getTime()) {
      return total;
    }

    return total + minutesBetween(segmentStart, countedEnd);
  }, 0);
  const totalAwakeMinutes = Math.max(0, elapsedMinutes - elapsedSleepMinutes);
  const completedNaps = segments.filter(
    (segment) => segment.kind === 'nap' && segment.actualEndedAt !== null,
  ).length;
  const targetAwakeDeltaMinutes = totalAwakeMinutes - plan.targetAwakeMinutes;
  const targetDaySleepDeltaMinutes = totalDaySleepMinutes - plan.targetDaySleepMinutes;
  const napCountDelta = completedNaps - plan.napCount;
  const closingNightSegment = getClosingNightSegment(segments, dayStart, dayEnd);
  const bedtimeAt = closingNightSegment?.actualStartedAt ?? null;
  const wakeUpAt = closingNightSegment?.actualEndedAt ?? null;
  const planBedtimeRange = getPlanBedtimeRange(dayStart, plan);
  const targetBedtimeDeltaMinutes = bedtimeAt
    ? getDeltaOutsideRange(bedtimeAt, planBedtimeRange.startAt, planBedtimeRange.endAt)
    : null;
  const verdictLabel = getSummaryVerdict({
    napCountDelta,
    sleepSessionCount: segments.length,
    targetAwakeDeltaMinutes,
    targetBedtimeDeltaMinutes,
    targetDaySleepDeltaMinutes,
  });
  const feedbackLines = buildSummaryFeedback({
    napCountDelta,
    sleepSessionCount: segments.length,
    targetAwakeDeltaMinutes,
    targetBedtimeDeltaMinutes,
    targetDaySleepDeltaMinutes,
  });
  const awakeDeltaMinutes = Math.abs(targetAwakeDeltaMinutes);

  return {
    totalDaySleepMinutes,
    totalNightSleepMinutes,
    totalAwakeMinutes,
    sleepSessionCount: segments.length,
    completedNaps,
    targetAwakeDeltaMinutes,
    targetDaySleepDeltaMinutes,
    napCountDelta,
    targetBedtimeDeltaMinutes,
    bedtimeAt,
    wakeUpAt,
    verdictLabel,
    feedbackLines,
    onTrackLabel:
      awakeDeltaMinutes <= 30 ? 'День близко к плану' : 'День уходит от плана',
  };
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
  const completedNaps = completedSessions.filter((session) => {
    if (!session.endedAt) {
      return false;
    }

    return getSessionKindForCalculations(session, new Date(session.endedAt), plan) === 'nap';
  }).length;
  const lastCompletedSession = completedSessions[completedSessions.length - 1];
  const statusStartedAt = activeSession
    ? new Date(activeSession.startedAt)
    : lastCompletedSession?.endedAt
      ? new Date(lastCompletedSession.endedAt)
      : dayStart;

  const totalDaySleepMinutes = todaySessions.reduce(
    (total, session) => {
      const effectiveEndedAt = session.endedAt ? new Date(session.endedAt) : now;
      const kind = getSessionKindForCalculations(session, effectiveEndedAt, plan);

      return kind === 'nap' ? total + getSessionOverlapMinutes(session, dayStart, now) : total;
    },
    0,
  );
  const elapsedDayMinutes = minutesBetween(dayStart, now);
  const totalSleepMinutes = todaySessions.reduce(
    (total, session) => total + getSessionOverlapMinutes(session, dayStart, now),
    0,
  );
  const totalAwakeMinutes = Math.max(0, elapsedDayMinutes - totalSleepMinutes);
  const remainingAwakeMinutes = Math.max(0, plan.targetAwakeMinutes - totalAwakeMinutes);
  const wakeWindow = getWakeWindowForNextNap(completedNaps, plan);
  const state = activeSession ? 'sleeping' : 'awake';
  const activeSessionKind = activeSession
    ? getSessionKindForCalculations(activeSession, now, plan)
    : null;
  const currentDurationMinutes = minutesBetween(statusStartedAt, now);
  const bedtimeProjection = buildBedtimeProjection({
    activeSession,
    activeSessionKind,
    completedNaps,
    dayStart,
    now,
    plan,
    remainingAwakeMinutes,
    state,
    statusStartedAt,
    totalDaySleepMinutes,
  });
  const nextSleepAt = state === 'sleeping' ? now : bedtimeProjection.nextSleepAt;
  const nextSleepKind =
    state === 'sleeping' ? (activeSessionKind ?? 'nap') : bedtimeProjection.nextSleepKind;
  const onTrackLabel =
    currentDurationMinutes > wakeWindow.maxWakeMinutes || remainingAwakeMinutes === 0
      ? 'День уходит от плана'
      : 'День близко к плану';

  return {
    state,
    statusStartedAt,
    currentDurationMinutes,
    nextSleepAt,
    nextSleepKind,
    predictedBedtimeAt: bedtimeProjection.predictedBedtimeAt,
    projectedRemainingDaySleepMinutes: bedtimeProjection.projectedRemainingDaySleepMinutes,
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
