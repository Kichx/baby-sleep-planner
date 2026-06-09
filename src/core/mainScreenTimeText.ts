import { formatLocalClock } from '@/core/localDateTime';

const MS_PER_MINUTE = 60_000;

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
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

export function formatRelativeDurationLong(minutes: number): string | null {
  if (!Number.isFinite(minutes)) {
    return null;
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const restMinutes = roundedMinutes % 60;

  if (hours === 0) {
    return formatCount(restMinutes, 'минуту', 'минуты', 'минут');
  }

  const hoursText = formatCount(hours, 'час', 'часа', 'часов');

  if (restMinutes === 0) {
    return hoursText;
  }

  return `${hoursText} ${formatCount(restMinutes, 'минуту', 'минуты', 'минут')}`;
}

export function formatClockWithRelativeDuration(input: {
  now: Date;
  targetAt: Date;
  pastText?: string;
}): string | null {
  if (!isValidDate(input.now) || !isValidDate(input.targetAt)) {
    return null;
  }

  const clock = formatLocalClock(input.targetAt);
  const millisecondsUntil = input.targetAt.getTime() - input.now.getTime();

  if (millisecondsUntil <= 0) {
    return `${clock} (${input.pastText ?? 'сейчас'})`;
  }

  const minutesUntil = Math.max(1, Math.ceil(millisecondsUntil / MS_PER_MINUTE));
  const duration = formatRelativeDurationLong(minutesUntil);

  return duration ? `${clock} (через ${duration})` : null;
}

export function formatNextSleepAtText(input: {
  now: Date;
  nextSleepAt: Date;
}): string | null {
  if (!isValidDate(input.now) || !isValidDate(input.nextSleepAt)) {
    return null;
  }

  const sleepAtText = formatClockWithRelativeDuration({
    now: input.now,
    pastText: 'уже можно начинать',
    targetAt: input.nextSleepAt,
  });

  return sleepAtText ? `Следующий сон в ${sleepAtText}` : null;
}
