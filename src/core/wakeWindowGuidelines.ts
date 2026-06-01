import { formatDurationShort } from '@/core/officialSleepGuidelines';

export type WakeWindowSourceLevel = 'practical_wake_window';

export type WakeWindowStatus = 'within' | 'short' | 'long';

export type WakeWindowRangeStatus =
  | 'within'
  | 'partially_overlaps'
  | 'short'
  | 'long';

export type WakeWindowGuideline = {
  minAgeMonths: number;
  maxAgeMonths: number;
  minWakeWindowMinutes: number;
  maxWakeWindowMinutes: number;
  label: string;
  sourceLevel: WakeWindowSourceLevel;
  sourceLabel: string;
  note: string;
};

export type WakeWindowRangeInput = Pick<
  WakeWindowGuideline,
  'minWakeWindowMinutes' | 'maxWakeWindowMinutes'
>;

const PRACTICAL_WAKE_WINDOW_NOTE =
  'Мягкий практический ориентир между снами, а не медицинская норма.';

export const WAKE_WINDOW_GUIDELINES = [
  {
    label: '0–1 месяц',
    maxAgeMonths: 1,
    maxWakeWindowMinutes: 60,
    minAgeMonths: 0,
    minWakeWindowMinutes: 30,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
  {
    label: '1–3 месяца',
    maxAgeMonths: 3,
    maxWakeWindowMinutes: 120,
    minAgeMonths: 1,
    minWakeWindowMinutes: 60,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
  {
    label: '3–4 месяца',
    maxAgeMonths: 4,
    maxWakeWindowMinutes: 150,
    minAgeMonths: 3,
    minWakeWindowMinutes: 75,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
  {
    label: '5–7 месяцев',
    maxAgeMonths: 7,
    maxWakeWindowMinutes: 240,
    minAgeMonths: 5,
    minWakeWindowMinutes: 120,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
  {
    label: '7–10 месяцев',
    maxAgeMonths: 10,
    maxWakeWindowMinutes: 270,
    minAgeMonths: 7,
    minWakeWindowMinutes: 150,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
  {
    label: '10–12 месяцев',
    maxAgeMonths: 12,
    maxWakeWindowMinutes: 360,
    minAgeMonths: 10,
    minWakeWindowMinutes: 180,
    note: PRACTICAL_WAKE_WINDOW_NOTE,
    sourceLabel: 'Cleveland Clinic',
    sourceLevel: 'practical_wake_window',
  },
] as const satisfies readonly WakeWindowGuideline[];

export function getWakeWindowGuidelineByAgeMonths(
  ageMonths: number | null | undefined,
): WakeWindowGuideline | null {
  if (typeof ageMonths !== 'number' || !Number.isFinite(ageMonths) || ageMonths < 0) {
    return null;
  }

  for (let index = WAKE_WINDOW_GUIDELINES.length - 1; index >= 0; index -= 1) {
    const guideline = WAKE_WINDOW_GUIDELINES[index];

    if (ageMonths >= guideline.minAgeMonths && ageMonths <= guideline.maxAgeMonths) {
      return guideline;
    }
  }

  return null;
}

export function checkWakeWindowAgainstGuideline(
  minutes: number,
  guideline: WakeWindowGuideline,
): WakeWindowStatus {
  if (minutes < guideline.minWakeWindowMinutes) {
    return 'short';
  }

  if (minutes > guideline.maxWakeWindowMinutes) {
    return 'long';
  }

  return 'within';
}

export function checkWakeWindowRangeAgainstGuideline(
  minMinutes: number,
  maxMinutes: number,
  guideline: WakeWindowGuideline,
): WakeWindowRangeStatus {
  const normalizedMin = Math.min(minMinutes, maxMinutes);
  const normalizedMax = Math.max(minMinutes, maxMinutes);

  if (normalizedMax < guideline.minWakeWindowMinutes) {
    return 'short';
  }

  if (normalizedMin > guideline.maxWakeWindowMinutes) {
    return 'long';
  }

  if (
    normalizedMin < guideline.minWakeWindowMinutes ||
    normalizedMax > guideline.maxWakeWindowMinutes
  ) {
    return 'partially_overlaps';
  }

  return 'within';
}

export function formatWakeWindowRangeShort(range: WakeWindowRangeInput): string;
export function formatWakeWindowRangeShort(
  minWakeWindowMinutes: number,
  maxWakeWindowMinutes: number,
): string;
export function formatWakeWindowRangeShort(
  rangeOrMinMinutes: WakeWindowRangeInput | number,
  maybeMaxMinutes?: number,
): string {
  const rawMinMinutes =
    typeof rangeOrMinMinutes === 'number'
      ? rangeOrMinMinutes
      : rangeOrMinMinutes.minWakeWindowMinutes;
  const rawMaxMinutes =
    typeof rangeOrMinMinutes === 'number'
      ? maybeMaxMinutes
      : rangeOrMinMinutes.maxWakeWindowMinutes;
  const firstMinutes = Math.max(0, Math.round(rawMinMinutes));
  const secondMinutes = Math.max(
    0,
    Math.round(typeof rawMaxMinutes === 'number' ? rawMaxMinutes : rawMinMinutes),
  );
  const minMinutes = Math.min(firstMinutes, secondMinutes);
  const maxMinutes = Math.max(firstMinutes, secondMinutes);

  if (minMinutes === maxMinutes) {
    return formatDurationShort(minMinutes);
  }

  if (minMinutes < 60 && maxMinutes <= 60) {
    return `${minMinutes}–${maxMinutes} мин`;
  }

  if (minMinutes % 60 === 0 && maxMinutes % 60 === 0) {
    return `${minMinutes / 60}–${maxMinutes / 60} ч`;
  }

  return `${formatDurationShort(minMinutes)} — ${formatDurationShort(maxMinutes)}`;
}

export function formatWakeWindowStatusText(status: WakeWindowRangeStatus): string {
  switch (status) {
    case 'within':
      return 'План в ориентире';
    case 'partially_overlaps':
      return 'Частично пересекается с ориентиром';
    case 'short':
      return 'Короче практического ориентира';
    case 'long':
      return 'Длиннее практического ориентира';
  }
}
