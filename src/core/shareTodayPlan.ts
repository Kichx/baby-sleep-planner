import {
  addMinutes,
  buildSleepDaySummary,
  buildTodaySleepSnapshot,
  getDayStart,
  getSessionKindForCalculations,
  minutesBetween,
} from '@/core/sleepCalculations';
import type { SleepKind, SleepPlanPreset, SleepSession } from '@/types/sleep';

interface TodayPlanShareInput {
  childName: string;
  generatedAt: Date;
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

const DAY_MINUTES = 24 * 60;
const MAX_SHARED_SCENARIOS = 2;

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
    2,
    '0',
  )}`;
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

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return startOfCalendarDay(first).getTime() === startOfCalendarDay(second).getTime();
}

function getCalendarDayDiff(first: Date, second: Date): number {
  const firstStart = startOfCalendarDay(first).getTime();
  const secondStart = startOfCalendarDay(second).getTime();

  return Math.round((firstStart - secondStart) / (DAY_MINUTES * 60_000));
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

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatClockWithDay(date: Date, referenceDate: Date): string {
  return `${formatClock(date)} ${formatRelativeDay(date, referenceDate)}`;
}

function formatSessionRange(startedAt: Date, endedAt: Date | null, referenceDate: Date): string {
  if (!endedAt) {
    return `с ${formatClockWithDay(startedAt, referenceDate)}`;
  }

  if (isSameCalendarDay(startedAt, endedAt)) {
    return `${formatClock(startedAt)}-${formatClock(endedAt)}`;
  }

  return `${formatClockWithDay(startedAt, referenceDate)} - ${formatClockWithDay(
    endedAt,
    referenceDate,
  )}`;
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
  return sessions
    .filter((session) => sessionOverlapsRange(session, dayStart, dayEnd, now))
    .sort(
      (first, second) =>
        new Date(first.startedAt).getTime() - new Date(second.startedAt).getTime(),
    )
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

function formatShareSessionRows(rows: ShareSessionRow[]): string[] {
  if (rows.length === 0) {
    return ['• записей сна пока нет'];
  }

  let napNumber = 0;

  return rows.map((row) => {
    let title = 'Ночной сон';

    if (row.kind === 'nap') {
      napNumber += 1;
      title = `Сон ${napNumber}`;
    }

    const durationPrefix = row.isActive ? 'идёт ' : '';

    return `• ${title} | ${row.rangeLabel} | ${durationPrefix}${formatDuration(
      row.durationMinutes,
    )}`;
  });
}

function formatWaitLabel(now: Date, targetAt: Date): string {
  const waitMinutes = minutesBetween(now, targetAt);

  if (waitMinutes === 0) {
    return 'сейчас';
  }

  return `через ${formatDuration(waitMinutes)}`;
}

export function buildTodayPlanShareText(input: TodayPlanShareInput): string {
  const childName = input.childName.trim() || 'ребёнок';
  const planName = input.planName.trim() || 'Основной';
  const dayStart = getDayStart(input.generatedAt, input.plan);
  const dayEnd = addMinutes(dayStart, DAY_MINUTES);
  const snapshot = buildTodaySleepSnapshot(input.sessions, input.generatedAt, input.plan);
  const summary = buildSleepDaySummary(
    input.sessions,
    input.generatedAt,
    input.generatedAt,
    input.plan,
  );
  const sessionRows = buildShareSessionRows(
    input.sessions,
    input.generatedAt,
    dayStart,
    dayEnd,
    input.plan,
  );
  const currentStateLabel = snapshot.state === 'sleeping' ? 'Спит' : 'Бодрствует';
  const nextSleepLabel = snapshot.nextSleepKind === 'night' ? 'Отбой' : 'Следующий сон';
  const nextSleepLine =
    snapshot.state === 'sleeping'
      ? '• Сейчас идёт сон, после пробуждения план пересчитается'
      : `• ${nextSleepLabel}: ${formatClock(snapshot.nextSleepAt)} (${formatWaitLabel(
          input.generatedAt,
          snapshot.nextSleepAt,
        )})`;
  const projectedDaySleepLine =
    snapshot.projectedRemainingDaySleepMinutes > 0
      ? `• Дневного сна впереди по плану: ${formatDuration(
          snapshot.projectedRemainingDaySleepMinutes,
        )}`
      : '• Дневной сон на сегодня больше не планируется';
  const scenarioLines = snapshot.scenarios
    .slice(0, MAX_SHARED_SCENARIOS)
    .map((scenario) => `• ${scenario.title}: ${scenario.detail}`);

  return [
    `План сна на сегодня: ${childName}`,
    `Обновлено: ${formatClock(input.generatedAt)}. План: ${planName}`,
    '',
    `Сейчас: ${currentStateLabel} ${formatDuration(
      snapshot.currentDurationMinutes,
    )} с ${formatClockWithDay(snapshot.statusStartedAt, input.generatedAt)}`,
    '',
    'Уже было:',
    ...formatShareSessionRows(sessionRows),
    '',
    'Дальше:',
    nextSleepLine,
    `• Прогноз отбоя: ${formatClock(snapshot.predictedBedtimeAt)}`,
    projectedDaySleepLine,
    '',
    'Итоги дня:',
    `• Бодрствование: ${formatDuration(snapshot.totalAwakeMinutes)} из цели ${formatDuration(
      input.plan.targetAwakeMinutes,
    )}; осталось ${formatDuration(snapshot.remainingAwakeMinutes)}`,
    `• Дневной сон: ${formatDuration(snapshot.totalDaySleepMinutes)} из цели ${formatDuration(
      input.plan.targetDaySleepMinutes,
    )}`,
    `• Сны: ${snapshot.completedNaps}/${input.plan.napCount}`,
    `• ${summary.onTrackLabel}`,
    '',
    'Сценарии:',
    ...scenarioLines,
  ].join('\n');
}
