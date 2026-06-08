import { useCallback, useMemo, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheetSafeArea } from '@/components/BottomSheetSafeArea';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SleepRetrospectiveIcon } from '@/components/SleepRetrospectiveIcon';
import { colors, radius, spacing } from '@/constants/theme';
import {
  addMinutes,
  buildSleepDaySummary,
  buildSleepTimelineSegments,
  dateAtMinutes,
} from '@/core/sleepCalculations';
import {
  addLocalCalendarDays,
  dateAtLocalNoon,
  formatLocalClock,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
} from '@/core/localDateTime';
import {
  buildSleepRetrospectiveDay,
  buildSleepRetrospectivePeriodSummary,
  buildSleepRetrospectivePeriodStats,
  type SleepRetrospectiveAwakeTrendPoint,
  type SleepRetrospectiveDay,
  type SleepRetrospectivePeriodStats,
  type SleepRetrospectiveStatus,
} from '@/core/sleepRetrospective';
import { buildEffectiveSleepDayPlan } from '@/core/sleepPlan';
import {
  dateFromSleepDayDateKey,
  formatSleepDayDateKey,
} from '@/core/sleepDay';
import { getActualWakeTimeForEarlyWakeMode } from '@/core/todayEffectiveSleepPlan';
import {
  ensureDefaultChildProfile,
  getSleepDayPlan,
  listSleepDayTemporaryModes,
  listSleepSessionsInRange,
} from '@/db';
import type { SleepDayPlan, SleepSession, SleepTimelineSegment, TargetDayPlan } from '@/types/sleep';

type PeriodDays = 7 | 14 | 21;

type RetrospectiveScreenDay = SleepRetrospectiveDay & {
  dateKey: string;
  timelineSegments: SleepTimelineSegment[];
};

const DAY_MINUTES = 24 * 60;
const PERIOD_OPTIONS: PeriodDays[] = [7, 14, 21];
const MIN_VISIBLE_BAR_PERCENT = 4;
const PLAN_SHIFT_TOLERANCE_MINUTES = 30;

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatCount(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;

  return `${value} ${suffix}`;
}

function formatNapCount(value: number): string {
  return formatCount(value, 'сон', 'сна', 'снов');
}

function formatClock(date: Date | null): string {
  return date ? formatLocalClock(date) : '--';
}

function formatChartDate(date: Date): string {
  return formatLocalDateLabel(date, { day: 'numeric', month: 'short' });
}

function formatAwakeDelta(deltaMinutes: number): string {
  if (Math.abs(deltaMinutes) <= 30) {
    return 'близко к плану';
  }

  const sign = deltaMinutes > 0 ? '+' : '-';

  return `${sign}${formatDuration(Math.abs(deltaMinutes))} к плану`;
}

function formatAwakeDeltaShort(deltaMinutes: number): string {
  if (Math.abs(deltaMinutes) <= 30) {
    return 'в плане';
  }

  const sign = deltaMinutes > 0 ? '+' : '-';

  return `${sign}${formatDuration(Math.abs(deltaMinutes))}`;
}

function formatSignedDuration(deltaMinutes: number): string {
  if (Math.abs(deltaMinutes) <= PLAN_SHIFT_TOLERANCE_MINUTES) {
    return 'в плане';
  }

  const sign = deltaMinutes > 0 ? '+' : '-';

  return `${sign}${formatDuration(Math.abs(deltaMinutes))}`;
}

function formatCardDate(date: Date, now: Date): string {
  const dayDiff = getLocalCalendarDayDiff(date, now);

  if (dayDiff === -1) {
    return `Вчера, ${formatLocalDateLabel(date, { day: 'numeric', month: 'long' })}`;
  }

  if (dayDiff === -2) {
    return `Позавчера, ${formatLocalDateLabel(date, { day: 'numeric', month: 'long' })}`;
  }

  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

function getVisibleSessionEnd(session: SleepSession, now: Date, rangeEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return new Date(Math.min(now.getTime(), rangeEnd.getTime()));
}

function sessionOverlapsRange(
  session: SleepSession,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date,
): boolean {
  const startedAt = new Date(session.startedAt);
  const endedAt = getVisibleSessionEnd(session, now, rangeEnd);

  return startedAt.getTime() < rangeEnd.getTime() && endedAt.getTime() > rangeStart.getTime();
}

function getStatusMarkerStyle(status: SleepRetrospectiveStatus) {
  switch (status) {
    case 'onTrack':
      return styles.statusOnTrack;
    case 'shifted':
      return styles.statusShifted;
    case 'stronglyShifted':
      return styles.statusStronglyShifted;
    case 'empty':
      return styles.statusEmpty;
  }
}

function buildTargetPlanFromSleepDayPlan(dayPlan: SleepDayPlan): TargetDayPlan {
  return {
    childId: dayPlan.childId,
    eveningRulesMode: 'auto',
    id: dayPlan.sourcePlanId ?? 'sleep-day-plan',
    isActive: !dayPlan.isSnapshot,
    name: dayPlan.sourcePlanName,
    plan: dayPlan.plan,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function getAwakeTrendMaxMinutes(points: SleepRetrospectiveAwakeTrendPoint[]): number {
  const maxRecordedDelta = Math.max(
    0,
    ...points
      .filter((point) => point.hasRecords)
      .map((point) => Math.abs(point.awakeDeltaMinutes)),
  );

  return Math.max(30, maxRecordedDelta);
}

function getStatusBarColor(status: SleepRetrospectiveStatus): string {
  switch (status) {
    case 'onTrack':
      return colors.primary;
    case 'shifted':
      return colors.warning;
    case 'stronglyShifted':
      return colors.danger;
    case 'empty':
      return colors.border;
  }
}

function getChronologicalDays(days: RetrospectiveScreenDay[]): RetrospectiveScreenDay[] {
  return [...days].sort((first, second) => first.date.getTime() - second.date.getTime());
}

function getPrimaryPlanFitDetail(day: RetrospectiveScreenDay): string {
  if (!day.hasRecords) {
    return 'нет записей за день';
  }

  if (Math.abs(day.targetDaySleepDeltaMinutes) > PLAN_SHIFT_TOLERANCE_MINUTES) {
    return `дневной сон ${formatSignedDuration(day.targetDaySleepDeltaMinutes)} к цели`;
  }

  if (Math.abs(day.awakeDeltaMinutes) > PLAN_SHIFT_TOLERANCE_MINUTES) {
    return `бодрствование ${formatSignedDuration(day.awakeDeltaMinutes)} к цели`;
  }

  if (
    day.targetBedtimeDeltaMinutes !== null &&
    Math.abs(day.targetBedtimeDeltaMinutes) > PLAN_SHIFT_TOLERANCE_MINUTES
  ) {
    return `отбой ${formatSignedDuration(day.targetBedtimeDeltaMinutes)} к плану`;
  }

  if (day.napCountDelta !== 0) {
    const sign = day.napCountDelta > 0 ? '+' : '';

    return `${sign}${day.napCountDelta} сна к плану`;
  }

  return `${formatDuration(day.totalDaySleepMinutes + day.totalNightSleepMinutes)} сна · ${formatNapCount(day.completedNaps)}`;
}

function getPlanFitValue(day: RetrospectiveScreenDay): string {
  if (!day.hasRecords) {
    return '--';
  }

  if (day.status === 'onTrack') {
    return 'ок';
  }

  const shifts = [
    day.targetDaySleepDeltaMinutes,
    day.awakeDeltaMinutes,
    day.targetBedtimeDeltaMinutes ?? 0,
  ];
  const strongestShift = shifts.reduce((current, next) =>
    Math.abs(next) > Math.abs(current) ? next : current,
  );

  if (Math.abs(strongestShift) <= PLAN_SHIFT_TOLERANCE_MINUTES && day.napCountDelta !== 0) {
    return day.napCountDelta > 0 ? `+${day.napCountDelta}` : String(day.napCountDelta);
  }

  return formatSignedDuration(strongestShift);
}

function getTimelineSegmentStyle(segment: SleepTimelineSegment): ViewStyle {
  const leftPercent = Math.max(0, Math.min(100, (segment.startOffsetMinutes / DAY_MINUTES) * 100));
  const widthPercent = Math.max(
    0.6,
    Math.min(100 - leftPercent, (segment.durationMinutes / DAY_MINUTES) * 100),
  );

  return {
    left: `${leftPercent}%` as DimensionValue,
    width: `${widthPercent}%` as DimensionValue,
  };
}

function MetricGrid({ stats }: { stats: SleepRetrospectivePeriodStats }) {
  return (
    <View style={styles.metricGrid}>
      {stats.metricCards.map((metric) => (
        <View key={metric.label} style={styles.metricCard}>
          <Text numberOfLines={1} style={styles.metricLabel}>
            {metric.label}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.metricValue}>
            {metric.value}
          </Text>
          <Text numberOfLines={1} style={styles.metricDetail}>
            {metric.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PlanFitChart({ days }: { days: RetrospectiveScreenDay[] }) {
  const chronologicalDays = getChronologicalDays(days);

  if (chronologicalDays.length === 0) {
    return <Text style={styles.chartEmptyText}>Пока нет дней для графика.</Text>;
  }

  return (
    <View style={styles.chartRows}>
      {chronologicalDays.map((day) => (
        <View key={day.dateKey} style={styles.planFitRow}>
          <Text numberOfLines={1} style={styles.chartDate}>
            {formatChartDate(day.date)}
          </Text>
          <View style={styles.planFitBody}>
            <View style={[styles.planFitDot, getStatusMarkerStyle(day.status)]} />
            <View style={styles.planFitTextBlock}>
              <Text numberOfLines={1} style={styles.planFitTitle}>
                {day.statusLabel}
              </Text>
              <Text numberOfLines={1} style={styles.planFitDetail}>
                {getPrimaryPlanFitDetail(day)}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} style={styles.planFitValue}>
            {getPlanFitValue(day)}
          </Text>
        </View>
      ))}
      <View style={styles.planFitLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusOnTrack]} />
          <Text style={styles.legendText}>в плане</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusShifted]} />
          <Text style={styles.legendText}>есть сдвиг</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusStronglyShifted]} />
          <Text style={styles.legendText}>заметный сдвиг</Text>
        </View>
      </View>
    </View>
  );
}

function SleepTimelineChart({ days }: { days: RetrospectiveScreenDay[] }) {
  const chronologicalDays = getChronologicalDays(days);

  if (chronologicalDays.length === 0) {
    return <Text style={styles.chartEmptyText}>Пока нет дней для графика.</Text>;
  }

  return (
    <View style={styles.chartRows}>
      {chronologicalDays.map((day) => (
        <View key={day.dateKey} style={styles.timelineChartRow}>
          <Text numberOfLines={1} style={styles.chartDate}>
            {formatChartDate(day.date)}
          </Text>
          <View style={styles.timelineTrack}>
            {day.timelineSegments.map((segment) => (
              <View
                key={segment.id}
                style={[
                  styles.timelineSegment,
                  segment.kind === 'night'
                    ? styles.timelineNightSegment
                    : styles.timelineNapSegment,
                  getTimelineSegmentStyle(segment),
                ]}
              />
            ))}
          </View>
          <Text numberOfLines={1} style={styles.timelineValue}>
            {day.hasRecords ? formatNapCount(day.completedNaps) : '--'}
          </Text>
        </View>
      ))}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.timelineNightSegment]} />
          <Text style={styles.legendText}>Ночь</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.timelineNapSegment]} />
          <Text style={styles.legendText}>Дневной сон</Text>
        </View>
      </View>
    </View>
  );
}

function AwakeTrendChart({ points }: { points: SleepRetrospectiveAwakeTrendPoint[] }) {
  const maxMinutes = getAwakeTrendMaxMinutes(points);

  if (points.length === 0) {
    return <Text style={styles.chartEmptyText}>Пока нет дней для графика.</Text>;
  }

  return (
    <View style={styles.chartRows}>
      {points.map((point) => {
        const delta = point.awakeDeltaMinutes;
        const barWidth = point.hasRecords
          ? Math.round((Math.abs(delta) / maxMinutes) * 100)
          : 0;
        const visibleBarWidth =
          barWidth > 0 ? Math.max(MIN_VISIBLE_BAR_PERCENT, barWidth) : 0;
        const barColor = getStatusBarColor(point.status);

        return (
          <View key={point.date.toISOString()} style={styles.chartRow}>
            <Text numberOfLines={1} style={styles.chartDate}>
              {formatChartDate(point.date)}
            </Text>
            <View style={styles.awakeBarTrack}>
              <View style={[styles.awakeBarHalf, styles.awakeBarLeftHalf]}>
                {point.hasRecords && delta < 0 ? (
                  <View
                    style={[
                      styles.awakeBarFill,
                      { backgroundColor: barColor, width: `${visibleBarWidth}%` },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.awakeBarCenter} />
              <View style={[styles.awakeBarHalf, styles.awakeBarRightHalf]}>
                {point.hasRecords && delta > 0 ? (
                  <View
                    style={[
                      styles.awakeBarFill,
                      { backgroundColor: barColor, width: `${visibleBarWidth}%` },
                    ]}
                  />
                ) : null}
              </View>
            </View>
            <Text numberOfLines={1} style={styles.chartValue}>
              {point.hasRecords ? formatAwakeDeltaShort(delta) : '--'}
            </Text>
          </View>
        );
      })}
      <Text style={styles.chartNote}>Слева меньше бодрствования, справа больше цели.</Text>
    </View>
  );
}

function PeriodStatsModal({
  days,
  onClose,
  stats,
  visible,
}: {
  days: RetrospectiveScreenDay[];
  onClose: () => void;
  stats: SleepRetrospectivePeriodStats;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modalOverlay}>
        <BottomSheetSafeArea style={styles.statsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Сводная информация</Text>
              <Text style={styles.sheetPeriod}>{stats.periodLabel}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Закрыть</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.statsScroll}
            contentContainerStyle={styles.statsContent}>
            <View style={styles.statsIntroCard}>
              <Text style={styles.statsHeadline}>{stats.headline}</Text>
              <Text style={styles.statsDetail}>{stats.detailLine}</Text>
            </View>

            <MetricGrid stats={stats} />

            <View style={styles.chartPanel}>
              <Text style={styles.chartTitle}>День попал в план?</Text>
              <Text style={styles.chartSubtitle}>
                Главный статус по каждому дню и самый заметный сдвиг.
              </Text>
              <PlanFitChart days={days} />
            </View>

            <View style={styles.chartPanel}>
              <Text style={styles.chartTitle}>Сны на шкале суток</Text>
              <Text style={styles.chartSubtitle}>
                Видно, когда были ночь, дневные сны, ранний подъём или поздний отбой.
              </Text>
              <SleepTimelineChart days={days} />
            </View>

            <View style={styles.chartPanel}>
              <Text style={styles.chartTitle}>Бодрствование к плану</Text>
              <Text style={styles.chartSubtitle}>
                Быстрый способ увидеть, повторяется ли сдвиг режима.
              </Text>
              <AwakeTrendChart points={stats.awakeTrend} />
            </View>
          </ScrollView>
        </BottomSheetSafeArea>
      </View>
    </Modal>
  );
}

export default function SleepRetrospectiveScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [days, setDays] = useState<RetrospectiveScreenDay[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStatsVisible, setIsStatsVisible] = useState(false);

  const loadRetrospective = useCallback(async (shouldApply: () => boolean) => {
    const loadedAt = new Date();

    setIsLoading(true);

    try {
      await ensureDefaultChildProfile(db);

      const currentDayPlan = await getSleepDayPlan(db, loadedAt, loadedAt);
      const currentSleepDayDate = dateFromSleepDayDateKey(currentDayPlan.sleepDayDate);
      const loadedDays: RetrospectiveScreenDay[] = [];

      for (let index = 1; index <= periodDays; index += 1) {
        const dayDate = addLocalCalendarDays(currentSleepDayDate, -index);
        const referenceDate = dateAtLocalNoon(dayDate);
        const dayPlan = await getSleepDayPlan(db, referenceDate, loadedAt);
        const dayStart = dateAtMinutes(referenceDate, dayPlan.plan.dayStartMinutes);
        const dayEnd = addMinutes(dayStart, DAY_MINUTES);
        const loadedSessions = await listSleepSessionsInRange(db, dayStart, dayEnd);
        const daySessions = loadedSessions.filter((session) =>
          sessionOverlapsRange(session, dayStart, dayEnd, loadedAt),
        );
        const temporaryModes = await listSleepDayTemporaryModes(
          db,
          dayPlan.childId,
          dayPlan.sleepDayDate,
        );
        const actualWakeTime = getActualWakeTimeForEarlyWakeMode({
          now: loadedAt,
          plan: dayPlan.plan,
          sessions: daySessions,
          sleepDayDateKey: dayPlan.sleepDayDate,
        });
        const effectiveDayPlan = buildEffectiveSleepDayPlan(
          buildTargetPlanFromSleepDayPlan(dayPlan),
          temporaryModes,
          { actualWakeTime },
        );
        const summary = buildSleepDaySummary(
          daySessions,
          referenceDate,
          loadedAt,
          effectiveDayPlan.plan,
        );
        const timelineSegments = buildSleepTimelineSegments(
          daySessions,
          dayStart,
          dayEnd,
          loadedAt,
          effectiveDayPlan.plan,
        );

        loadedDays.push({
          ...buildSleepRetrospectiveDay({
            date: dayDate,
            summary,
            temporaryModes,
          }),
          dateKey: formatSleepDayDateKey(dayDate),
          timelineSegments,
        });
      }

      if (shouldApply()) {
        setDays(loadedDays);
        setNow(loadedAt);
        setErrorMessage(null);
      }
    } catch {
      if (shouldApply()) {
        setErrorMessage('Не удалось загрузить ретроспективу');
      }
    } finally {
      if (shouldApply()) {
        setIsLoading(false);
      }
    }
  }, [db, periodDays]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadIfActive() {
        await loadRetrospective(() => isActive);
      }

      loadIfActive();

      return () => {
        isActive = false;
      };
    }, [loadRetrospective]),
  );

  const periodSummary = useMemo(
    () => buildSleepRetrospectivePeriodSummary(days, periodDays),
    [days, periodDays],
  );
  const periodStats = useMemo(
    () => buildSleepRetrospectivePeriodStats(days, periodDays),
    [days, periodDays],
  );

  function openDay(day: RetrospectiveScreenDay) {
    router.push(`/?date=${day.dateKey}` as Href);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'История сна' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.periodSelector}>
            {PERIOD_OPTIONS.map((option) => {
              const isSelected = periodDays === option;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option}
                  onPress={() => setPeriodDays(option)}
                  style={({ pressed }) => [
                    styles.periodButton,
                    isSelected ? styles.periodButtonSelected : null,
                    pressed ? styles.periodButtonPressed : null,
                  ]}>
                  <Text
                    style={[
                      styles.periodButtonText,
                      isSelected ? styles.periodButtonTextSelected : null,
                    ]}>
                    {option} дней
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.summaryPanel}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconBadge}>
                <SleepRetrospectiveIcon size={34} />
              </View>
              <Text style={styles.summaryMeta}>{periodSummary.periodLabel}</Text>
            </View>
            <Text style={styles.summaryTitle}>
              {isLoading && days.length === 0 ? 'Загрузка' : periodSummary.primaryLine}
            </Text>
            <Text style={styles.summaryDetail}>{periodSummary.detailLine}</Text>
            <Text style={styles.summaryQuiet}>{periodSummary.quietLine}</Text>
            <PrimaryButton
              compact
              label="Сводная информация"
              onPress={() => setIsStatsVisible(true)}
              style={styles.summaryButton}
              textStyle={styles.summaryButtonText}
              variant="secondary"
            />
          </View>

          <View style={styles.dayList}>
            {days.map((day) => (
              <Pressable
                accessibilityRole="button"
                key={day.dateKey}
                onPress={() => openDay(day)}
                style={({ pressed }) => [
                  styles.dayCard,
                  pressed ? styles.dayCardPressed : null,
                ]}>
                <View style={[styles.statusMarker, getStatusMarkerStyle(day.status)]} />
                <View style={styles.dayCardBody}>
                  <View style={styles.dayCardHeader}>
                    <Text numberOfLines={1} style={styles.dayTitle}>
                      {formatCardDate(day.date, now)}
                    </Text>
                    <Text numberOfLines={1} style={styles.dayStatus}>
                      {day.statusLabel}
                    </Text>
                  </View>

                  {day.temporaryModeBadges.length > 0 ? (
                    <View style={styles.temporaryModeBadgeList}>
                      {day.temporaryModeBadges.map((badge) => (
                        <View key={badge.mode} style={styles.temporaryModeBadge}>
                          <Text numberOfLines={1} style={styles.temporaryModeBadgeText}>
                            {badge.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.factList}>
                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>Подъём</Text>
                      <Text style={styles.factValue}>{formatClock(day.wakeUpAt)}</Text>
                    </View>
                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>Дневной сон</Text>
                      <Text numberOfLines={1} style={styles.factValue}>
                        {formatDuration(day.totalDaySleepMinutes)} · {formatNapCount(day.completedNaps)}
                      </Text>
                    </View>
                    <View style={styles.factRow}>
                      <Text style={styles.factLabel}>Отбой</Text>
                      <Text style={styles.factValue}>{formatClock(day.bedtimeAt)}</Text>
                    </View>
                  </View>

                  <Text numberOfLines={1} style={styles.awakeLine}>
                    Бодрствование {formatAwakeDelta(day.awakeDeltaMinutes)}
                  </Text>
                  <Text numberOfLines={2} style={styles.hintText}>
                    {day.hint}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </ScrollView>
      <PeriodStatsModal
        days={days}
        onClose={() => setIsStatsVisible(false)}
        stats={periodStats}
        visible={isStatsVisible}
      />
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
  periodSelector: {
    minHeight: 42,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  periodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  periodButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  periodButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  periodButtonTextSelected: {
    color: colors.primary,
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  summaryPanel: {
    minHeight: 154,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  summaryHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIconBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
  },
  summaryMeta: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 31,
  },
  summaryDetail: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  summaryQuiet: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  summaryButton: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
  },
  summaryButtonText: {
    fontSize: 16,
    fontWeight: '900',
  },
  dayList: {
    gap: spacing.sm,
  },
  dayCard: {
    minHeight: 172,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayCardPressed: {
    backgroundColor: colors.primarySoft,
  },
  statusMarker: {
    width: 6,
  },
  statusOnTrack: {
    backgroundColor: colors.primary,
  },
  statusShifted: {
    backgroundColor: colors.warning,
  },
  statusStronglyShifted: {
    backgroundColor: colors.danger,
  },
  statusEmpty: {
    backgroundColor: colors.border,
  },
  dayCardBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    padding: spacing.md,
  },
  dayCardHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dayTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  dayStatus: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  temporaryModeBadgeList: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  temporaryModeBadge: {
    minHeight: 24,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  temporaryModeBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  factList: {
    gap: spacing.xs,
  },
  factRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  factLabel: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  factValue: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  awakeLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  statsSheet: {
    maxHeight: '92%',
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  sheetHandle: {
    width: 46,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  sheetPeriod: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  statsScroll: {
    flexShrink: 1,
  },
  statsContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  statsIntroCard: {
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  statsHeadline: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
  },
  statsDetail: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    minHeight: 100,
    justifyContent: 'space-between',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  metricDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  chartPanel: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  chartSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  chartRows: {
    gap: spacing.xs,
  },
  chartRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartDate: {
    width: 48,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  chartValue: {
    width: 64,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  chartEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  planFitRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planFitBody: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planFitDot: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 5,
  },
  planFitTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planFitTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  planFitDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  planFitValue: {
    width: 58,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  planFitLegend: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  timelineChartRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineTrack: {
    flex: 1,
    minWidth: 0,
    height: 18,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
  },
  timelineSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    minWidth: 2,
    borderRadius: 9,
  },
  timelineNightSegment: {
    backgroundColor: colors.primary,
  },
  timelineNapSegment: {
    backgroundColor: colors.warning,
  },
  timelineValue: {
    width: 48,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  chartLegend: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  awakeBarTrack: {
    flex: 1,
    minWidth: 0,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  awakeBarHalf: {
    flex: 1,
    height: 8,
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  awakeBarLeftHalf: {
    alignItems: 'flex-end',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  awakeBarRightHalf: {
    alignItems: 'flex-start',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  awakeBarCenter: {
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  awakeBarFill: {
    height: 8,
    borderRadius: 4,
  },
  chartNote: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    paddingTop: spacing.xs,
  },
});
