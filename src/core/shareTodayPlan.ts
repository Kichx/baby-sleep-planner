import {
  addMinutes,
  buildTodaySleepSnapshot,
  getDayStart,
  getSessionKindForCalculations,
  minutesBetween,
} from '@/core/sleepCalculations';
import {
  formatLocalClock,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
  isSameLocalCalendarDay,
} from '@/core/localDateTime';
import {
  calculateBottleFeedingStats,
  filterBottleFeedingsInCalendarDay,
  formatBottleFeedingElapsed,
  formatBottleFeedingStatsLine,
  formatTodayBottleFeedingStatsWithTopUpsLine,
} from '@/core/bottleFeeding';
import type { BottleFeeding } from '@/types/bottleFeeding';
import type { SleepKind, SleepPlanPreset, SleepSession } from '@/types/sleep';

interface TodayPlanShareInput {
  bottleFeedingTopUpThresholdMl?: number;
  bottleFeedings?: BottleFeeding[];
  childName: string;
  generatedAt: Date;
  latestBottleFeeding?: BottleFeeding | null;
  plan: SleepPlanPreset;
  planName: string;
  sessions: SleepSession[];
}

interface ShareSessionRow {
  kind: SleepKind;
  rangeLabel: string;
  durationMinutes: number;
  isActive: boolean;
}

interface FutureSleepRow {
  kind: SleepKind;
  startAt: Date;
  endAt: Date | null;
  isCurrent: boolean;
}

const DAY_MINUTES = 24 * 60;
const MAX_PROJECTION_STEPS = 8;
const PROJECTION_CHILD_ID = 'share-projection';

function formatClock(date: Date): string {
  return formatLocalClock(date);
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatCount(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;

  return `${value} ${suffix}`;
}

function formatNapProgress(completedNaps: number, targetNaps: number): string {
  return `${completedNaps} из ${formatCount(targetNaps, 'сна', 'снов', 'снов')}`;
}

function getCalendarDayDiff(first: Date, second: Date): number {
  return getLocalCalendarDayDiff(first, second);
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return isSameLocalCalendarDay(first, second);
}

function formatRelativeDay(date: Date, referenceDate: Date): string {
  const dayDiff = getCalendarDayDiff(date, referenceDate);

  if (dayDiff === -1) {
    return 'вчера';
  }

  if (dayDiff === 0) {
    return 'сегодня';
  }

  if (dayDiff === 1) {
    return 'завтра';
  }

  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'short',
  });
}

function formatClockWithDay(date: Date, referenceDate: Date): string {
  return `${formatClock(date)} ${formatRelativeDay(date, referenceDate)}`;
}

function formatTodayClock(date: Date, referenceDate: Date): string {
  return getCalendarDayDiff(date, referenceDate) === 0
    ? formatClock(date)
    : formatClockWithDay(date, referenceDate);
}

function formatClockRange(startedAt: Date, endedAt: Date, referenceDate: Date): string {
  if (isSameCalendarDay(startedAt, endedAt)) {
    return `${formatTodayClock(startedAt, referenceDate)}-${formatClock(endedAt)}`;
  }

  return `${formatClockWithDay(startedAt, referenceDate)} - ${formatClockWithDay(
    endedAt,
    referenceDate,
  )}`;
}

function formatSessionRange(startedAt: Date, endedAt: Date | null, referenceDate: Date): string {
  if (!endedAt) {
    return `с ${formatTodayClock(startedAt, referenceDate)}`;
  }

  return formatClockRange(startedAt, endedAt, referenceDate);
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

function sortSessionsByStart(sessions: SleepSession[]): SleepSession[] {
  return [...sessions].sort(
    (first, second) =>
      new Date(first.startedAt).getTime() - new Date(second.startedAt).getTime(),
  );
}

function getVisibleSessionEnd(session: SleepSession, now: Date, dayEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return new Date(Math.min(now.getTime(), dayEnd.getTime()));
}

function sessionOverlapsRange(
  session: SleepSession,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date,
): boolean {
  const startedAt = new Date(session.startedAt);
  const endedAt = getVisibleSessionEnd(session, now, rangeEnd);

  return startedAt.getTime() < rangeEnd.getTime() && endedAt.getTime() > rangeStart.getTime();
}

function buildShareSessionRows(
  sessions: SleepSession[],
  now: Date,
  dayStart: Date,
  dayEnd: Date,
  plan: SleepPlanPreset,
): ShareSessionRow[] {
  return sortSessionsByStart(sessions)
    .filter((session) => sessionOverlapsRange(session, dayStart, dayEnd, now))
    .map((session) => {
      const startedAt = new Date(session.startedAt);
      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
      const effectiveEndedAt = getVisibleSessionEnd(session, now, dayEnd);

      return {
        durationMinutes: minutesBetween(startedAt, endedAt ?? now),
        isActive: endedAt === null,
        kind: getSessionKindForCalculations(session, effectiveEndedAt, plan),
        rangeLabel: formatSessionRange(startedAt, endedAt, now),
      };
    });
}

function formatNapRows(rows: ShareSessionRow[]): string[] {
  const napRows = rows.filter((row) => row.kind === 'nap');

  if (napRows.length === 0) {
    return ['• Дневных снов пока не было'];
  }

  return napRows.map((row, index) => {
    const durationLabel = row.isActive
      ? `идёт ${formatDuration(row.durationMinutes)}`
      : formatDuration(row.durationMinutes);

    return `• ${index + 1}-й сон: ${row.rangeLabel}, ${durationLabel}`;
  });
}

function hasValidTopUpThreshold(threshold: number | undefined): threshold is number {
  return typeof threshold === 'number' && Number.isInteger(threshold) && threshold > 0;
}

function formatTodayBottleFeedingSummary(
  feedings: BottleFeeding[],
  topUpThresholdMl: number | undefined,
): string {
  if (hasValidTopUpThreshold(topUpThresholdMl)) {
    return formatTodayBottleFeedingStatsWithTopUpsLine(feedings, topUpThresholdMl);
  }

  const stats = calculateBottleFeedingStats(feedings);

  if (stats.count === 0) {
    return 'Сегодня: пока нет записей';
  }

  return `Сегодня: ${formatBottleFeedingStatsLine(stats)}`;
}

function formatLatestBottleFeedingShareLine(
  feeding: BottleFeeding | null | undefined,
  referenceDate: Date,
): string {
  if (!feeding) {
    return '• Последнее кормление: записей пока нет';
  }

  const startedAt = new Date(feeding.startedAt);
  const elapsedLabel = formatBottleFeedingElapsed(startedAt, referenceDate);
  const clockLabel = formatTodayClock(startedAt, referenceDate);

  return `• Последнее кормление: ${elapsedLabel}, ${feeding.volumeMl} мл в ${clockLabel}`;
}

function buildBottleFeedingShareSection(input: TodayPlanShareInput): string[] {
  if (!input.bottleFeedings) {
    return [];
  }

  const todayFeedings = filterBottleFeedingsInCalendarDay(
    input.bottleFeedings,
    input.generatedAt,
  );

  return [
    '',
    'Кормления сегодня:',
    `• ${formatTodayBottleFeedingSummary(todayFeedings, input.bottleFeedingTopUpThresholdMl)}`,
    formatLatestBottleFeedingShareLine(input.latestBottleFeeding, input.generatedAt),
  ];
}

function getTargetNapMinutes(plan: SleepPlanPreset): number {
  return Math.max(0, Math.round(plan.targetDaySleepMinutes / Math.max(1, plan.napCount)));
}

function dateAtSleepDayMinutes(
  dayStart: Date,
  minutesFromMidnight: number,
  plan: SleepPlanPreset,
): Date {
  const offsetMinutes = minutesFromMidnight - plan.dayStartMinutes;

  return addMinutes(dayStart, offsetMinutes >= 0 ? offsetMinutes : offsetMinutes + DAY_MINUTES);
}

function getProjectedActiveNapEnd(
  session: SleepSession,
  now: Date,
  dayStart: Date,
  dayEnd: Date,
  plan: SleepPlanPreset,
): Date {
  const startedAt = new Date(session.startedAt);
  const targetEndAt = addMinutes(startedAt, getTargetNapMinutes(plan));
  const latestNapEndAt = dateAtSleepDayMinutes(dayStart, plan.latestEveningNapEndMinutes, plan);
  const plannedEndAt = maxDate(targetEndAt, now);
  const latestAllowedEndAt = minDate(dayEnd, latestNapEndAt);

  return plannedEndAt.getTime() <= latestAllowedEndAt.getTime() ? plannedEndAt : now;
}

function getProjectedNapDuration(snapshotRemainingSleepMinutes: number, plan: SleepPlanPreset) {
  return Math.min(getTargetNapMinutes(plan), Math.max(0, snapshotRemainingSleepMinutes));
}

function isProjectedMicroNap(
  snapshot: ReturnType<typeof buildTodaySleepSnapshot>,
  napDurationMinutes: number,
  plan: SleepPlanPreset,
): boolean {
  return (
    plan.microNapMinutes > 0 &&
    napDurationMinutes === plan.microNapMinutes &&
    snapshot.scenarios.some((scenario) => scenario.id === 'microNap')
  );
}

function closeActiveSession(
  sessions: SleepSession[],
  activeSessionId: string,
  endedAt: Date,
): SleepSession[] {
  return sessions.map((session) =>
    session.id === activeSessionId ? { ...session, endedAt: endedAt.toISOString() } : session,
  );
}

function appendProjectedNap(
  sessions: SleepSession[],
  index: number,
  startedAt: Date,
  endedAt: Date,
): SleepSession[] {
  return sortSessionsByStart([
    ...sessions,
    {
      childId: PROJECTION_CHILD_ID,
      endedAt: endedAt.toISOString(),
      id: `projected-nap-${index}`,
      kind: 'nap',
      startedAt: startedAt.toISOString(),
    },
  ]);
}

function buildFutureSleepRows(
  sessions: SleepSession[],
  now: Date,
  dayStart: Date,
  dayEnd: Date,
  plan: SleepPlanPreset,
): FutureSleepRow[] {
  const rows: FutureSleepRow[] = [];
  let simulatedSessions = sortSessionsByStart(sessions);
  let cursor = now;
  const activeSession = simulatedSessions.find((session) => session.endedAt === null);

  if (activeSession) {
    const activeKind = getSessionKindForCalculations(activeSession, now, plan);

    if (activeKind === 'night') {
      return [
        {
          endAt: null,
          isCurrent: true,
          kind: 'night',
          startAt: new Date(activeSession.startedAt),
        },
      ];
    }

    const projectedEndAt = getProjectedActiveNapEnd(activeSession, now, dayStart, dayEnd, plan);

    rows.push({
      endAt: projectedEndAt,
      isCurrent: true,
      kind: 'nap',
      startAt: new Date(activeSession.startedAt),
    });

    simulatedSessions = closeActiveSession(simulatedSessions, activeSession.id, projectedEndAt);
    cursor = projectedEndAt;
  }

  for (let index = 0; index < MAX_PROJECTION_STEPS; index += 1) {
    const snapshot = buildTodaySleepSnapshot(simulatedSessions, cursor, plan);

    if (snapshot.state === 'sleeping') {
      break;
    }

    if (snapshot.nextSleepKind === 'night') {
      rows.push({
        endAt: null,
        isCurrent: false,
        kind: 'night',
        startAt: snapshot.nextSleepAt,
      });
      break;
    }

    if (snapshot.nextSleepAt.getTime() >= dayEnd.getTime()) {
      break;
    }

    const napDurationMinutes = getProjectedNapDuration(
      snapshot.projectedRemainingDaySleepMinutes,
      plan,
    );

    if (napDurationMinutes <= 0) {
      rows.push({
        endAt: null,
        isCurrent: false,
        kind: 'night',
        startAt: snapshot.predictedBedtimeAt,
      });
      break;
    }

    const napStartAt = snapshot.nextSleepAt;
    const napEndAt = minDate(addMinutes(napStartAt, napDurationMinutes), dayEnd);

    if (napEndAt.getTime() <= napStartAt.getTime()) {
      break;
    }

    rows.push({
      endAt: napEndAt,
      isCurrent: false,
      kind: 'nap',
      startAt: napStartAt,
    });

    if (isProjectedMicroNap(snapshot, napDurationMinutes, plan)) {
      rows.push({
        endAt: null,
        isCurrent: false,
        kind: 'night',
        startAt: snapshot.predictedBedtimeAt,
      });
      break;
    }

    simulatedSessions = appendProjectedNap(simulatedSessions, index, napStartAt, napEndAt);
    cursor = napEndAt;
  }

  return rows;
}

function formatFutureSleepRows(
  rows: FutureSleepRow[],
  existingNapCount: number,
  referenceDate: Date,
): string[] {
  if (rows.length === 0) {
    return ['• До отбоя больше снов не планируем'];
  }

  let napNumber = existingNapCount;

  return rows.map((row) => {
    if (row.kind === 'night') {
      return row.isCurrent
        ? `• Ночной сон уже начался: ${formatTodayClock(row.startAt, referenceDate)}`
        : `• Отбой: ${formatTodayClock(row.startAt, referenceDate)}`;
    }

    if (row.isCurrent) {
      if (row.endAt && row.endAt.getTime() > referenceDate.getTime()) {
        return `• Текущий сон: ориентир до ${formatTodayClock(row.endAt, referenceDate)}`;
      }

      return '• Текущий сон: идёт, после пробуждения лучше обновить план';
    }

    napNumber += 1;

    if (!row.endAt) {
      return `• ${napNumber}-й сон: с ${formatTodayClock(row.startAt, referenceDate)}`;
    }

    return `• ${napNumber}-й сон: ${formatClockRange(row.startAt, row.endAt, referenceDate)}`;
  });
}

function getWakeUpAt(
  sessions: SleepSession[],
  now: Date,
  dayStart: Date,
  dayEnd: Date,
  plan: SleepPlanPreset,
): Date | null {
  const activeNight = sessions.some((session) => {
    if (session.endedAt !== null || !sessionOverlapsRange(session, dayStart, dayEnd, now)) {
      return false;
    }

    return getSessionKindForCalculations(session, now, plan) === 'night';
  });

  if (activeNight) {
    return null;
  }

  const nightWakeUps = sessions
    .filter((session) => session.endedAt !== null)
    .map((session) => {
      const endedAt = new Date(session.endedAt ?? '');

      return {
        endedAt,
        kind: getSessionKindForCalculations(session, endedAt, plan),
      };
    })
    .filter(
      ({ endedAt, kind }) =>
        kind === 'night' &&
        endedAt.getTime() >= dayStart.getTime() &&
        endedAt.getTime() <= dayEnd.getTime(),
    )
    .sort((first, second) => first.endedAt.getTime() - second.endedAt.getTime());

  return nightWakeUps.length > 0 ? nightWakeUps[nightWakeUps.length - 1].endedAt : dayStart;
}

export function buildTodayPlanShareText(input: TodayPlanShareInput): string {
  const childName = input.childName.trim() || 'ребёнок';
  const planName = input.planName.trim() || 'Основной';
  const dayStart = getDayStart(input.generatedAt, input.plan);
  const dayEnd = addMinutes(dayStart, DAY_MINUTES);
  const daySessions = sortSessionsByStart(
    input.sessions.filter((session) =>
      sessionOverlapsRange(session, dayStart, dayEnd, input.generatedAt),
    ),
  );
  const snapshot = buildTodaySleepSnapshot(daySessions, input.generatedAt, input.plan);
  const sessionRows = buildShareSessionRows(
    daySessions,
    input.generatedAt,
    dayStart,
    dayEnd,
    input.plan,
  );
  const futureRows = buildFutureSleepRows(
    daySessions,
    input.generatedAt,
    dayStart,
    dayEnd,
    input.plan,
  );
  const wakeUpAt = getWakeUpAt(daySessions, input.generatedAt, dayStart, dayEnd, input.plan);
  const currentStateLabel = snapshot.state === 'sleeping' ? 'спит' : 'бодрствует';
  const existingNapCount = sessionRows.filter((row) => row.kind === 'nap').length;

  return [
    `Сон на сегодня: ${childName}`,
    `Обновлено в ${formatClock(input.generatedAt)}. Ориентир: ${planName}`,
    '',
    'Коротко по дню:',
    `• Подъём: ${wakeUpAt ? formatTodayClock(wakeUpAt, input.generatedAt) : 'пока не было'}`,
    `• Сейчас ${currentStateLabel} с ${formatTodayClock(
      snapshot.statusStartedAt,
      input.generatedAt,
    )} (${formatDuration(snapshot.currentDurationMinutes)})`,
    `• Дневной сон: ${formatDuration(snapshot.totalDaySleepMinutes)}, ${
      formatNapProgress(snapshot.completedNaps, input.plan.napCount)
    }`,
    '',
    'Сны уже были:',
    ...formatNapRows(sessionRows),
    ...buildBottleFeedingShareSection(input),
    '',
    'Дальше сегодня:',
    ...formatFutureSleepRows(futureRows, existingNapCount, input.generatedAt),
  ].join('\n');
}
