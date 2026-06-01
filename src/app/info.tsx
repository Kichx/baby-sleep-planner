import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import {
  OFFICIAL_SLEEP_GUIDELINES,
  formatDurationRangeShort,
} from '@/core/officialSleepGuidelines';
import {
  PRACTICAL_SLEEP_PRESETS,
  formatNapCountText,
} from '@/core/practicalSleepPresets';
import {
  SCIENTIFIC_SLEEP_EVIDENCE_SOURCES,
  formatScientificEvidenceShortUse,
  formatScientificEvidenceSourceLabel,
} from '@/core/scientificSleepEvidence';
import {
  WAKE_WINDOW_GUIDELINES,
  formatWakeWindowRangeShort,
} from '@/core/wakeWindowGuidelines';

type InfoArticleId =
  | 'night-sleep'
  | 'night-forecast'
  | 'official-sleep-guidelines'
  | 'practical-sleep-guidelines'
  | 'wake-window-guidelines'
  | 'evening-sleep-rules'
  | 'scientific-evidence';

interface InfoArticleTable {
  columns: string[];
  rows: {
    cells: string[];
    id: string;
  }[];
}

interface InfoArticle {
  id: InfoArticleId;
  paragraphs: string[];
  subtitle: string;
  table?: InfoArticleTable;
  title: string;
}

function formatPracticalNapCountsCell(recommendedNapCount: number, alternativeNapCounts: number[]): string {
  if (alternativeNapCounts.length === 0) {
    return `обычно: ${formatNapCountText(recommendedNapCount)}`;
  }

  return `обычно: ${formatNapCountText(recommendedNapCount)}\nещё встречается: ${alternativeNapCounts
    .map(formatNapCountText)
    .join(', ')}`;
}

const INFO_ARTICLES: InfoArticle[] = [
  {
    id: 'night-sleep',
    paragraphs: [
      'Отдельной галочки «ночь внесена» нет. Приложение смотрит на интервал сна и активный план дня, а затем относит запись к дневному или ночному сну.',
      'Запись считается ночной, если началась до старта дня, пересекла полночь или началась не раньше целевого отбоя из плана.',
      'Вечерняя запись после раннего отбоя остаётся дневным сном только если она короткая и закончилась до лимита последнего вечернего сна. Иначе приложение считает её ночным сном.',
      'Длинная запись до целевого отбоя тоже может стать ночной: для этого она должна быть не короче минимальной ночи из плана и закончиться после целевого отбоя.',
      'Пока сон идёт, текущий момент используется как временный конец записи. После завершения тип пересчитывается по фактическому началу и концу.',
    ],
    subtitle: 'Как приложение понимает, внесена ночь или дневной сон.',
    title: 'Ночной сон: как определяется',
  },
  {
    id: 'night-forecast',
    paragraphs: [
      'Прогноз ночи показывает расчётное время отбоя на сегодня. Он строится из активного плана дня и записей сна за текущий день сна.',
      'Сначала приложение считает, сколько бодрствования уже прошло: берёт время от старта дня до текущего момента и вычитает из него весь записанный сон. Затем сравнивает результат с целевой суммой бодрствования из плана.',
      'Дальше прогноз пробует уложить оставшиеся дневные сны. Для каждого сна берётся целевое окно бодрствования, примерная длительность дневного сна и вечерние лимиты из плана. Сон не добавляется в прогноз, если он уже не помещается до раннего отбоя или до предельного окончания вечернего сна.',
      'Если обычные сны уже не подходят, но последнее бодрствование получается слишком длинным, прогноз может учесть микросон. Он добавляется только если помещается по вечерним ограничениям и не выводит дневной сон выше максимума плана.',
      'Итоговый отбой считается после оставшегося бодрствования и спрогнозированных дневных снов, но не раньше «раннего отбоя» из плана. Если ночной сон уже идёт, прогнозом считается фактическое начало этой ночи.',
    ],
    subtitle: 'Почему время отбоя может сдвигаться в течение дня.',
    title: 'Как рассчитывается «Прогноз ночи»',
  },
  {
    id: 'official-sleep-guidelines',
    paragraphs: [
      'Уровень A — верхний слой проверки: достаточно ли суммарного сна за 24 часа по официальным возрастным диапазонам. В эту сумму входят ночной сон и все дневные сны.',
      'Для младенцев 4–11 месяцев ориентир обычно составляет 12–16 часов сна за сутки, для детей 1–2 лет — 11–14 часов. Приложение показывает диапазон, а не одну точную цифру.',
      'В приложении используются ориентиры ВОЗ, CDC, AASM, Australian 24-Hour Movement Guidelines и Canadian 24-Hour Movement Guidelines. Эти источники подходят для общей сверки сна за сутки.',
      'Уровень A не отвечает, сколько именно должно быть дневных снов, какой длины должен быть каждый сон и через сколько минут после пробуждения укладывать ребёнка. Для этого ниже есть уровни B и C.',
      'Если день вышел за диапазон, это не значит, что родитель сделал что-то неправильно. Сон ребёнка может меняться из-за самочувствия, поездок, скачков развития и других факторов.',
      'Повторяющиеся сильные отклонения, необычная вялость или заметное ухудшение самочувствия — повод обсудить ситуацию с врачом. Приложение не ставит диагнозы и не заменяет медицинскую консультацию.',
    ],
    subtitle:
      'Как приложение сверяет график с рекомендациями ВОЗ, CDC и других источников',
    table: {
      columns: ['Возраст', 'Сон за 24 часа'],
      rows: OFFICIAL_SLEEP_GUIDELINES.map((guideline) => ({
        cells: [
          guideline.label,
          formatDurationRangeShort(
            guideline.totalSleepMinMinutes,
            guideline.totalSleepMaxMinutes,
          ),
        ],
        id: guideline.id,
      })),
    },
    title: 'Уровень A · Официальные нормы сна',
  },
  {
    id: 'practical-sleep-guidelines',
    paragraphs: [
      'Уровень B переводит общую норму сна в более практичный дневной ориентир: сколько дневных снов обычно бывает в этом возрасте и сколько сна может приходиться на день.',
      'Для этого приложение использует доверенные health-источники: HSE Ireland, Raising Children Network и Pregnancy Birth & Baby Australia. Они описывают бытовые режимы сна, а не строгую медицинскую норму.',
      'Источники немного по-разному делят возрастные периоды, поэтому таблица ниже — сглаженный стартовый ориентир. Она нужна, чтобы проще выбрать план, а не чтобы каждый день совпадал с таблицей.',
      'В колонке “обычно” показан основной вариант для возраста. “Ещё встречается” — соседний режим, который может быть нормальным рядом с этим возрастом. Это особенно полезно на переходах 4 → 3, 3 → 2 и 2 → 1 сон.',
      'Уровень B помогает понять, какой параметр менять первым: количество снов, суммарный дневной сон или длительность отдельных дневных снов. Но он не меняет план автоматически.',
      'Если ребёнок хорошо себя чувствует, нормально засыпает и день складывается спокойно, план можно оставить даже при отличии от ориентира. Если сон регулярно разваливается, ориентир помогает спокойно выбрать, что попробовать изменить.',
      'Уровень B всегда проверяется отдельно от уровня A: дневной сон может выглядеть практично, но общая сумма за 24 часа всё равно может быть ниже или выше официального диапазона.',
    ],
    subtitle: 'Почему приложение предлагает разное количество дневных снов',
    table: {
      columns: ['Возраст', 'Дневные сны', 'Сон днём'],
      rows: PRACTICAL_SLEEP_PRESETS.map((preset) => ({
        cells: [
          preset.label,
          formatPracticalNapCountsCell(
            preset.recommendedNapCount,
            preset.alternativeNapCounts,
          ),
          formatDurationRangeShort(preset.daySleepMinMinutes, preset.daySleepMaxMinutes),
        ],
        id: preset.id,
      })),
    },
    title: 'Уровень B · Возрастные ориентиры дневного сна',
  },
  {
    id: 'wake-window-guidelines',
    paragraphs: [
      'Окно бодрствования — это время между пробуждением и следующим сном. Именно его родителям чаще всего приходится считать вручную, поэтому приложение показывает ориентир само.',
      'Уровень C показывает практический диапазон по возрасту. Это не официальная медицинская норма и не требование укладывать ребёнка ровно через указанное время.',
      'Нижняя граница помогает не предлагать сон слишком рано, когда ребёнок может быть ещё не готов. Верхняя граница помогает заметить, что бодрствование уже становится длинным и следующий сон лучше не затягивать.',
      'Официальные источники уровня A задают суммарный сон за 24 часа, но не задают окна бодрствования, количество дневных снов или подробное расписание. Поэтому уровень C отделён от уровня A.',
      'Приложение использует диапазон, а не один момент времени: дети индивидуальны, а признаки усталости, качество предыдущего сна и фактическая история дня тоже важны.',
      'Практический клинический источник для этого слоя: Cleveland Clinic. В приложении это мягкий ориентир для подсказок, а не диагноз и не медицинское назначение.',
    ],
    subtitle: 'Уровень C: практический ориентир между снами',
    table: {
      columns: ['Возраст', 'Окно бодрствования'],
      rows: WAKE_WINDOW_GUIDELINES.map((guideline) => ({
        cells: [guideline.label, formatWakeWindowRangeShort(guideline)],
        id: `${guideline.label}-${guideline.minWakeWindowMinutes}`,
      })),
    },
    title: 'Уровень C · Окна бодрствования',
  },
  {
    id: 'scientific-evidence',
    paragraphs: [
      'Уровень D — это научная база модели. Он не говорит родителю “делайте так”, а объясняет, почему приложение использует диапазоны, историю сна и осторожные подсказки вместо одного универсального расписания.',
      'Этот уровень опирается на наблюдательные исследования сна детей: систематический обзор, лонгитюдные референсные значения и кросс-культурное сравнение. Такие работы полезны для понимания разброса нормальных паттернов сна.',
      'Научные данные уровня D помогают проверять, что диапазоны A/B/C не выглядят искусственно узкими, и что алгоритм допускает нормальную вариативность: разную длительность ночи, дневных снов, засыпания и ночных пробуждений.',
      'Важно ограничение: наблюдательные исследования описывают группы детей. Они не превращаются напрямую в режим для конкретного ребёнка и не должны автоматически менять план, количество снов или окна бодрствования.',
      'Поэтому уровень D находится ниже пользовательских ориентиров. Уровень A остаётся официальной проверкой суммарного сна, уровень B — практическим дневным ориентиром, уровень C — мягким ориентиром бодрствования.',
      'Если ребёнок заметно отличается от средних значений, это не обязательно ошибка плана. Семейный режим, культура, среда сна, возрастной переход и индивидуальная чувствительность могут менять картину дня.',
      'Уровень D не является медицинским советом и не заменяет врача. Его задача — сделать логику приложения прозрачной: почему подсказки гибкие, почему используются диапазоны и почему один день не оценивается как “плохой” только из-за отличия от среднего.',
    ],
    subtitle: 'Уровень D · исследования для проверки логики',
    table: {
      columns: ['Источник', 'Что даёт модели', 'Ограничение'],
      rows: SCIENTIFIC_SLEEP_EVIDENCE_SOURCES.map((source) => ({
        cells: [
          `${formatScientificEvidenceSourceLabel(source)}\n${source.title}`,
          `${source.trustNote}\nИспользование: ${formatScientificEvidenceShortUse(source)}`,
          source.limitations[0] ?? '',
        ],
        id: source.id,
      })),
    },
    title: 'Уровень D · Научная база модели',
  },
  {
    id: 'evening-sleep-rules',
    paragraphs: [
      'Вечерние правила нужны только для подсказок. Они не меняют записи сна и не являются нормой, которую нужно соблюдать каждый день.',
      'Микро-сон — короткий сон-мостик, если дневные сны уже закончились, а до отбоя ещё слишком долго.',
      'Время “не позже” помогает приложению не предлагать поздний сон, когда спокойнее двигаться к раннему отбою.',
      'Максимум короткого вечернего сна отделяет небольшой вечерний сон от полноценного сна, который может сдвинуть ночь.',
      'Если семья не использует микро-сны, можно поставить 0 минут. Остальные значения лучше менять только если вечерние подсказки регулярно не подходят вашему ребёнку.',
    ],
    subtitle: 'Как микро-сон и вечерние ограничения влияют на подсказки.',
    title: 'Вечерние сны и микро-сон',
  },
];

interface ArticleItemProps {
  article: InfoArticle;
  isOpen: boolean;
  onToggle: () => void;
}

function isInfoArticleId(value: unknown): value is InfoArticleId {
  return (
    value === 'night-sleep' ||
    value === 'night-forecast' ||
    value === 'official-sleep-guidelines' ||
    value === 'practical-sleep-guidelines' ||
    value === 'wake-window-guidelines' ||
    value === 'evening-sleep-rules' ||
    value === 'scientific-evidence'
  );
}

function ArticleItem({ article, isOpen, onToggle }: ArticleItemProps) {
  return (
    <View style={[styles.articleItem, isOpen ? styles.articleItemOpen : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.articleButton,
          pressed ? styles.articleButtonPressed : null,
        ]}>
        <View style={styles.articleButtonTextBlock}>
          <Text style={styles.articleTitle}>{article.title}</Text>
          <Text style={styles.articleSubtitle}>{article.subtitle}</Text>
        </View>
        <Text style={styles.articleArrow}>{isOpen ? 'v' : '>'}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.articleBody}>
          {article.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {article.table ? (
            <View style={styles.articleTable}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {article.table.columns.map((column) => (
                  <Text key={column} style={[styles.tableCell, styles.tableHeaderCell]}>
                    {column}
                  </Text>
                ))}
              </View>
              {article.table.rows.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  {row.cells.map((cell) => (
                    <Text key={cell} style={styles.tableCell}>
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function InfoScreen() {
  const params = useLocalSearchParams<{ article?: string }>();
  const [openArticleId, setOpenArticleId] = useState<InfoArticleId | null>(null);

  useEffect(() => {
    if (isInfoArticleId(params.article)) {
      setOpenArticleId(params.article);
    }
  }, [params.article]);

  function toggleArticle(articleId: InfoArticleId) {
    setOpenArticleId((currentArticleId) =>
      currentArticleId === articleId ? null : articleId,
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Справка' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Как работает приложение</Text>
            <Text style={styles.subtitle}>
              Информация о расчётах, правилах и подсказках.
            </Text>
          </View>

          <View style={styles.articleList}>
            {INFO_ARTICLES.map((article) => (
              <ArticleItem
                article={article}
                isOpen={openArticleId === article.id}
                key={article.id}
                onToggle={() => toggleArticle(article.id)}
              />
            ))}
          </View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  articleList: {
    gap: spacing.sm,
  },
  articleItem: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  articleItemOpen: {
    borderColor: colors.primary,
  },
  articleButton: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  articleButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  articleButtonTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  articleTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  articleSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  articleArrow: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  articleBody: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  articleTable: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tableRow: {
    minHeight: 42,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHeaderRow: {
    borderTopWidth: 0,
    backgroundColor: colors.primarySoft,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  tableHeaderCell: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
});
