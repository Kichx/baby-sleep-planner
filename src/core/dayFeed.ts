import type { BottleFeeding } from '@/types/bottleFeeding';
import type { ISODateString, SleepSession } from '@/types/sleep';

export type DayFeedItem =
  | {
      id: string;
      session: SleepSession;
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

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

export function getSleepDayFeedSortAt(session: SleepSession, rangeStart: Date): Date {
  return maxDate(new Date(session.startedAt), rangeStart);
}

export function buildSleepDayFeedItem(
  session: SleepSession,
  rangeStart: Date,
): DayFeedItem {
  return {
    id: session.id,
    session,
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
