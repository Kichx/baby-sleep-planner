import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import {
  OFFICIAL_SLEEP_GUIDELINES,
  formatDurationRangeShort,
} from '@/core/officialSleepGuidelines';

type InfoArticleId = 'night-sleep' | 'night-forecast' | 'official-sleep-guidelines';

interface InfoArticleTable {
  columns: [string, string];
  rows: {
    cells: [string, string];
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
      'Официальные источники дают возрастные диапазоны суммарного сна за 24 часа. В этот сон входят и ночной сон, и дневные сны.',
      'Для младенцев 4–11 месяцев ориентир обычно составляет 12–16 часов сна за сутки, для детей 1–2 лет — 11–14 часов.',
      'В приложении используются ориентиры ВОЗ, CDC, AASM, Australian 24-Hour Movement Guidelines и Canadian 24-Hour Movement Guidelines.',
      'Эти источники не задают точное количество дневных снов и окна бодрствования. Поэтому приложение использует официальные нормы как рамку безопасности, а дневной график и подсказки строит отдельно — по параметрам плана и фактическим записям сна.',
      'Один день вне диапазона не означает проблему. Сон ребёнка может меняться из-за самочувствия, поездок, скачков развития и других факторов. Если сильные отклонения повторяются часто или ребёнок выглядит необычно вялым/плохо себя чувствует, лучше обсудить это с врачом.',
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
    title: 'Официальные нормы сна',
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
    value === 'official-sleep-guidelines'
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
