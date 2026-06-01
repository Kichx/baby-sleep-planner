export type EvidenceLevel = 'A';

export type OfficialSleepGuideline = {
  id: string;
  ageFromMonths: number;
  ageToMonths: number;
  label: string;

  totalSleepMinMinutes: number;
  totalSleepMaxMinutes: number;

  includesNaps: true;
  evidenceLevel: EvidenceLevel;

  sourceNames: string[];
  sourceSummary: string;

  supportsNapCount: false;
  supportsWakeWindows: false;
  supportsDayNightSplit: false;
};

export type SleepGuidelineStatus =
  | 'below_recommended'
  | 'within_recommended'
  | 'above_recommended'
  | 'unknown';

export type SleepGuidelineRangeStatus =
  | 'below_recommended'
  | 'within_recommended'
  | 'partially_within_recommended'
  | 'above_recommended'
  | 'unknown';

export type SleepGuidelineCheckResult = {
  status: SleepGuidelineStatus;
  ageMonths: number;
  totalSleepMinutes: number;
  recommendedMinMinutes: number | null;
  recommendedMaxMinutes: number | null;
  diffToMinMinutes: number | null;
  diffToMaxMinutes: number | null;
  guideline: OfficialSleepGuideline | null;
};

export type SleepGuidelineRangeCheckResult = {
  status: SleepGuidelineRangeStatus;
  guideline: OfficialSleepGuideline | null;
  minTotalSleepMinutes: number;
  maxTotalSleepMinutes: number;
  recommendedMinMinutes: number | null;
  recommendedMaxMinutes: number | null;
};

const DAY_MINUTES = 24 * 60;

export const OFFICIAL_SLEEP_GUIDELINES: OfficialSleepGuideline[] = [
  {
    id: 'official-sleep-0-3-months',
    ageFromMonths: 0,
    ageToMonths: 3,
    label: '0–3 месяца',
    totalSleepMinMinutes: 14 * 60,
    totalSleepMaxMinutes: 17 * 60,
    includesNaps: true,
    evidenceLevel: 'A',
    sourceNames: [
      'ВОЗ',
      'CDC',
      'Australian 24-Hour Movement Guidelines',
      'Canadian 24-Hour Movement Guidelines',
    ],
    sourceSummary:
      'Официальные рекомендации указывают суммарный сон за 24 часа, включая дневные сны.',
    supportsNapCount: false,
    supportsWakeWindows: false,
    supportsDayNightSplit: false,
  },
  {
    id: 'official-sleep-4-11-months',
    ageFromMonths: 4,
    ageToMonths: 11,
    label: '4–11 месяцев',
    totalSleepMinMinutes: 12 * 60,
    totalSleepMaxMinutes: 16 * 60,
    includesNaps: true,
    evidenceLevel: 'A',
    sourceNames: [
      'ВОЗ',
      'CDC',
      'AASM',
      'Australian 24-Hour Movement Guidelines',
      'Canadian 24-Hour Movement Guidelines',
    ],
    sourceSummary:
      'Официальные рекомендации указывают суммарный сон за 24 часа, включая дневные сны.',
    supportsNapCount: false,
    supportsWakeWindows: false,
    supportsDayNightSplit: false,
  },
  {
    id: 'official-sleep-12-24-months',
    ageFromMonths: 12,
    ageToMonths: 24,
    label: '1–2 года',
    totalSleepMinMinutes: 11 * 60,
    totalSleepMaxMinutes: 14 * 60,
    includesNaps: true,
    evidenceLevel: 'A',
    sourceNames: [
      'ВОЗ',
      'CDC',
      'AASM',
      'Australian 24-Hour Movement Guidelines',
      'Canadian 24-Hour Movement Guidelines',
    ],
    sourceSummary:
      'Официальные рекомендации указывают суммарный сон за 24 часа, включая дневные сны.',
    supportsNapCount: false,
    supportsWakeWindows: false,
    supportsDayNightSplit: false,
  },
  {
    id: 'official-sleep-25-59-months',
    ageFromMonths: 25,
    ageToMonths: 59,
    label: '2–4 года',
    totalSleepMinMinutes: 10 * 60,
    totalSleepMaxMinutes: 13 * 60,
    includesNaps: true,
    evidenceLevel: 'A',
    sourceNames: [
      'ВОЗ',
      'CDC',
      'AASM',
      'Australian 24-Hour Movement Guidelines',
      'Canadian 24-Hour Movement Guidelines',
    ],
    sourceSummary:
      'Официальные рекомендации указывают суммарный сон за 24 часа. У части детей сон может включать дневной сон.',
    supportsNapCount: false,
    supportsWakeWindows: false,
    supportsDayNightSplit: false,
  },
];

export function getAgeInCompletedMonths(birthDate: Date, now: Date): number {
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());

  if (now.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function getOfficialSleepGuidelineByAgeMonths(
  ageMonths: number | null | undefined,
): OfficialSleepGuideline | null {
  if (typeof ageMonths !== 'number' || !Number.isFinite(ageMonths) || ageMonths < 0) {
    return null;
  }

  return (
    OFFICIAL_SLEEP_GUIDELINES.find(
      (guideline) =>
        ageMonths >= guideline.ageFromMonths && ageMonths <= guideline.ageToMonths,
    ) ?? null
  );
}

export function checkTotalSleepAgainstOfficialGuideline(params: {
  ageMonths: number | null | undefined;
  totalSleepMinutes: number | null | undefined;
}): SleepGuidelineCheckResult {
  const ageMonths = typeof params.ageMonths === 'number' ? params.ageMonths : -1;
  const totalSleepMinutes =
    typeof params.totalSleepMinutes === 'number' && Number.isFinite(params.totalSleepMinutes)
      ? params.totalSleepMinutes
      : 0;
  const guideline = getOfficialSleepGuidelineByAgeMonths(params.ageMonths);

  if (!guideline) {
    return {
      status: 'unknown',
      ageMonths,
      totalSleepMinutes,
      recommendedMinMinutes: null,
      recommendedMaxMinutes: null,
      diffToMinMinutes: null,
      diffToMaxMinutes: null,
      guideline: null,
    };
  }

  const min = guideline.totalSleepMinMinutes;
  const max = guideline.totalSleepMaxMinutes;
  let status: SleepGuidelineStatus = 'within_recommended';

  if (totalSleepMinutes < min) {
    status = 'below_recommended';
  } else if (totalSleepMinutes > max) {
    status = 'above_recommended';
  }

  return {
    status,
    ageMonths,
    totalSleepMinutes,
    recommendedMinMinutes: min,
    recommendedMaxMinutes: max,
    diffToMinMinutes: totalSleepMinutes - min,
    diffToMaxMinutes: totalSleepMinutes - max,
    guideline,
  };
}

export function checkTotalSleepRangeAgainstOfficialGuideline(params: {
  ageMonths: number | null | undefined;
  minTotalSleepMinutes: number | null | undefined;
  maxTotalSleepMinutes: number | null | undefined;
}): SleepGuidelineRangeCheckResult {
  const guideline = getOfficialSleepGuidelineByAgeMonths(params.ageMonths);
  const minTotalSleepMinutes =
    typeof params.minTotalSleepMinutes === 'number' &&
    Number.isFinite(params.minTotalSleepMinutes)
      ? params.minTotalSleepMinutes
      : 0;
  const maxTotalSleepMinutes =
    typeof params.maxTotalSleepMinutes === 'number' &&
    Number.isFinite(params.maxTotalSleepMinutes)
      ? params.maxTotalSleepMinutes
      : 0;
  const normalizedMin = Math.min(minTotalSleepMinutes, maxTotalSleepMinutes);
  const normalizedMax = Math.max(minTotalSleepMinutes, maxTotalSleepMinutes);

  if (!guideline) {
    return {
      status: 'unknown',
      guideline: null,
      minTotalSleepMinutes: normalizedMin,
      maxTotalSleepMinutes: normalizedMax,
      recommendedMinMinutes: null,
      recommendedMaxMinutes: null,
    };
  }

  const recommendedMin = guideline.totalSleepMinMinutes;
  const recommendedMax = guideline.totalSleepMaxMinutes;
  let status: SleepGuidelineRangeStatus = 'within_recommended';

  if (normalizedMax < recommendedMin) {
    status = 'below_recommended';
  } else if (normalizedMin > recommendedMax) {
    status = 'above_recommended';
  } else if (normalizedMin < recommendedMin || normalizedMax > recommendedMax) {
    status = 'partially_within_recommended';
  }

  return {
    status,
    guideline,
    minTotalSleepMinutes: normalizedMin,
    maxTotalSleepMinutes: normalizedMax,
    recommendedMinMinutes: recommendedMin,
    recommendedMaxMinutes: recommendedMax,
  };
}

export function calculateTotalSleepRangeFromWakeRange(params: {
  minWakeMinutes: number;
  maxWakeMinutes: number;
}): {
  minTotalSleepMinutes: number;
  maxTotalSleepMinutes: number;
} {
  const minWakeMinutes = Math.max(0, Math.min(DAY_MINUTES, params.minWakeMinutes));
  const maxWakeMinutes = Math.max(0, Math.min(DAY_MINUTES, params.maxWakeMinutes));

  return {
    minTotalSleepMinutes: DAY_MINUTES - Math.max(minWakeMinutes, maxWakeMinutes),
    maxTotalSleepMinutes: DAY_MINUTES - Math.min(minWakeMinutes, maxWakeMinutes),
  };
}

export function formatDurationShort(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours > 0 && restMinutes > 0) {
    return `${hours} ч ${restMinutes} мин`;
  }

  if (hours > 0) {
    return `${hours} ч`;
  }

  return `${restMinutes} мин`;
}

export function formatDurationRangeShort(
  minMinutes: number,
  maxMinutes: number,
): string {
  const minHours = minMinutes / 60;
  const maxHours = maxMinutes / 60;

  if (Number.isInteger(minHours) && Number.isInteger(maxHours)) {
    return `${minHours}–${maxHours} ч`;
  }

  return `${formatDurationShort(minMinutes)} — ${formatDurationShort(maxMinutes)}`;
}
