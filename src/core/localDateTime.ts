export interface LocalDateParts {
  day: number;
  month: number;
  year: number;
}

export interface LocalTimeParts {
  hours: number;
  minutes: number;
}

interface LocalDateTimeParts extends LocalDateParts, LocalTimeParts {
  milliseconds: number;
  seconds: number;
}

const PARTS_LOCALE = 'en-US-u-ca-gregory-nu-latn';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getCurrentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(PARTS_LOCALE, {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
}

function readNumberPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;

  return value ? Number(value) : NaN;
}

function getDateFallbackParts(date: Date): LocalDateTimeParts {
  return {
    day: date.getDate(),
    hours: date.getHours(),
    milliseconds: date.getMilliseconds(),
    minutes: date.getMinutes(),
    month: date.getMonth() + 1,
    seconds: date.getSeconds(),
    year: date.getFullYear(),
  };
}

function normalizeWallParts(parts: Partial<LocalDateTimeParts> & LocalDateParts): LocalDateTimeParts {
  const normalized = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours ?? 0,
      parts.minutes ?? 0,
      parts.seconds ?? 0,
      parts.milliseconds ?? 0,
    ),
  );

  return {
    day: normalized.getUTCDate(),
    hours: normalized.getUTCHours(),
    milliseconds: normalized.getUTCMilliseconds(),
    minutes: normalized.getUTCMinutes(),
    month: normalized.getUTCMonth() + 1,
    seconds: normalized.getUTCSeconds(),
    year: normalized.getUTCFullYear(),
  };
}

function getWallTimestamp(parts: LocalDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
    parts.milliseconds,
  );
}

export function getLocalDateTimeParts(
  date: Date,
  timeZone = getCurrentTimeZone(),
): LocalDateTimeParts {
  if (!timeZone) {
    return getDateFallbackParts(date);
  }

  try {
    const parts = getPartsFormatter(timeZone).formatToParts(date);
    const hours = readNumberPart(parts, 'hour');
    const localParts = {
      day: readNumberPart(parts, 'day'),
      hours: hours === 24 ? 0 : hours,
      milliseconds: date.getUTCMilliseconds(),
      minutes: readNumberPart(parts, 'minute'),
      month: readNumberPart(parts, 'month'),
      seconds: readNumberPart(parts, 'second'),
      year: readNumberPart(parts, 'year'),
    };

    return Object.values(localParts).every(Number.isFinite)
      ? localParts
      : getDateFallbackParts(date);
  } catch {
    return getDateFallbackParts(date);
  }
}

export function dateFromLocalDateTime(
  parts: Partial<LocalDateTimeParts> & LocalDateParts,
  timeZone = getCurrentTimeZone(),
): Date {
  if (!timeZone) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours ?? 0,
      parts.minutes ?? 0,
      parts.seconds ?? 0,
      parts.milliseconds ?? 0,
    );
  }

  const targetParts = normalizeWallParts(parts);
  const targetWallTimestamp = getWallTimestamp(targetParts);
  let utcTimestamp = targetWallTimestamp;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentParts = getLocalDateTimeParts(new Date(utcTimestamp), timeZone);
    const currentWallTimestamp = getWallTimestamp(currentParts);
    const delta = targetWallTimestamp - currentWallTimestamp;

    if (delta === 0) {
      return new Date(utcTimestamp);
    }

    utcTimestamp += delta;
  }

  return new Date(utcTimestamp);
}

export function getLocalMinutesFromMidnight(date: Date, timeZone = getCurrentTimeZone()): number {
  const parts = getLocalDateTimeParts(date, timeZone);

  return parts.hours * 60 + parts.minutes;
}

export function formatLocalClock(date: Date, timeZone = getCurrentTimeZone()): string {
  const parts = getLocalDateTimeParts(date, timeZone);

  return `${pad(parts.hours)}:${pad(parts.minutes)}`;
}

export function formatLocalDateInput(date: Date, timeZone = getCurrentTimeZone()): string {
  const parts = getLocalDateTimeParts(date, timeZone);

  return `${pad(parts.day)}.${pad(parts.month)}`;
}

export function formatLocalDateKey(date: Date, timeZone = getCurrentTimeZone()): string {
  const parts = getLocalDateTimeParts(date, timeZone);

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatLocalDateLabel(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale = 'ru-RU',
): string {
  const timeZone = getCurrentTimeZone();

  return new Intl.DateTimeFormat(locale, {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function startOfLocalCalendarDay(date: Date, timeZone = getCurrentTimeZone()): Date {
  const parts = getLocalDateTimeParts(date, timeZone);

  return dateFromLocalDateTime(
    {
      day: parts.day,
      month: parts.month,
      year: parts.year,
    },
    timeZone,
  );
}

export function dateAtLocalNoon(date: Date, timeZone = getCurrentTimeZone()): Date {
  const parts = getLocalDateTimeParts(date, timeZone);

  return dateFromLocalDateTime(
    {
      day: parts.day,
      hours: 12,
      minutes: 0,
      month: parts.month,
      year: parts.year,
    },
    timeZone,
  );
}

export function addLocalCalendarDays(
  date: Date,
  days: number,
  timeZone = getCurrentTimeZone(),
): Date {
  const parts = getLocalDateTimeParts(date, timeZone);
  const utcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  const shifted = new Date(utcNoon + days * MS_PER_DAY);

  return dateFromLocalDateTime(
    {
      day: shifted.getUTCDate(),
      hours: 12,
      minutes: 0,
      month: shifted.getUTCMonth() + 1,
      year: shifted.getUTCFullYear(),
    },
    timeZone,
  );
}

export function isSameLocalCalendarDay(
  first: Date,
  second: Date,
  timeZone = getCurrentTimeZone(),
): boolean {
  return (
    startOfLocalCalendarDay(first, timeZone).getTime() ===
    startOfLocalCalendarDay(second, timeZone).getTime()
  );
}

export function getLocalCalendarDayDiff(
  first: Date,
  second: Date,
  timeZone = getCurrentTimeZone(),
): number {
  const firstStartParts = getLocalDateTimeParts(startOfLocalCalendarDay(first, timeZone), timeZone);
  const secondStartParts = getLocalDateTimeParts(
    startOfLocalCalendarDay(second, timeZone),
    timeZone,
  );
  const firstUtc = Date.UTC(firstStartParts.year, firstStartParts.month - 1, firstStartParts.day);
  const secondUtc = Date.UTC(
    secondStartParts.year,
    secondStartParts.month - 1,
    secondStartParts.day,
  );

  return Math.round((firstUtc - secondUtc) / MS_PER_DAY);
}

export function dateAtLocalMinutes(
  referenceDate: Date,
  minutesFromMidnight: number,
  timeZone = getCurrentTimeZone(),
): Date {
  const parts = getLocalDateTimeParts(referenceDate, timeZone);
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, minutesFromMidnight, 0, 0),
  );

  return dateFromLocalDateTime(
    {
      day: shifted.getUTCDate(),
      hours: shifted.getUTCHours(),
      minutes: shifted.getUTCMinutes(),
      month: shifted.getUTCMonth() + 1,
      year: shifted.getUTCFullYear(),
    },
    timeZone,
  );
}

export function dateWithLocalDateAndTime(
  dateBase: Date,
  timeParts: LocalTimeParts,
  timeZone = getCurrentTimeZone(),
): Date {
  const dateParts = getLocalDateTimeParts(dateBase, timeZone);

  return dateFromLocalDateTime(
    {
      day: dateParts.day,
      hours: timeParts.hours,
      minutes: timeParts.minutes,
      month: dateParts.month,
      year: dateParts.year,
    },
    timeZone,
  );
}
