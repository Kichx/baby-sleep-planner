import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottleFeedingEditorModal } from '@/components/BottleFeedingEditorModal';
import { EventTypeBadge } from '@/components/EventTypeBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
} from '@/constants/bottleFeeding';
import { colors, radius, spacing } from '@/constants/theme';
import {
  BOTTLE_FEEDING_EMPTY_TEXT,
  calculateBottleFeedingStats,
  formatBottleFeedingCount,
  formatBottleFeedingRecordLine,
  formatBottleFeedingStatsLine,
  formatLatestBottleFeedingLine,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
  isBottleFeedingTopUp,
} from '@/core/bottleFeeding';
import {
  addLocalCalendarDays,
  formatLocalDateLabel,
  startOfLocalCalendarDay,
} from '@/core/localDateTime';
import {
  createBottleFeeding,
  deleteBottleFeeding,
  getChildProfile,
  getLatestBottleFeeding,
  listBottleFeedingsInRange,
  updateBottleFeeding,
} from '@/db';
import { syncSleepNotificationsFromDatabase } from '@/notifications/sleepNotifications';
import type { BottleFeeding, BottleFeedingStats } from '@/types/bottleFeeding';

type BottleFeedingEditorState =
  | {
      mode: 'create';
      feeding: null;
      referenceDate: Date;
    }
  | {
      mode: 'edit';
      feeding: BottleFeeding;
      referenceDate: Date;
    };

interface FeedingDayGroup {
  feedings: BottleFeeding[];
  key: 'today' | 'yesterday';
  subtitle: string;
  title: string;
}

const HOME_ROUTE = '/' as Href;
const BOTTLE_FEEDING_SETTINGS_ROUTE = '/bottle-feeding-settings' as Href;
const EMPTY_BOTTLE_FEEDING_STATS: BottleFeedingStats = {
  count: 0,
  totalVolumeMl: 0,
};

function sortFeedingsNewestFirst(feedings: BottleFeeding[]): BottleFeeding[] {
  return [...feedings].sort(
    (first, second) =>
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime(),
  );
}

function bottleFeedingStartsInRange(
  feeding: BottleFeeding,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const startedAt = new Date(feeding.startedAt);

  return startedAt.getTime() >= rangeStart.getTime() && startedAt.getTime() < rangeEnd.getTime();
}

function formatDateLabel(date: Date): string {
  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'long',
  });
}

export default function BottleFeedingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [latestFeeding, setLatestFeeding] = useState<BottleFeeding | null>(null);
  const [todayStats, setTodayStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [last24HoursStats, setLast24HoursStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [todayFeedings, setTodayFeedings] = useState<BottleFeeding[]>([]);
  const [yesterdayFeedings, setYesterdayFeedings] = useState<BottleFeeding[]>([]);
  const [timelineReferenceDate, setTimelineReferenceDate] = useState(() => new Date());
  const [defaultVolumeMl, setDefaultVolumeMl] = useState(DEFAULT_BOTTLE_FEEDING_VOLUME_ML);
  const [topUpThresholdMl, setTopUpThresholdMl] = useState(
    DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  );
  const [isBottleFeedingAvailable, setIsBottleFeedingAvailable] = useState<boolean | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<BottleFeedingEditorState | null>(null);

  const loadFeedings = useCallback(
    async (loadedAt: Date, shouldApply: () => boolean) => {
      setIsLoading(true);

      try {
        const profile = await getChildProfile(db);

        if (!profile.bottleFeedingEnabled) {
          if (shouldApply()) {
            setIsBottleFeedingAvailable(false);
            setLatestFeeding(null);
            setTodayStats(EMPTY_BOTTLE_FEEDING_STATS);
            setLast24HoursStats(EMPTY_BOTTLE_FEEDING_STATS);
            setTodayFeedings([]);
            setYesterdayFeedings([]);
            setDefaultVolumeMl(DEFAULT_BOTTLE_FEEDING_VOLUME_ML);
            setTopUpThresholdMl(DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML);
            router.replace(HOME_ROUTE);
          }

          return;
        }

        if (shouldApply()) {
          setIsBottleFeedingAvailable(true);
        }

        const todayRange = getTodayBottleFeedingRange(loadedAt);
        const yesterdayStart = startOfLocalCalendarDay(addLocalCalendarDays(loadedAt, -1));
        const last24HoursRange = getLast24HoursBottleFeedingRange(loadedAt);
        const [loadedLatestFeeding, twoDayFeedings, last24HourFeedings] =
          await Promise.all([
            getLatestBottleFeeding(db),
            listBottleFeedingsInRange(db, yesterdayStart, todayRange.end),
            listBottleFeedingsInRange(db, last24HoursRange.start, last24HoursRange.end),
          ]);
        const loadedTodayFeedings = twoDayFeedings.filter((feeding) =>
          bottleFeedingStartsInRange(feeding, todayRange.start, todayRange.end),
        );
        const loadedYesterdayFeedings = twoDayFeedings.filter((feeding) =>
          bottleFeedingStartsInRange(feeding, yesterdayStart, todayRange.start),
        );

        if (shouldApply()) {
          setLatestFeeding(loadedLatestFeeding);
          setTodayStats(calculateBottleFeedingStats(loadedTodayFeedings));
          setLast24HoursStats(calculateBottleFeedingStats(last24HourFeedings));
          setTodayFeedings(sortFeedingsNewestFirst(loadedTodayFeedings));
          setYesterdayFeedings(sortFeedingsNewestFirst(loadedYesterdayFeedings));
          setTimelineReferenceDate(loadedAt);
          setDefaultVolumeMl(profile.bottleFeedingDefaultVolumeMl);
          setTopUpThresholdMl(profile.bottleFeedingTopUpThresholdMl);
          setNow(loadedAt);
          setErrorMessage(null);
        }
      } catch {
        if (shouldApply()) {
          setErrorMessage('Не удалось загрузить кормления');
        }
      } finally {
        if (shouldApply()) {
          setIsLoading(false);
        }
      }
    },
    [db, router],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadFeedings(new Date(), () => isActive);

      return () => {
        isActive = false;
      };
    }, [loadFeedings]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  async function reloadCurrentPeriod(currentNow = new Date()) {
    await loadFeedings(currentNow, () => true);
  }

  function openCreateEditor() {
    setEditorState({
      feeding: null,
      mode: 'create',
      referenceDate: new Date(),
    });
  }

  function openEditEditor(feeding: BottleFeeding) {
    setEditorState({
      feeding,
      mode: 'edit',
      referenceDate: new Date(feeding.startedAt),
    });
  }

  function openSettingsScreen() {
    router.push(BOTTLE_FEEDING_SETTINGS_ROUTE);
  }

  async function handleEditorSave(input: { startedAt: Date; volumeMl: number }) {
    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (editorState?.mode === 'edit') {
        await updateBottleFeeding(db, editorState.feeding.id, input);
      } else {
        await createBottleFeeding(db, input);
      }

      await syncSleepNotificationsFromDatabase(db, actionAt);
      await reloadCurrentPeriod(actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось сохранить кормление');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditorDelete() {
    if (editorState?.mode !== 'edit') {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await deleteBottleFeeding(db, editorState.feeding.id);
      await syncSleepNotificationsFromDatabase(db, actionAt);
      await reloadCurrentPeriod(actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось удалить кормление');
    } finally {
      setIsSaving(false);
    }
  }

  const feedingDayGroups = useMemo<FeedingDayGroup[]>(() => {
    const yesterdayDate = addLocalCalendarDays(timelineReferenceDate, -1);

    return [
      {
        feedings: todayFeedings,
        key: 'today',
        subtitle: formatDateLabel(timelineReferenceDate),
        title: 'Сегодня',
      },
      {
        feedings: yesterdayFeedings,
        key: 'yesterday',
        subtitle: formatDateLabel(yesterdayDate),
        title: 'Вчера',
      },
    ];
  }, [timelineReferenceDate, todayFeedings, yesterdayFeedings]);
  const displayedFeedingCount = feedingDayGroups.reduce(
    (total, group) => total + group.feedings.length,
    0,
  );
  const displayedFeedingCountLabel =
    displayedFeedingCount === 0
      ? 'нет записей'
      : `Всего ${formatBottleFeedingCount(displayedFeedingCount)}`;

  if (isBottleFeedingAvailable !== true) {
    return <Stack.Screen options={{ title: 'Кормление' }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Кормление' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.latestBlock}>
            <Text style={styles.blockTitle}>Последнее кормление</Text>
            {latestFeeding ? (
              <Text style={styles.latestElapsed}>
                {formatLatestBottleFeedingLine(latestFeeding, now)}
              </Text>
            ) : (
              <Text style={styles.emptyLatest}>{BOTTLE_FEEDING_EMPTY_TEXT}</Text>
            )}
            <PrimaryButton
              compact
              disabled={isLoading || isSaving}
              label="+ Добавить кормление"
              onPress={openCreateEditor}
              style={styles.addButton}
              textStyle={styles.addButtonText}
            />
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsBlock}>
              <Text style={styles.statsTitle}>Сегодня</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statsValue}>
                {formatBottleFeedingStatsLine(todayStats)}
              </Text>
            </View>
            <View style={styles.statsBlock}>
              <Text style={styles.statsTitle}>24 часа</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statsValue}>
                {formatBottleFeedingStatsLine(last24HoursStats)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Открыть настройки кормления. Объём по умолчанию, доешка и напоминания."
            onPress={openSettingsScreen}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed ? styles.settingsButtonPressed : null,
            ]}>
            <View style={styles.settingsButtonTextBlock}>
              <Text style={styles.settingsButtonTitle}>Настройки кормления</Text>
              <Text style={styles.settingsButtonDescription}>
                Объём по умолчанию, доешка и напоминания
              </Text>
            </View>
            <Text style={styles.settingsButtonAction}>Открыть</Text>
          </Pressable>

          <View style={styles.timelineSection}>
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineTitle}>Таймлайн</Text>
              <Text style={styles.timelineMeta}>{displayedFeedingCountLabel}</Text>
            </View>
            <View style={styles.feedList}>
              {feedingDayGroups.map((group) => (
                <View key={group.key} style={styles.feedDayGroup}>
                  <View style={styles.feedDayHeader}>
                    <View style={styles.feedDayTitleRow}>
                      <View
                        style={[
                          styles.feedDayMarker,
                          group.key === 'today'
                            ? styles.todayFeedDayMarker
                            : styles.yesterdayFeedDayMarker,
                        ]}
                      />
                      <View>
                        <Text style={styles.feedDayTitle}>{group.title}</Text>
                        <Text style={styles.feedDaySubtitle}>{group.subtitle}</Text>
                      </View>
                    </View>
                    <Text style={styles.feedDayCount}>
                      {group.feedings.length === 0
                        ? 'нет'
                        : formatBottleFeedingCount(group.feedings.length)}
                    </Text>
                  </View>

                  {group.feedings.length === 0 ? (
                    <Text style={styles.emptyList}>{BOTTLE_FEEDING_EMPTY_TEXT}</Text>
                  ) : (
                    group.feedings.map((feeding) => {
                      const recordLine = formatBottleFeedingRecordLine(feeding);
                      const isTopUp = isBottleFeedingTopUp(feeding, topUpThresholdMl);

                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Редактировать кормление ${recordLine}${
                            isTopUp ? ', доешка' : ''
                          }`}
                          key={feeding.id}
                          onPress={() => openEditEditor(feeding)}
                          style={({ pressed }) => [
                            styles.feedRow,
                            group.key === 'yesterday' ? styles.yesterdayFeedRow : null,
                            pressed ? styles.feedRowPressed : null,
                          ]}>
                          <EventTypeBadge kind="bottleFeeding" quiet />
                          <Text numberOfLines={1} style={styles.feedRowText}>
                            {recordLine}
                          </Text>
                          {isTopUp ? <Text style={styles.topUpBadge}>Доешка</Text> : null}
                          <Text style={styles.feedRowAction}>Изменить</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>

      <BottleFeedingEditorModal
        defaultVolumeMl={defaultVolumeMl}
        feeding={editorState?.feeding ?? null}
        isSaving={isSaving}
        mode={editorState?.mode ?? 'create'}
        onClose={() => setEditorState(null)}
        onDelete={handleEditorDelete}
        onSave={handleEditorSave}
        referenceDate={editorState?.referenceDate ?? now}
        visible={editorState !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  latestBlock: {
    minHeight: 132,
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  blockTitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  latestElapsed: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  emptyLatest: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  addButton: {
    borderRadius: radius.sm,
  },
  addButtonText: {
    fontSize: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statsBlock: {
    flex: 1,
    minHeight: 74,
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  statsTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  statsValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  timelineSection: {
    gap: spacing.sm,
  },
  timelineHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  timelineMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  settingsButton: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  settingsButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  settingsButtonTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  settingsButtonTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  settingsButtonDescription: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  settingsButtonAction: {
    flexShrink: 0,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  reminderBlock: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  defaultVolumeBlock: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  reminderHeader: {
    minHeight: 42,
    justifyContent: 'center',
  },
  reminderTextBlock: {
    gap: spacing.xs,
  },
  reminderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  reminderDescription: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  settingRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  settingTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  settingTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  settingDescription: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  settingOptionsDisabled: {
    opacity: 0.48,
  },
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  intervalButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
  },
  intervalButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  intervalButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  intervalButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  intervalButtonTextSelected: {
    color: colors.primary,
  },
  customIntervalBlock: {
    gap: spacing.xs,
  },
  customIntervalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customIntervalInputGroup: {
    minHeight: 66,
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  compactLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  customIntervalInput: {
    minHeight: 30,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  customIntervalButton: {
    minWidth: 118,
    minHeight: 66,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  customIntervalButtonText: {
    fontSize: 14,
  },
  customIntervalSavedText: {
    paddingHorizontal: spacing.xs,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  feedList: {
    gap: spacing.lg,
  },
  feedDayGroup: {
    gap: spacing.sm,
  },
  feedDayHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  feedDayTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedDayMarker: {
    width: 5,
    height: 30,
    borderRadius: 3,
  },
  todayFeedDayMarker: {
    backgroundColor: colors.primary,
  },
  yesterdayFeedDayMarker: {
    backgroundColor: colors.border,
  },
  feedDayTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  feedDaySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  feedDayCount: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  feedRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  yesterdayFeedRow: {
    backgroundColor: colors.surfaceMuted,
  },
  feedRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  feedRowText: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  topUpBadge: {
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  feedRowAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyList: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
});
