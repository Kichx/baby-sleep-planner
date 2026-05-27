import { useState } from 'react';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

type InfoArticleId = 'night-sleep' | 'night-forecast';

interface InfoArticle {
  id: InfoArticleId;
  paragraphs: string[];
  subtitle: string;
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
];

interface ArticleItemProps {
  article: InfoArticle;
  isOpen: boolean;
  onToggle: () => void;
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
        </View>
      ) : null}
    </View>
  );
}

export default function InfoScreen() {
  const [openArticleId, setOpenArticleId] = useState<InfoArticleId | null>(null);

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
});
