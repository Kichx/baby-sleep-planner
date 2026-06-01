export type PracticalEvidenceLevel = 'B';

export type NapCountOption = 1 | 2 | 3 | 4 | 5;

export type PracticalSleepPreset = {
  id: string;
  ageFromMonths: number;
  ageToMonths: number;
  label: string;

  recommendedNapCount: NapCountOption;
  alternativeNapCounts: NapCountOption[];

  daySleepMinMinutes: number;
  daySleepMaxMinutes: number;

  note: string;
  transitionNote?: string;

  evidenceLevel: PracticalEvidenceLevel;
  sourceNames: string[];
  sourceSummary: string;
};

export type PracticalNapCountStatus =
  | 'typical'
  | 'transition'
  | 'outside_typical'
  | 'unknown';

export type PracticalDaySleepStatus =
  | 'within_practical_range'
  | 'partially_within_practical_range'
  | 'below_practical_range'
  | 'above_practical_range'
  | 'unknown';

export const PRACTICAL_SLEEP_PRESETS: PracticalSleepPreset[] = [
  {
    id: 'practical-sleep-0-2-months',
    ageFromMonths: 0,
    ageToMonths: 2,
    label: '0–2 месяца',
    recommendedNapCount: 5,
    alternativeNapCounts: [4],
    daySleepMinMinutes: 300,
    daySleepMaxMinutes: 480,
    note:
      'В этом возрасте сон ещё очень фрагментирован: ребёнок может спать часто, а длительность отдельных снов сильно отличается.',
    transitionNote:
      'Жёсткий план дня обычно ещё рано строить. Лучше использовать этот ориентир мягко и смотреть на признаки усталости.',
    evidenceLevel: 'B',
    sourceNames: ['Pregnancy Birth & Baby Australia', 'Raising Children Network'],
    sourceSummary:
      'Практические health-источники описывают частый фрагментированный сон у новорождённых и постепенное формирование режима.',
  },
  {
    id: 'practical-sleep-3-4-months',
    ageFromMonths: 3,
    ageToMonths: 4,
    label: '3–4 месяца',
    recommendedNapCount: 4,
    alternativeNapCounts: [3, 5],
    daySleepMinMinutes: 240,
    daySleepMaxMinutes: 360,
    note:
      'Режим начинает становиться более предсказуемым, но дневные сны всё ещё могут отличаться по длительности.',
    transitionNote:
      'Возможен постепенный переход от частых коротких снов к 3–4 более понятным дневным снам.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Raising Children Network', 'Pregnancy Birth & Baby Australia'],
    sourceSummary:
      'Практические источники для этого возраста описывают несколько дневных снов и суммарный дневной сон около 3–4 часов.',
  },
  {
    id: 'practical-sleep-5-6-months',
    ageFromMonths: 5,
    ageToMonths: 6,
    label: '5–6 месяцев',
    recommendedNapCount: 3,
    alternativeNapCounts: [4],
    daySleepMinMinutes: 180,
    daySleepMaxMinutes: 270,
    note:
      'Часто подходит режим с 3 дневными снами. У части детей ещё сохраняется короткий 4-й сон.',
    transitionNote:
      'Если последний сон постоянно мешает отбою, ребёнок может приближаться к переходу 4 → 3 сна.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Raising Children Network', 'Pregnancy Birth & Baby Australia'],
    sourceSummary:
      'Практические источники описывают несколько дневных снов в этом возрасте, с постепенным удлинением бодрствования.',
  },
  {
    id: 'practical-sleep-7-8-months',
    ageFromMonths: 7,
    ageToMonths: 8,
    label: '7–8 месяцев',
    recommendedNapCount: 3,
    alternativeNapCounts: [2],
    daySleepMinMinutes: 150,
    daySleepMaxMinutes: 240,
    note:
      'Часто ещё сохраняется 3 дневных сна, но часть детей уже готовится к переходу на 2 сна.',
    transitionNote:
      'Если третий сон становится слишком поздним, часто пропускается или сдвигает отбой, можно рассматривать переход 3 → 2 сна.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Raising Children Network', 'Pregnancy Birth & Baby Australia'],
    sourceSummary:
      'Практические источники допускают несколько дневных снов в этом возрасте и подчёркивают индивидуальность переходов.',
  },
  {
    id: 'practical-sleep-9-11-months',
    ageFromMonths: 9,
    ageToMonths: 11,
    label: '9–11 месяцев',
    recommendedNapCount: 2,
    alternativeNapCounts: [3],
    daySleepMinMinutes: 120,
    daySleepMaxMinutes: 210,
    note: 'Часто подходит режим с 2 дневными снами.',
    transitionNote:
      'Если ребёнок пока не выдерживает длинные промежутки бодрствования, временно может сохраняться 3-й короткий сон.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Raising Children Network', 'Pregnancy Birth & Baby Australia'],
    sourceSummary:
      'Практические источники для конца первого года часто описывают 2 дневных сна, при этом часть детей может быть в переходном режиме.',
  },
  {
    id: 'practical-sleep-12-15-months',
    ageFromMonths: 12,
    ageToMonths: 15,
    label: '12–15 месяцев',
    recommendedNapCount: 2,
    alternativeNapCounts: [1],
    daySleepMinMinutes: 120,
    daySleepMaxMinutes: 180,
    note:
      'Многие дети ещё спят 2 раза днём, но постепенно приближаются к переходу на 1 дневной сон.',
    transitionNote:
      'Если один из снов регулярно не получается или второй сон сильно сдвигает отбой, возможен переход 2 → 1 сон.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Pregnancy Birth & Baby Australia', 'Raising Children Network'],
    sourceSummary:
      'Практические источники описывают переходный период между двумя дневными снами и одним дневным сном.',
  },
  {
    id: 'practical-sleep-16-24-months',
    ageFromMonths: 16,
    ageToMonths: 24,
    label: '16–24 месяца',
    recommendedNapCount: 1,
    alternativeNapCounts: [2],
    daySleepMinMinutes: 60,
    daySleepMaxMinutes: 150,
    note: 'Обычно подходит 1 дневной сон, чаще в середине дня.',
    transitionNote:
      'Если ребёнок ещё явно не выдерживает один сон, временно может сохраняться 2-сонный режим.',
    evidenceLevel: 'B',
    sourceNames: ['HSE Ireland', 'Pregnancy Birth & Baby Australia', 'Raising Children Network'],
    sourceSummary:
      'Практические источники для 18–24 месяцев часто описывают один дневной сон около 1–2 часов.',
  },
];

export function getPracticalSleepPresetByAgeMonths(
  ageMonths: number | null | undefined,
): PracticalSleepPreset | null {
  if (typeof ageMonths !== 'number' || !Number.isFinite(ageMonths) || ageMonths < 0) {
    return null;
  }

  return (
    PRACTICAL_SLEEP_PRESETS.find(
      (preset) => ageMonths >= preset.ageFromMonths && ageMonths <= preset.ageToMonths,
    ) ?? null
  );
}

export function getNapCountStatusForPracticalPreset(params: {
  ageMonths: number | null | undefined;
  napCount: number | null | undefined;
}): {
  status: PracticalNapCountStatus;
  preset: PracticalSleepPreset | null;
} {
  const preset = getPracticalSleepPresetByAgeMonths(params.ageMonths);

  if (!preset || typeof params.napCount !== 'number' || !Number.isFinite(params.napCount)) {
    return {
      status: 'unknown',
      preset,
    };
  }

  if (params.napCount === preset.recommendedNapCount) {
    return {
      status: 'typical',
      preset,
    };
  }

  if (preset.alternativeNapCounts.includes(params.napCount as NapCountOption)) {
    return {
      status: 'transition',
      preset,
    };
  }

  return {
    status: 'outside_typical',
    preset,
  };
}

export function getDaySleepRangeStatusForPracticalPreset(params: {
  ageMonths: number | null | undefined;
  daySleepMinMinutes: number | null | undefined;
  daySleepMaxMinutes: number | null | undefined;
}): {
  status: PracticalDaySleepStatus;
  preset: PracticalSleepPreset | null;
  daySleepMinMinutes: number;
  daySleepMaxMinutes: number;
} {
  const preset = getPracticalSleepPresetByAgeMonths(params.ageMonths);
  const rawMin =
    typeof params.daySleepMinMinutes === 'number' &&
    Number.isFinite(params.daySleepMinMinutes)
      ? params.daySleepMinMinutes
      : 0;
  const rawMax =
    typeof params.daySleepMaxMinutes === 'number' &&
    Number.isFinite(params.daySleepMaxMinutes)
      ? params.daySleepMaxMinutes
      : 0;
  const daySleepMinMinutes = Math.min(rawMin, rawMax);
  const daySleepMaxMinutes = Math.max(rawMin, rawMax);

  if (!preset) {
    return {
      status: 'unknown',
      preset: null,
      daySleepMinMinutes,
      daySleepMaxMinutes,
    };
  }

  if (daySleepMaxMinutes < preset.daySleepMinMinutes) {
    return {
      status: 'below_practical_range',
      preset,
      daySleepMinMinutes,
      daySleepMaxMinutes,
    };
  }

  if (daySleepMinMinutes > preset.daySleepMaxMinutes) {
    return {
      status: 'above_practical_range',
      preset,
      daySleepMinMinutes,
      daySleepMaxMinutes,
    };
  }

  if (
    daySleepMinMinutes < preset.daySleepMinMinutes ||
    daySleepMaxMinutes > preset.daySleepMaxMinutes
  ) {
    return {
      status: 'partially_within_practical_range',
      preset,
      daySleepMinMinutes,
      daySleepMaxMinutes,
    };
  }

  return {
    status: 'within_practical_range',
    preset,
    daySleepMinMinutes,
    daySleepMaxMinutes,
  };
}

export function formatNapCountText(count: number): string {
  if (count === 1) {
    return '1 дневной сон';
  }

  if (count >= 2 && count <= 4) {
    return `${count} дневных сна`;
  }

  return `${count} дневных снов`;
}
