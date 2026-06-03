import { useCallback, useMemo, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepRetrospectiveIcon } from '@/components/SleepRetrospectiveIcon';
import { colors, radius, spacing } from '@/constants/theme';
import {
  addMinutes,
  buildSleepDaySummary,
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
  type SleepRetrospectiveDay,
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
import type { SleepDayPlan, SleepSession, TargetDayPlan } from '@/types/sleep';

type PeriodDays = 7 | 14 | 21;

type RetrospectiveScreenDay = SleepRetrospectiveDay & {
  dateKey: string;
};

const DAY_MINUTES = 24 * 60;
const PERIOD_OPTIONS: PeriodDays[] = [7, 14, 21];

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

function formatAwakeDelta(deltaMinutes: number): string {
  if (Math.abs(deltaMinutes) <= 30) {
    return 'близко к плану';
  }

  const sign = deltaMinutes > 0 ? '+' : '-';

  return `${sign}${formatDuration(Math.abs(deltaMinutes))} к плану`;
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

export default function SleepRetrospectiveScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [days, setDays] = useState<RetrospectiveScreenDay[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        loadedDays.push({
          ...buildSleepRetrospectiveDay({
            date: dayDate,
            summary,
            temporaryModes,
          }),
          dateKey: formatSleepDayDateKey(dayDate),
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

  function openDay(day: RetrospectiveScreenDay) {
    router.push(`/?date=${day.dateKey}` as Href);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Ретроспектива сна' }} />
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
});
