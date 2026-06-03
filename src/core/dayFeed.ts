import type { BottleFeeding } from '@/types/bottleFeeding';
import type { ISODateString, SleepSession } from '@/types/sleep';

export type DayFeedItem =
  | {
      id: string;
      session: SleepSession;
      sleepFeedings: BottleFeeding[];
      sortAt: ISODateString;
      startedAt: ISODateString;
      type: 'sleep';
    }
  | {
      feeding: BottleFeeding;
      id: string;
      sortAt: ISODateString;
      startedAt: ISODateString;
      type: 'bottleFeeding';
    };

interface BuildDayFeedItemsInput {
  feedings: BottleFeeding[];
  now: Date;
  rangeEnd: Date;
  rangeStart: Date;
  sessions: SleepSession[];
  standaloneFeedings?: BottleFeeding[];
}

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

export function getSleepDayFeedSortAt(session: SleepSession, rangeStart: Date): Date {
  return maxDate(new Date(session.startedAt), rangeStart);
}

export function buildSleepDayFeedItem(
  session: SleepSession,
  rangeStart: Date,
  sleepFeedings: BottleFeeding[] = [],
): DayFeedItem {
  return {
    id: session.id,
    session,
    sleepFeedings,
    sortAt: getSleepDayFeedSortAt(session, rangeStart).toISOString(),
    startedAt: session.startedAt,
    type: 'sleep',
  };
}

export function buildBottleFeedingDayFeedItem(feeding: BottleFeeding): DayFeedItem {
  return {
    feeding,
    id: feeding.id,
    sortAt: feeding.startedAt,
    startedAt: feeding.startedAt,
    type: 'bottleFeeding',
  };
}

function getVisibleSleepEnd(session: SleepSession, now: Date, rangeEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return new Date(Math.min(now.getTime(), rangeEnd.getTime()));
}

export function isBottleFeedingInsideSleep(
  feeding: BottleFeeding,
  session: SleepSession,
  now: Date,
  rangeEnd: Date,
): boolean {
  const feedingStartedAt = new Date(feeding.startedAt).getTime();
  const sleepStartedAt = new Date(session.startedAt).getTime();
  const sleepEndedAt = getVisibleSleepEnd(session, now, rangeEnd).getTime();

  return feedingStartedAt >= sleepStartedAt && feedingStartedAt < sleepEndedAt;
}

function sortBottleFeedingsOldestFirst(feedings: BottleFeeding[]): BottleFeeding[] {
  return [...feedings].sort(
    (first, second) =>
      new Date(first.startedAt).getTime() - new Date(second.startedAt).getTime(),
  );
}

export function buildDayFeedItems({
  feedings,
  now,
  rangeEnd,
  rangeStart,
  sessions,
  standaloneFeedings = feedings,
}: BuildDayFeedItemsInput): DayFeedItem[] {
  const unassignedFeedings = new Map(
    standaloneFeedings.map((feeding) => [feeding.id, feeding]),
  );

  const sleepItems = sessions.map((session) => {
    const sleepFeedings = sortBottleFeedingsOldestFirst(
      feedings.filter((feeding) => isBottleFeedingInsideSleep(feeding, session, now, rangeEnd)),
    );

    sleepFeedings.forEach((feeding) => {
      unassignedFeedings.delete(feeding.id);
    });

    return buildSleepDayFeedItem(session, rangeStart, sleepFeedings);
  });
  const standaloneFeedingItems = Array.from(unassignedFeedings.values()).map(
    buildBottleFeedingDayFeedItem,
  );

  return sortDayFeedItemsNewestFirst([...sleepItems, ...standaloneFeedingItems]);
}

export function countDayFeedRecords(items: DayFeedItem[]): number {
  return items.reduce(
    (total, item) => total + 1 + (item.type === 'sleep' ? item.sleepFeedings.length : 0),
    0,
  );
}

export function sortDayFeedItemsNewestFirst(items: DayFeedItem[]): DayFeedItem[] {
  return [...items].sort((first, second) => {
    const timeDelta = new Date(second.sortAt).getTime() - new Date(first.sortAt).getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    if (first.type !== second.type) {
      return first.type === 'sleep' ? -1 : 1;
    }

    const actualStartDelta =
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime();

    if (actualStartDelta !== 0) {
      return actualStartDelta;
    }

    return first.id.localeCompare(second.id);
  });
}
