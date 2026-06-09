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

export function formatNextSleepAtText(input: {
  now: Date;
  nextSleepAt: Date;
}): string | null {
  if (!isValidDate(input.now) || !isValidDate(input.nextSleepAt)) {
    return null;
  }

  if (input.nextSleepAt.getTime() <= input.now.getTime()) {
    return 'Следующий сон уже можно начинать';
  }

  const minutesUntil = Math.max(
    1,
    Math.round((input.nextSleepAt.getTime() - input.now.getTime()) / MS_PER_MINUTE),
  );
  const duration = formatRelativeDurationLong(minutesUntil);

  if (!duration) {
    return null;
  }

  return `Следующий сон в ${formatLocalClock(input.nextSleepAt)} (через ${duration})`;
}
