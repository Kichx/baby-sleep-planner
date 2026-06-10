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
import { BottleFeedingIcon } from '@/components/BottleFeedingIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
} from '@/constants/bottleFeeding';
import { colors, radius, spacing } from '@/constants/theme';
import {
  BOTTLE_FEEDING_EMPTY_TEXT,
  buildBottleFeedingDailyTrend,
  calculateBottleFeedingDailyTrendAverages,
  calculateBottleFeedingStats,
  formatBottleFeedingCount,
  formatBottleFeedingDailyTrendAverageCountLine,
  formatBottleFeedingDailyTrendAverageVolumeLine,
  formatBottleFeedingRecordLine,
  formatBottleFeedingStatsLine,
  formatLatestBottleFeedingLine,
  getBottleFeedingCalendarDayRange,
  getLast24HoursBottleFeedingRange,
  getBottleFeedingTrendDateRange,
  isBottleFeedingTopUp,
  type BottleFeedingDailyTrendPoint,
} from '@/core/bottleFeeding';
import {
  addLocalCalendarDays,
  dateAtLocalNoon,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
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

type FeedingTrendPeriodDays = 7 | 14 | 30;

interface FeedingDayGroup {
  feedings: BottleFeeding[];
  key: string;
  subtitle: string;
  title: string;
}

const HOME_ROUTE = '/' as Href;
const BOTTLE_FEEDING_SETTINGS_ROUTE = '/bottle-feeding-settings' as Href;
const DEFAULT_TREND_PERIOD_DAYS: FeedingTrendPeriodDays = 7;
const TREND_PERIOD_OPTIONS = [7, 14, 30] as const satisfies readonly FeedingTrendPeriodDays[];
const TREND_CHART_HEIGHT = 116;
const TREND_CHART_VERTICAL_PADDING = 12;
const TREND_BAR_MAX_HEIGHT = 82;
const TREND_MIN_VISIBLE_BAR_HEIGHT = 4;
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

function formatDateLabel(date: Date): string {
  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'long',
  });
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return startOfLocalCalendarDay(first).getTime() === startOfLocalCalendarDay(second).getTime();
}

function formatSelectedDayTitle(selectedDate: Date, now: Date): string {
  const dayDiff = getLocalCalendarDayDiff(selectedDate, now);

  if (dayDiff === 0) {
    return 'Сегодня';
  }

  if (dayDiff === -1) {
    return `Вчера, ${formatDateLabel(selectedDate)}`;
  }

  if (dayDiff === -2) {
    return `Позавчера, ${formatDateLabel(selectedDate)}`;
  }

  if (dayDiff === 1) {
    return `Завтра, ${formatDateLabel(selectedDate)}`;
  }

  return formatDateLabel(selectedDate);
}

function formatSelectedDayShortTitle(selectedDate: Date, now: Date): string {
  const dayDiff = getLocalCalendarDayDiff(selectedDate, now);

  if (dayDiff === 0) {
    return 'Сегодня';
  }

  if (dayDiff === -1) {
    return 'Вчера';
  }

  if (dayDiff === -2) {
    return 'Позавчера';
  }

  return 'Выбранный день';
}

function formatTrendDateLabel(date: Date): string {
  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'short',
  });
}

function formatTrendPeriodLabel(periodDays: FeedingTrendPeriodDays): string {
  return `За ${periodDays} дней`;
}

type FeedingTrendMetric = 'volume' | 'count';

function getTrendTotalStats(points: readonly BottleFeedingDailyTrendPoint[]): BottleFeedingStats {
  return points.reduce<BottleFeedingStats>(
    (stats, point) => ({
      count: stats.count + point.count,
      totalVolumeMl: stats.totalVolumeMl + point.totalVolumeMl,
    }),
    EMPTY_BOTTLE_FEEDING_STATS,
  );
}

function getTrendMetricValue(
  point: BottleFeedingDailyTrendPoint,
  metric: FeedingTrendMetric,
): number {
  return metric === 'volume' ? point.totalVolumeMl : point.count;
}

function getMaxTrendMetric(
  points: readonly BottleFeedingDailyTrendPoint[],
  metric: FeedingTrendMetric,
): number {
  const maxValue = Math.max(0, ...points.map((point) => getTrendMetricValue(point, metric)));

  if (maxValue <= 0 || metric === 'count') {
    return maxValue;
  }

  const step = maxValue <= 300 ? 50 : maxValue <= 1000 ? 100 : 200;

  return Math.ceil(maxValue / step) * step;
}

function getTrendScaleLabels(maxValue: number): [string, string, string] {
  if (maxValue <= 0) {
    return ['', '', '0'];
  }

  if (maxValue === 1) {
    return ['1', '', '0'];
  }

  return [String(maxValue), String(Math.ceil(maxValue / 2)), '0'];
}

function getTrendMetricBarHeight(value: number, maxValue: number): number {
  if (value <= 0) {
    return 0;
  }

  return Math.max(
    TREND_MIN_VISIBLE_BAR_HEIGHT,
    Math.round((value / Math.max(1, maxValue)) * TREND_BAR_MAX_HEIGHT),
  );
}

function formatTrendMetricSummary(
  points: readonly BottleFeedingDailyTrendPoint[],
  metric: FeedingTrendMetric,
  isLoading: boolean,
): string {
  const totalStats = getTrendTotalStats(points);

  if (totalStats.count <= 0) {
    return isLoading ? 'Загрузка' : 'Пока нет записей';
  }

  if (metric === 'volume') {
    return `${totalStats.totalVolumeMl} мл`;
  }

  return formatBottleFeedingCount(totalStats.count);
}

function formatTrendMetricAverage(
  points: readonly BottleFeedingDailyTrendPoint[],
  metric: FeedingTrendMetric,
): string | null {
  const averages = calculateBottleFeedingDailyTrendAverages(points);

  if (metric === 'volume') {
    return formatBottleFeedingDailyTrendAverageVolumeLine(averages);
  }

  return formatBottleFeedingDailyTrendAverageCountLine(averages);
}

function FeedingTrendMetricChart({
  isLoading,
  metric,
  points,
  title,
  unitLabel,
}: {
  isLoading: boolean;
  metric: FeedingTrendMetric;
  points: BottleFeedingDailyTrendPoint[];
  title: string;
  unitLabel: string;
}) {
  const maxValue = getMaxTrendMetric(points, metric);
  const scaleLabels = getTrendScaleLabels(maxValue);
  const summaryLine = formatTrendMetricSummary(points, metric, isLoading);
  const averageLine = formatTrendMetricAverage(points, metric);
  const barFillStyle =
    metric === 'volume' ? styles.trendMetricBarFillVolume : styles.trendMetricBarFillCount;

  return (
    <View style={styles.trendMetricCard}>
      <View style={styles.trendMetricHeader}>
        <View style={styles.trendMetricTitleBlock}>
          <Text style={styles.trendMetricTitle}>{title}</Text>
          <Text style={styles.trendMetricSubtitle}>{unitLabel}</Text>
        </View>
        <View style={styles.trendMetricSummaryBlock}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.trendMetricSummary}>
            {summaryLine}
          </Text>
          {averageLine ? (
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.trendMetricAverage}>
              {averageLine}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.trendMetricBody}>
        <View style={styles.trendMetricScale}>
          {scaleLabels.map((label, index) => (
            <Text key={`${metric}-scale-${index}`} numberOfLines={1} style={styles.trendMetricScaleLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.trendMetricPlot}>
          <View style={styles.trendGridLineTop} />
          <View style={styles.trendGridLineMiddle} />
          <View style={styles.trendGridLineBottom} />
          <View style={styles.trendBarsLayer}>
            {points.map((point) => {
              const value = getTrendMetricValue(point, metric);
              const barHeight = getTrendMetricBarHeight(value, maxValue);

              return (
                <View key={`${metric}-${point.date.toISOString()}`} style={styles.trendBarColumn}>
                  <View style={styles.trendBarTrack}>
                    {barHeight > 0 ? (
                      <View style={[styles.trendBarFill, barFillStyle, { height: barHeight }]} />
                    ) : (
                      <View style={styles.trendBarEmpty} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function FeedingTrendChart({
  isLoading,
  onSelectPeriodDays,
  periodDays,
  points,
}: {
  isLoading: boolean;
  onSelectPeriodDays: (periodDays: FeedingTrendPeriodDays) => void;
  periodDays: FeedingTrendPeriodDays;
  points: BottleFeedingDailyTrendPoint[];
}) {
  const firstPoint = points[0] ?? null;
  const middlePoint = points.length > 0 ? points[Math.floor((points.length - 1) / 2)] : null;
  const lastPoint = points[points.length - 1] ?? null;

  return (
    <View style={styles.trendPanel}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <Text style={styles.trendTitle}>Графики кормлений</Text>
          <Text style={styles.trendSubtitle}>{formatTrendPeriodLabel(periodDays)}</Text>
          <Text style={styles.trendAverageHint}>Среднее по дням с записями</Text>
        </View>
        <View style={styles.trendPeriodSelector}>
          {TREND_PERIOD_OPTIONS.map((option) => {
            const isSelected = periodDays === option;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={option}
                onPress={() => onSelectPeriodDays(option)}
                style={({ pressed }) => [
                  styles.trendPeriodButton,
                  isSelected ? styles.trendPeriodButtonSelected : null,
                  pressed ? styles.trendPeriodButtonPressed : null,
                ]}>
                <Text
                  style={[
                    styles.trendPeriodButtonText,
                    isSelected ? styles.trendPeriodButtonTextSelected : null,
                  ]}>
                  {option} дней
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FeedingTrendMetricChart
        isLoading={isLoading}
        metric="volume"
        points={points}
        title="Объём"
        unitLabel="мл за день"
      />

      <FeedingTrendMetricChart
        isLoading={isLoading}
        metric="count"
        points={points}
        title="Количество"
        unitLabel="кормлений за день"
      />

      <View style={styles.trendDateRow}>
        <View style={styles.trendScaleSpacer} />
        <View style={styles.trendAxisLabels}>
          <Text numberOfLines={1} style={styles.trendAxisLabel}>
            {firstPoint ? formatTrendDateLabel(firstPoint.date) : ''}
          </Text>
          <Text numberOfLines={1} style={styles.trendAxisLabel}>
            {middlePoint ? formatTrendDateLabel(middlePoint.date) : ''}
          </Text>
          <Text numberOfLines={1} style={[styles.trendAxisLabel, styles.trendAxisLabelRight]}>
            {lastPoint ? formatTrendDateLabel(lastPoint.date) : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function BottleFeedingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [latestFeeding, setLatestFeeding] = useState<BottleFeeding | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedDayStats, setSelectedDayStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [last24HoursStats, setLast24HoursStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [selectedDayFeedings, setSelectedDayFeedings] = useState<BottleFeeding[]>([]);
  const [trendPeriodDays, setTrendPeriodDays] = useState<FeedingTrendPeriodDays>(
    DEFAULT_TREND_PERIOD_DAYS,
  );
  const [trendFeedings, setTrendFeedings] = useState<BottleFeeding[]>([]);
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
    async (referenceDate: Date, loadedAt: Date, shouldApply: () => boolean) => {
      setIsLoading(true);

      try {
        const profile = await getChildProfile(db);

        if (!profile.bottleFeedingEnabled) {
          if (shouldApply()) {
            setIsBottleFeedingAvailable(false);
            setLatestFeeding(null);
            setSelectedDayStats(EMPTY_BOTTLE_FEEDING_STATS);
            setLast24HoursStats(EMPTY_BOTTLE_FEEDING_STATS);
            setSelectedDayFeedings([]);
            setTrendFeedings([]);
            setDefaultVolumeMl(DEFAULT_BOTTLE_FEEDING_VOLUME_ML);
            setTopUpThresholdMl(DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML);
            router.replace(HOME_ROUTE);
          }

          return;
        }

        if (shouldApply()) {
          setIsBottleFeedingAvailable(true);
        }

        const selectedDayRange = getBottleFeedingCalendarDayRange(referenceDate);
        const last24HoursRange = getLast24HoursBottleFeedingRange(loadedAt);
        const trendRange = getBottleFeedingTrendDateRange(loadedAt, trendPeriodDays);
        const [loadedLatestFeeding, selectedFeedings, last24HourFeedings, loadedTrendFeedings] =
          await Promise.all([
            getLatestBottleFeeding(db),
            listBottleFeedingsInRange(db, selectedDayRange.start, selectedDayRange.end),
            listBottleFeedingsInRange(db, last24HoursRange.start, last24HoursRange.end),
            listBottleFeedingsInRange(db, trendRange.start, trendRange.end),
          ]);

        if (shouldApply()) {
          setLatestFeeding(loadedLatestFeeding);
          setSelectedDayStats(calculateBottleFeedingStats(selectedFeedings));
          setLast24HoursStats(calculateBottleFeedingStats(last24HourFeedings));
          setSelectedDayFeedings(sortFeedingsNewestFirst(selectedFeedings));
          setTrendFeedings(loadedTrendFeedings);
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
    [db, router, trendPeriodDays],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadFeedings(selectedDate, new Date(), () => isActive);

      return () => {
        isActive = false;
      };
    }, [loadFeedings, selectedDate]),
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
    await loadFeedings(selectedDate, currentNow, () => true);
  }

  function openCreateEditor() {
    const isTodaySelected = isSameCalendarDay(selectedDate, now);

    setEditorState({
      feeding: null,
      mode: 'create',
      referenceDate: isTodaySelected ? new Date() : dateAtLocalNoon(selectedDate),
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

  function selectFeedingDate(date: Date) {
    setSelectedDayStats(EMPTY_BOTTLE_FEEDING_STATS);
    setSelectedDayFeedings([]);
    setSelectedDate(date);
  }

  function selectTrendPeriodDays(periodDays: FeedingTrendPeriodDays) {
    setTrendFeedings([]);
    setTrendPeriodDays(periodDays);
  }

  function selectQuickDate(dayOffset: -1 | 0) {
    selectFeedingDate(dayOffset === 0 ? new Date() : addLocalCalendarDays(now, dayOffset));
  }

  function goToPreviousDay() {
    selectFeedingDate(addLocalCalendarDays(selectedDate, -1));
  }

  function goToNextDay() {
    if (!canGoForward) {
      return;
    }

    selectFeedingDate(addLocalCalendarDays(selectedDate, 1));
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

  const selectedDayTitle = useMemo(
    () => formatSelectedDayTitle(selectedDate, now),
    [now, selectedDate],
  );
  const selectedDayShortTitle = useMemo(
    () => formatSelectedDayShortTitle(selectedDate, now),
    [now, selectedDate],
  );
  const canGoForward = useMemo(
    () =>
      startOfLocalCalendarDay(selectedDate).getTime() < startOfLocalCalendarDay(now).getTime(),
    [now, selectedDate],
  );
  const feedingDayGroups = useMemo<FeedingDayGroup[]>(() => {
    return [
      {
        feedings: selectedDayFeedings,
        key: 'selected',
        subtitle: formatDateLabel(selectedDate),
        title: selectedDayShortTitle,
      },
    ];
  }, [selectedDate, selectedDayFeedings, selectedDayShortTitle]);
  const displayedFeedingCount = feedingDayGroups.reduce(
    (total, group) => total + group.feedings.length,
    0,
  );
  const displayedFeedingCountLabel =
    displayedFeedingCount === 0
      ? 'нет записей'
      : `Всего ${formatBottleFeedingCount(displayedFeedingCount)}`;
  const trendPoints = useMemo(
    () => buildBottleFeedingDailyTrend(trendFeedings, now, trendPeriodDays),
    [now, trendFeedings, trendPeriodDays],
  );

  function renderDateShortcut(label: string, dayOffset: -1 | 0) {
    const targetDate = dayOffset === 0 ? now : addLocalCalendarDays(now, dayOffset);
    const isActive = isSameCalendarDay(targetDate, selectedDate);

    return (
      <Pressable
        accessibilityRole="button"
        hitSlop={4}
        key={label}
        onPress={() => selectQuickDate(dayOffset)}
        style={({ pressed }) => [
          styles.dateShortcut,
          isActive ? styles.activeDateShortcut : null,
          pressed ? styles.dateShortcutPressed : null,
        ]}>
        <Text style={[styles.dateShortcutText, isActive ? styles.activeDateShortcutText : null]}>
          {label}
        </Text>
      </Pressable>
    );
  }

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

          <View style={styles.datePickerBlock}>
            <View style={styles.dayNavigator}>
              <Pressable
                accessibilityLabel="Предыдущий день кормлений"
                accessibilityRole="button"
                hitSlop={4}
                onPress={goToPreviousDay}
                style={({ pressed }) => [
                  styles.dayArrow,
                  pressed ? styles.dayArrowPressed : null,
                ]}>
                <Text style={styles.dayArrowText}>{'<'}</Text>
              </Pressable>
              <Text numberOfLines={1} style={styles.dayTitle}>
                {selectedDayTitle}
              </Text>
              <Pressable
                accessibilityLabel="Следующий день кормлений"
                accessibilityRole="button"
                disabled={!canGoForward}
                hitSlop={4}
                onPress={goToNextDay}
                style={({ pressed }) => [
                  styles.dayArrow,
                  pressed && canGoForward ? styles.dayArrowPressed : null,
                  !canGoForward ? styles.dayArrowDisabled : null,
                ]}>
                <Text
                  style={[
                    styles.dayArrowText,
                    !canGoForward ? styles.dayArrowTextDisabled : null,
                  ]}>
                  {'>'}
                </Text>
              </Pressable>
              {renderDateShortcut('Сегодня', 0)}
              {renderDateShortcut('Вчера', -1)}
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsBlock}>
              <Text style={styles.statsTitle}>{selectedDayShortTitle}</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statsValue}>
                {formatBottleFeedingStatsLine(selectedDayStats)}
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
              <Text style={styles.timelineTitle}>Всё по порядку</Text>
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
                          styles.selectedFeedDayMarker,
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
                            pressed ? styles.feedRowPressed : null,
                          ]}>
                          <BottleFeedingIcon variant="timeline" />
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

          <FeedingTrendChart
            isLoading={isLoading}
            onSelectPeriodDays={selectTrendPeriodDays}
            periodDays={trendPeriodDays}
            points={trendPoints}
          />
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
  datePickerBlock: {
    minHeight: 34,
  },
  dayNavigator: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayArrowPressed: {
    backgroundColor: colors.primarySoft,
  },
  dayArrowDisabled: {
    opacity: 0.45,
  },
  dayArrowText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  dayArrowTextDisabled: {
    color: colors.textMuted,
  },
  dayTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
  },
  dateShortcut: {
    minWidth: 72,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeDateShortcut: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dateShortcutPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dateShortcutText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  activeDateShortcutText: {
    color: colors.primary,
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
  trendPanel: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  trendHeader: {
    minHeight: 42,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trendTitleBlock: {
    flex: 1,
    minWidth: 118,
    gap: spacing.xs,
  },
  trendTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  trendSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  trendAverageHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  trendPeriodSelector: {
    minHeight: 36,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  trendPeriodButton: {
    minWidth: 68,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
  },
  trendPeriodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  trendPeriodButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  trendPeriodButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  trendPeriodButtonTextSelected: {
    color: colors.primary,
  },
  trendMetricCard: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  trendMetricHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trendMetricTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trendMetricTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  trendMetricSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  trendMetricSummaryBlock: {
    maxWidth: '44%',
    minWidth: 98,
    alignItems: 'flex-end',
    flexShrink: 1,
    gap: 2,
  },
  trendMetricSummary: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  trendMetricAverage: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  trendMetricBody: {
    height: TREND_CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  trendMetricScale: {
    width: 34,
    justifyContent: 'space-between',
    paddingVertical: TREND_CHART_VERTICAL_PADDING - 1,
  },
  trendMetricScaleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  trendMetricPlot: {
    flex: 1,
    minWidth: 0,
    height: TREND_CHART_HEIGHT,
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  trendGridLineTop: {
    position: 'absolute',
    top: TREND_CHART_VERTICAL_PADDING,
    right: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  trendGridLineMiddle: {
    position: 'absolute',
    top: Math.round(TREND_CHART_HEIGHT / 2),
    right: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.55,
  },
  trendGridLineBottom: {
    position: 'absolute',
    right: 0,
    bottom: TREND_CHART_VERTICAL_PADDING,
    left: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  trendBarsLayer: {
    position: 'absolute',
    right: spacing.xs,
    bottom: TREND_CHART_VERTICAL_PADDING,
    left: spacing.xs,
    height: TREND_BAR_MAX_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  trendBarColumn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBarTrack: {
    minHeight: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trendBarFill: {
    width: '70%',
    minWidth: 3,
    maxWidth: 18,
    borderRadius: 7,
  },
  trendMetricBarFillVolume: {
    backgroundColor: colors.primarySoft,
  },
  trendMetricBarFillCount: {
    backgroundColor: colors.primary,
  },
  trendBarEmpty: {
    width: '44%',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  trendDateRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendScaleSpacer: {
    width: 34,
  },
  trendAxisLabels: {
    flex: 1,
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  trendAxisLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  trendAxisLabelRight: {
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
  selectedFeedDayMarker: {
    backgroundColor: colors.primary,
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
