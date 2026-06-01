export type EvidenceSourceLevel = 'D';

export type ScientificSleepEvidenceTopic =
  | 'normal_variability'
  | 'daytime_naps'
  | 'night_sleep'
  | 'total_sleep'
  | 'sleep_latency'
  | 'night_waking'
  | 'longest_sleep_period'
  | 'cultural_variability'
  | 'algorithm_documentation'
  | 'range_sanity_check';

export type ScientificSleepEvidenceKind =
  | 'systematic_review'
  | 'longitudinal_reference'
  | 'cross_cultural_study';

export type ScientificSleepEvidenceSource = {
  id: string;
  level: EvidenceSourceLevel;
  title: string;
  authors: string;
  year: number;
  publication: string;
  evidenceKind: ScientificSleepEvidenceKind;
  trustNote: string;
  appUse: string[];
  limitations: string[];
  supportsTopics: ScientificSleepEvidenceTopic[];
};

const EVIDENCE_KIND_LABELS: Record<ScientificSleepEvidenceKind, string> = {
  cross_cultural_study: 'cross-cultural study',
  longitudinal_reference: 'longitudinal reference',
  systematic_review: 'systematic review',
};

// Level D is evidence backing only. It must not be used as a direct scheduling
// rule. Levels A/B/C remain the user-facing guidance layers.
export const SCIENTIFIC_SLEEP_EVIDENCE_SOURCES: ScientificSleepEvidenceSource[] = [
  {
    appUse: [
      'обоснование алгоритма',
      'проверка диапазонов',
      'объяснение вариативности',
      'документация источников',
    ],
    authors: 'Galland et al.',
    evidenceKind: 'systematic_review',
    id: 'galland-2012-normal-sleep-patterns',
    level: 'D',
    limitations: [
      'Обзор описывает наблюдаемые паттерны сна, а не готовое расписание для конкретного ребёнка.',
      'Не задаёт wake windows и не заменяет официальный ориентир суммарного сна.',
      'Данные из разных наблюдательных методик нельзя использовать как медицинский совет.',
    ],
    publication: 'Sleep Medicine Reviews',
    supportsTopics: [
      'normal_variability',
      'daytime_naps',
      'night_sleep',
      'sleep_latency',
      'night_waking',
      'longest_sleep_period',
      'algorithm_documentation',
      'range_sanity_check',
    ],
    title:
      'Normal sleep patterns in infants and children: a systematic review of observational studies',
    trustNote:
      'Систематический обзор наблюдательных исследований помогает описывать широкий разброс нормальных паттернов сна у детей.',
    year: 2012,
  },
  {
    appUse: [
      'проверка диапазонов',
      'обоснование алгоритма',
      'объяснение вариативности',
      'документация источников',
    ],
    authors: 'Iglowstein et al.',
    evidenceKind: 'longitudinal_reference',
    id: 'iglowstein-2003-reference-values',
    level: 'D',
    limitations: [
      'Референсные значения не являются готовым расписанием и не задают дневной план.',
      'Когорта швейцарская, исследование опубликовано в 2003 году; нужна осторожная интерпретация.',
      'Не задаёт wake windows и не заменяет официальные рекомендации уровня A.',
    ],
    publication: 'Pediatrics',
    supportsTopics: [
      'normal_variability',
      'daytime_naps',
      'night_sleep',
      'total_sleep',
      'algorithm_documentation',
      'range_sanity_check',
    ],
    title:
      'Sleep duration from infancy to adolescence: reference values and generational trends',
    trustNote:
      'Лонгитюдные референсные значения полезны для проверки диапазонов общего, ночного и дневного сна.',
    year: 2003,
  },
  {
    appUse: [
      'объяснение вариативности',
      'обоснование алгоритма',
      'проверка диапазонов',
      'документация источников',
    ],
    authors: 'Mindell et al.',
    evidenceKind: 'cross_cultural_study',
    id: 'mindell-2010-cross-cultural-sleep',
    level: 'D',
    limitations: [
      'Кросс-культурное сравнение не задаёт универсальный режим для каждой семьи.',
      'Данные основаны на родительских опросниках и не должны использоваться как медицинский совет.',
      'Не меняет napCount, wake windows или активный план автоматически.',
    ],
    publication: 'Sleep Medicine',
    supportsTopics: [
      'normal_variability',
      'night_sleep',
      'cultural_variability',
      'algorithm_documentation',
      'range_sanity_check',
    ],
    title: 'Cross-cultural differences in infant and toddler sleep',
    trustNote:
      'Кросс-культурные данные показывают, что семейный режим и среда могут заметно менять bedtime и ночной сон.',
    year: 2010,
  },
];

export function getScientificSleepEvidenceSources(): ScientificSleepEvidenceSource[] {
  return [...SCIENTIFIC_SLEEP_EVIDENCE_SOURCES];
}

export function getScientificSleepEvidenceSourceById(
  id: string,
): ScientificSleepEvidenceSource | null {
  return SCIENTIFIC_SLEEP_EVIDENCE_SOURCES.find((source) => source.id === id) ?? null;
}

export function getScientificSleepEvidenceSourcesByTopic(
  topic: ScientificSleepEvidenceTopic,
): ScientificSleepEvidenceSource[] {
  return SCIENTIFIC_SLEEP_EVIDENCE_SOURCES.filter((source) =>
    source.supportsTopics.includes(topic),
  );
}

export function formatScientificEvidenceSourceLabel(
  source: ScientificSleepEvidenceSource,
): string {
  return `${source.authors}, ${source.year} · ${EVIDENCE_KIND_LABELS[source.evidenceKind]}`;
}

export function formatScientificEvidenceShortUse(
  source: ScientificSleepEvidenceSource,
): string {
  const [primaryUse, secondaryUse] = source.appUse;

  return secondaryUse ? `${primaryUse}; ${secondaryUse}` : primaryUse ?? '';
}
