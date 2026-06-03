import type { SleepPlanPreset } from '@/types/sleep';
import { getAgeInCompletedMonths } from '@/core/officialSleepGuidelines';
import {
  formatNapCountText,
  PRACTICAL_SLEEP_PRESETS,
  type NapCountOption,
  type PracticalSleepPreset,
} from '@/core/practicalSleepPresets';
import {
  buildSleepPlanPreset,
  calculatePlanBedtimeRange,
  deriveEveningSleepRulesForPlan,
} from '@/core/sleepPlan';

export type AgeSleepPlanPresetTemplateAgeBandId =
  | 'preset_template_0_2_months'
  | 'preset_template_3_4_months'
  | 'preset_template_5_6_months'
  | 'preset_template_7_8_months'
  | 'preset_template_9_11_months'
  | 'preset_template_12_months';

export type AgeSleepPlanPresetTemplateSource = 'profile_birth_date' | 'manual_age_band';

export interface AgeSleepPlanPresetTemplateAgeBand {
  id: AgeSleepPlanPresetTemplateAgeBandId;
  ageFromMonths: number;
  ageToMonths: number;
  title: string;
  practicalPresetId: PracticalSleepPreset['id'];
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
}

export interface AgeSleepPlanPresetTemplate {
  id: string;
  ageBandId: AgeSleepPlanPresetTemplateAgeBandId;
  practicalPresetId: PracticalSleepPreset['id'];
  title: string;
  napCount: NapCountOption;
  daySleepMinMinutes: number;
  daySleepMaxMinutes: number;
  estimatedBedtimeStartMinutes: number;
  estimatedBedtimeEndMinutes: number;
  estimatedNightSleepMinMinutes: number;
  estimatedNightSleepMaxMinutes: number;
  softVariantText: string;
  isRecommended: boolean;
  isAutomaticallySelected: false;
  plan: SleepPlanPreset;
}

export interface AgeSleepPlanPresetTemplateCatalog {
  ageBand: AgeSleepPlanPresetTemplateAgeBand;
  ageMonths: number | null;
  source: AgeSleepPlanPresetTemplateSource;
  practicalPreset: PracticalSleepPreset;
  recommendedPreset: AgeSleepPlanPresetTemplate;
  alternativePreset: AgeSleepPlanPresetTemplate | null;
  whyRecommendedText: string;
}

const DAY_MINUTES = 24 * 60;
const DEFAULT_WAKE_UP_START_MINUTES = 7 * 60;
const DEFAULT_WAKE_UP_END_MINUTES = 7 * 60 + 30;
const DEFAULT_MIN_NIGHT_SLEEP_MINUTES = 3 * 60;

export const AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS: readonly AgeSleepPlanPresetTemplateAgeBand[] =
  [
    {
      ageFromMonths: 0,
      ageToMonths: 2,
      id: 'preset_template_0_2_months',
      practicalPresetId: 'practical-sleep-0-2-months',
      targetAwakeMaxMinutes: 9 * 60 + 30,
      targetAwakeMinMinutes: 7 * 60,
      title: '0–2 месяца',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
    {
      ageFromMonths: 3,
      ageToMonths: 4,
      id: 'preset_template_3_4_months',
      practicalPresetId: 'practical-sleep-3-4-months',
      targetAwakeMaxMinutes: 10 * 60,
      targetAwakeMinMinutes: 8 * 60 + 30,
      title: '3–4 месяца',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
    {
      ageFromMonths: 5,
      ageToMonths: 6,
      id: 'preset_template_5_6_months',
      practicalPresetId: 'practical-sleep-5-6-months',
      targetAwakeMaxMinutes: 10 * 60 + 30,
      targetAwakeMinMinutes: 9 * 60 + 30,
      title: '5–6 месяцев',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
    {
      ageFromMonths: 7,
      ageToMonths: 8,
      id: 'preset_template_7_8_months',
      practicalPresetId: 'practical-sleep-7-8-months',
      targetAwakeMaxMinutes: 11 * 60,
      targetAwakeMinMinutes: 10 * 60,
      title: '7–8 месяцев',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
    {
      ageFromMonths: 9,
      ageToMonths: 11,
      id: 'preset_template_9_11_months',
      practicalPresetId: 'practical-sleep-9-11-months',
      targetAwakeMaxMinutes: 11 * 60 + 30,
      targetAwakeMinMinutes: 10 * 60 + 30,
      title: '9–11 месяцев',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
    {
      ageFromMonths: 12,
      ageToMonths: 12,
      id: 'preset_template_12_months',
      practicalPresetId: 'practical-sleep-12-15-months',
      targetAwakeMaxMinutes: 12 * 60,
      targetAwakeMinMinutes: 11 * 60,
      title: '12 месяцев',
      wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
      wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
    },
  ];

function getPracticalPresetById(presetId: PracticalSleepPreset['id']): PracticalSleepPreset {
  const preset = PRACTICAL_SLEEP_PRESETS.find((item) => item.id === presetId);

  if (!preset) {
    throw new Error(`Practical sleep preset ${presetId} was not found`);
  }

  return preset;
}

function getCandidateNapCounts(preset: PracticalSleepPreset): NapCountOption[] {
  const values = [preset.recommendedNapCount, ...preset.alternativeNapCounts];
  const uniqueValues = Array.from(new Set(values));

  return uniqueValues.sort((first, second) => second - first);
}

function getRecommendedNapCount(preset: PracticalSleepPreset): NapCountOption {
  return getCandidateNapCounts(preset)[0];
}

function getAlternativeNapCount(preset: PracticalSleepPreset): NapCountOption | null {
  return getCandidateNapCounts(preset)[1] ?? null;
}

function calculateEstimatedNightSleepRange(input: {
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
}): {
  minMinutes: number;
  maxMinutes: number;
} {
  const earliestBedtimeMinutes =
    input.wakeUpStartMinutes + input.targetAwakeMinMinutes + input.targetDaySleepMinMinutes;
  const latestBedtimeMinutes =
    input.wakeUpEndMinutes + input.targetAwakeMaxMinutes + input.targetDaySleepMaxMinutes;
  const nextWakeUpStartMinutes = input.wakeUpStartMinutes + DAY_MINUTES;
  const nextWakeUpEndMinutes = input.wakeUpEndMinutes + DAY_MINUTES;

  return {
    maxMinutes: Math.max(0, nextWakeUpEndMinutes - earliestBedtimeMinutes),
    minMinutes: Math.max(0, nextWakeUpStartMinutes - latestBedtimeMinutes),
  };
}

function buildSoftVariantText(napCount: NapCountOption): string {
  return `Мягкий вариант: ${formatNapCountText(
    napCount,
  )}, чтобы промежутки бодрствования были короче. Пресет только подсвечен, он не выбран автоматически.`;
}

function buildAgePresetTemplate(params: {
  band: AgeSleepPlanPresetTemplateAgeBand;
  isRecommended: boolean;
  napCount: NapCountOption;
  practicalPreset: PracticalSleepPreset;
}): AgeSleepPlanPresetTemplate {
  const baseInput = {
    napCount: params.napCount,
    targetAwakeMaxMinutes: params.band.targetAwakeMaxMinutes,
    targetAwakeMinMinutes: params.band.targetAwakeMinMinutes,
    targetDaySleepMaxMinutes: params.practicalPreset.daySleepMaxMinutes,
    targetDaySleepMinMinutes: params.practicalPreset.daySleepMinMinutes,
    wakeUpEndMinutes: params.band.wakeUpEndMinutes,
    wakeUpStartMinutes: params.band.wakeUpStartMinutes,
  };
  const bedtimeRange = calculatePlanBedtimeRange(baseInput);
  const nightSleepRange = calculateEstimatedNightSleepRange(baseInput);
  const plan = buildSleepPlanPreset({
    ...baseInput,
    ...deriveEveningSleepRulesForPlan(baseInput),
    minNightSleepMinutes: DEFAULT_MIN_NIGHT_SLEEP_MINUTES,
  });

  return {
    ageBandId: params.band.id,
    daySleepMaxMinutes: params.practicalPreset.daySleepMaxMinutes,
    daySleepMinMinutes: params.practicalPreset.daySleepMinMinutes,
    estimatedBedtimeEndMinutes: bedtimeRange.endMinutes,
    estimatedBedtimeStartMinutes: bedtimeRange.startMinutes,
    estimatedNightSleepMaxMinutes: nightSleepRange.maxMinutes,
    estimatedNightSleepMinMinutes: nightSleepRange.minMinutes,
    id: `${params.band.id}_${params.napCount}_naps`,
    isAutomaticallySelected: false,
    isRecommended: params.isRecommended,
    napCount: params.napCount,
    plan,
    practicalPresetId: params.practicalPreset.id,
    softVariantText: params.isRecommended ? buildSoftVariantText(params.napCount) : '',
    title: `${params.band.title}: ${formatNapCountText(params.napCount)}`,
  };
}

function buildWhyRecommendedText(params: {
  recommendedPreset: AgeSleepPlanPresetTemplate;
  alternativePreset: AgeSleepPlanPresetTemplate | null;
}): string {
  if (!params.alternativePreset) {
    return `Для старта подсвечен мягкий режим «${formatNapCountText(
      params.recommendedPreset.napCount,
    )}». Он не применяется автоматически.`;
  }

  return `Для старта подсвечен более мягкий режим «${formatNapCountText(
    params.recommendedPreset.napCount,
  )}»: больше дневных снов обычно даёт короче промежутки бодрствования. Соседний вариант — «${formatNapCountText(
    params.alternativePreset.napCount,
  )}».`;
}

function buildPresetCatalog(params: {
  ageBand: AgeSleepPlanPresetTemplateAgeBand;
  ageMonths: number | null;
  source: AgeSleepPlanPresetTemplateSource;
}): AgeSleepPlanPresetTemplateCatalog {
  const practicalPreset = getPracticalPresetById(params.ageBand.practicalPresetId);
  const recommendedNapCount = getRecommendedNapCount(practicalPreset);
  const alternativeNapCount = getAlternativeNapCount(practicalPreset);
  const recommendedPreset = buildAgePresetTemplate({
    band: params.ageBand,
    isRecommended: true,
    napCount: recommendedNapCount,
    practicalPreset,
  });
  const alternativePreset =
    alternativeNapCount === null
      ? null
      : buildAgePresetTemplate({
          band: params.ageBand,
          isRecommended: false,
          napCount: alternativeNapCount,
          practicalPreset,
        });

  return {
    ageBand: params.ageBand,
    ageMonths: params.ageMonths,
    alternativePreset,
    practicalPreset,
    recommendedPreset,
    source: params.source,
    whyRecommendedText: buildWhyRecommendedText({
      alternativePreset,
      recommendedPreset,
    }),
  };
}

export function getAgeSleepPlanPresetTemplateAgeBandById(
  ageBandId: AgeSleepPlanPresetTemplateAgeBandId | null | undefined,
): AgeSleepPlanPresetTemplateAgeBand | null {
  if (!ageBandId) {
    return null;
  }

  return AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS.find((band) => band.id === ageBandId) ?? null;
}

export function getAgeSleepPlanPresetTemplateAgeBandByAgeMonths(
  ageMonths: number | null | undefined,
): AgeSleepPlanPresetTemplateAgeBand | null {
  if (typeof ageMonths !== 'number' || !Number.isFinite(ageMonths) || ageMonths < 0) {
    return null;
  }

  return (
    AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS.find(
      (band) => ageMonths >= band.ageFromMonths && ageMonths <= band.ageToMonths,
    ) ?? null
  );
}

export function getAgeSleepPlanPresetTemplateCatalog(params: {
  ageMonths: number | null | undefined;
  manualAgeBandId?: AgeSleepPlanPresetTemplateAgeBandId | null;
}): AgeSleepPlanPresetTemplateCatalog | null {
  const hasProfileAge =
    typeof params.ageMonths === 'number' &&
    Number.isFinite(params.ageMonths) &&
    params.ageMonths >= 0;
  const ageBandFromProfile = getAgeSleepPlanPresetTemplateAgeBandByAgeMonths(params.ageMonths);

  if (ageBandFromProfile) {
    return buildPresetCatalog({
      ageBand: ageBandFromProfile,
      ageMonths: params.ageMonths ?? null,
      source: 'profile_birth_date',
    });
  }

  if (hasProfileAge) {
    return null;
  }

  const manualAgeBand = getAgeSleepPlanPresetTemplateAgeBandById(params.manualAgeBandId);

  if (!manualAgeBand) {
    return null;
  }

  return buildPresetCatalog({
    ageBand: manualAgeBand,
    ageMonths: null,
    source: 'manual_age_band',
  });
}

export function getAgeSleepPlanPresetTemplateCatalogForProfile(params: {
  birthDate: Date | null | undefined;
  manualAgeBandId?: AgeSleepPlanPresetTemplateAgeBandId | null;
  now: Date;
}): AgeSleepPlanPresetTemplateCatalog | null {
  if (params.birthDate) {
    return getAgeSleepPlanPresetTemplateCatalog({
      ageMonths: getAgeInCompletedMonths(params.birthDate, params.now),
      manualAgeBandId: null,
    });
  }

  return getAgeSleepPlanPresetTemplateCatalog({
    ageMonths: null,
    manualAgeBandId: params.manualAgeBandId,
  });
}
