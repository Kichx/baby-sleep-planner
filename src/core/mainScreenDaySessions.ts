import type { SleepSession } from '@/types/sleep';

interface SleepSessionDayOverlapOptions {
  includeNightEndingAtStart?: boolean;
}

function getVisibleSessionEnd(session: SleepSession, now: Date, dayEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return new Date(Math.min(now.getTime(), dayEnd.getTime()));
}

export function sleepSessionOverlapsDisplayedDay(
  session: SleepSession,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
  options: SleepSessionDayOverlapOptions = {},
): boolean {
  const startedAt = new Date(session.startedAt);
  const endedAt = getVisibleSessionEnd(session, now, dayEnd);
  const endsAtDayStart =
    options.includeNightEndingAtStart === true &&
    session.kind === 'night' &&
    session.endedAt !== null &&
    endedAt.getTime() === dayStart.getTime();

  return (
    (startedAt.getTime() < dayEnd.getTime() && endedAt.getTime() > dayStart.getTime()) ||
    endsAtDayStart
  );
}

export function filterSleepSessionsForDisplayedDay(
  sessions: SleepSession[],
  dayStart: Date,
  dayEnd: Date,
  now: Date,
  options: SleepSessionDayOverlapOptions = {},
): SleepSession[] {
  return sessions.filter((session) =>
    sleepSessionOverlapsDisplayedDay(session, dayStart, dayEnd, now, options),
  );
}
