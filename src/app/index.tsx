import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { SleepDayTimeline } from '@/components/SleepDayTimeline';
import { SleepSessionEditorModal } from '@/components/SleepSessionEditorModal';
import { SummaryCard } from '@/components/SummaryCard';
import { DEFAULT_CHILD_NAME, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  addMinutes,
  buildSleepDaySummary,
  buildSleepTimelineSegments,
  buildTodaySleepSnapshot,
  dateAtMinutes,
  getDayStart,
  getSessionDurationMinutes,
  getSessionKindForCalculations,
  inferSleepKindForInterval,
  inferSleepKindForStart,
  minutesBetween,
} from '@/core/sleepCalculations';
import {
  createSleepSession,
  deleteSleepSession,
  ensureDefaultChildProfile,
  getChildProfile,
  getLatestSleepSession,
  getTargetDayPlan,
  listSleepSessionsInRange,
  startSleepSession,
  stopActiveSleepSession,
  updateSleepSession,
} from '@/db';
import type { SleepKind, SleepPlanPreset, SleepSession } from '@/types/sleep';

type EditorState =
  | {
      mode: 'create';
      session: null;
      referenceDate: Date;
    }
  | {
      mode: 'edit';
      session: SleepSession;
      referenceDate: Date;
    };

type SelectedDayType = 'past' | 'today' | 'future';

interface LoadedSessionsForDate {
  latestSleepSessionId: string | null;
  selectedSessions: SleepSession[];
  nearbySessions: SleepSession[];
}

interface SessionDayGroup {
  key: 'selected' | 'previous';
  title: string;
  subtitle: string;
  sessions: SleepSession[];
}

const DAY_MINUTES = 24 * 60;
const SLEEP_PLAN_ROUTE = '/sleep-plan' as Href;
const dateLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatNextSleepWaitLabel(
  isSleeping: boolean,
  now: Date,
  nextSleepAt: Date,
  nextSleepKind: SleepKind,
): string {
  if (isSleeping) {
    return 'сейчас спит';
  }

  const minutesUntilSleep = minutesBetween(now, nextSleepAt);

  if (minutesUntilSleep === 0) {
    return nextSleepKind === 'night' ? 'пора на ночь' : 'пора спать';
  }

  return `${nextSleepKind === 'night' ? 'до отбоя' : 'до сна'} ${formatDuration(
    minutesUntilSleep,
  )}`;
}

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return startOfCalendarDay(first).getTime() === startOfCalendarDay(second).getTime();
}

function dateAtNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addCalendarDays(date: Date, days: number): Date {
  const nextDate = dateAtNoon(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getCalendarDayDiff(first: Date, second: Date): number {
  const firstStart = startOfCalendarDay(first).getTime();
  const secondStart = startOfCalendarDay(second).getTime();

  return Math.round((firstStart - secondStart) / (DAY_MINUTES * 60_000));
}

function getSelectedDayType(selectedDate: Date, now: Date): SelectedDayType {
  const dayDiff = getCalendarDayDiff(selectedDate, now);

  if (dayDiff < 0) {
    return 'past';
  }

  if (dayDiff > 0) {
    return 'future';
  }

  return 'today';
}

function getSleepDayStartForSelection(
  selectedDate: Date,
  now: Date,
  plan: SleepPlanPreset,
): Date {
  if (getSelectedDayType(selectedDate, now) === 'today') {
    return getDayStart(now, plan);
  }

  return dateAtMinutes(dateAtNoon(selectedDate), plan.dayStartMinutes);
}

function getVisibleSessionEnd(session: SleepSession, now: Date, dayEnd: Date): Date {
  if (session.endedAt) {
    return new Date(session.endedAt);
  }

  return new Date(Math.min(now.getTime(), dayEnd.getTime()));
}

function sleepSessionOverlapsDay(
  session: SleepSession,
  dayStart: Date,
  dayEnd: Date,
  now: Date,
): boolean {
  const startedAt = new Date(session.startedAt);
  const endedAt = getVisibleSessionEnd(session, now, dayEnd);

  return startedAt.getTime() < dayEnd.getTime() && endedAt.getTime() > dayStart.getTime();
}

function formatDateLabel(date: Date): string {
  return dateLabelFormatter.format(date);
}

function formatSelectedDayTitle(selectedDate: Date, now: Date): string {
  const dayDiff = getCalendarDayDiff(selectedDate, now);

  if (dayDiff === 0) {
    return 'Сегодня';
  }

  if (dayDiff === 1) {
    return `Завтра, ${formatDateLabel(selectedDate)}`;
  }

  if (dayDiff === -1) {
    return `Вчера, ${formatDateLabel(selectedDate)}`;
  }

  if (dayDiff === -2) {
    return `Позавчера, ${formatDateLabel(selectedDate)}`;
  }

  return formatDateLabel(selectedDate);
}

function formatHeaderTitle(selectedDate: Date, now: Date): string {
  const dayDiff = getCalendarDayDiff(selectedDate, now);

  if (dayDiff === 0) {
    return 'Сон сегодня';
  }

  if (dayDiff === 1) {
    return 'Сон завтра';
  }

  if (dayDiff === -1) {
    return 'Сон вчера';
  }

  if (dayDiff === -2) {
    return 'Сон позавчера';
  }

  return `Сон ${formatDateLabel(selectedDate)}`;
}

function formatSessionGroupTitle(date: Date, now: Date): string {
  const dayDiff = getCalendarDayDiff(date, now);

  if (dayDiff === 0) {
    return 'Сегодня';
  }

  if (dayDiff === 1) {
    return 'Завтра';
  }

  if (dayDiff === -1) {
    return 'Вчера';
  }

  if (dayDiff === -2) {
    return 'Позавчера';
  }

  return formatDateLabel(date);
}

function formatRangeDateLabel(date: Date, now: Date): string {
  const dayDiff = getCalendarDayDiff(date, now);

  if (dayDiff === 0) {
    return 'сегодня';
  }

  if (dayDiff === 1) {
    return 'завтра';
  }

  if (dayDiff === -1) {
    return 'вчера';
  }

  return formatDateLabel(date);
}

function formatSessionTimeRange(startedAt: Date, endedAt: Date | null, now: Date): string {
  if (!endedAt) {
    return `${formatClock(startedAt)} - идёт`;
  }

  if (isSameCalendarDay(startedAt, endedAt)) {
    return `${formatClock(startedAt)} - ${formatClock(endedAt)}`;
  }

  return `${formatClock(startedAt)} ${formatRangeDateLabel(startedAt, now)} - ${formatClock(
    endedAt,
  )} ${formatRangeDateLabel(endedAt, now)}`;
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

function formatSessionCount(value: number): string {
  return formatCount(value, 'запись', 'записи', 'записей');
}

function formatNapCount(value: number): string {
  return formatCount(value, 'сон', 'сна', 'снов');
}

function getProfileInitial(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return DEFAULT_CHILD_NAME.slice(0, 1).toUpperCase();
  }

  return trimmedName.slice(0, 1).toUpperCase();
}

function sortSessionsNewestFirst(sessions: SleepSession[]): SleepSession[] {
  return [...sessions].sort(
    (first, second) =>
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime(),
  );
}

function sessionStartsInRange(session: SleepSession, rangeStart: Date, rangeEnd: Date): boolean {
  const startedAt = new Date(session.startedAt);

  return startedAt.getTime() >= rangeStart.getTime() && startedAt.getTime() < rangeEnd.getTime();
}

export default function TodaySleepScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [nearbySessions, setNearbySessions] = useState<SleepSession[]>([]);
  const [latestSleepSessionId, setLatestSleepSessionId] = useState<string | null>(null);
  const [childName, setChildName] = useState(DEFAULT_CHILD_NAME);
  const [sleepPlan, setSleepPlan] = useState(DEFAULT_SLEEP_PLAN);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const fetchSessionsForDate = useCallback(
    async (
      referenceDate: Date,
      currentNow: Date,
      plan: SleepPlanPreset,
    ): Promise<LoadedSessionsForDate> => {
      await ensureDefaultChildProfile(db);

      const dayStart = getSleepDayStartForSelection(referenceDate, currentNow, plan);
      const dayEnd = addMinutes(dayStart, DAY_MINUTES);
      const previousDayStart = addMinutes(dayStart, -DAY_MINUTES);
      const loadedSessions = await listSleepSessionsInRange(db, previousDayStart, dayEnd);
      const latestSleepSession = await getLatestSleepSession(db);
      const nearbySessionsForDisplay = loadedSessions.filter((session) =>
        sleepSessionOverlapsDay(session, previousDayStart, dayEnd, currentNow),
      );

      return {
        latestSleepSessionId: latestSleepSession?.id ?? null,
        nearbySessions: nearbySessionsForDisplay,
        selectedSessions: nearbySessionsForDisplay.filter((session) =>
          sleepSessionOverlapsDay(session, dayStart, dayEnd, currentNow),
        ),
      };
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadChildProfile() {
        try {
          const profile = await getChildProfile(db);

          if (isActive) {
            setChildName(profile.name);
          }
        } catch {
          if (isActive) {
            setChildName(DEFAULT_CHILD_NAME);
          }
        }
      }

      async function loadSleepPlan() {
        try {
          const plan = await getTargetDayPlan(db);

          if (isActive) {
            setSleepPlan(plan);
          }
        } catch {
          if (isActive) {
            setSleepPlan(DEFAULT_SLEEP_PLAN);
          }
        }
      }

      loadChildProfile();
      loadSleepPlan();

      return () => {
        isActive = false;
      };
    }, [db]),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedDay() {
      const loadedAt = new Date();

      setIsLoading(true);

      try {
        const loadedSessions = await fetchSessionsForDate(selectedDate, loadedAt, sleepPlan);

        if (isMounted) {
          setNow(loadedAt);
          setSessions(loadedSessions.selectedSessions);
          setNearbySessions(loadedSessions.nearbySessions);
          setLatestSleepSessionId(loadedSessions.latestSleepSessionId);
          setErrorMessage(null);
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Не удалось загрузить сон');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSelectedDay();

    return () => {
      isMounted = false;
    };
  }, [fetchSessionsForDate, selectedDate, sleepPlan]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const dayType = useMemo(() => getSelectedDayType(selectedDate, now), [now, selectedDate]);
  const selectedDayTitle = useMemo(
    () => formatSelectedDayTitle(selectedDate, now),
    [now, selectedDate],
  );
  const headerTitle = useMemo(() => formatHeaderTitle(selectedDate, now), [now, selectedDate]);
  const profileInitial = useMemo(() => getProfileInitial(childName), [childName]);
  const selectedDayStart = useMemo(
    () => getSleepDayStartForSelection(selectedDate, now, sleepPlan),
    [now, selectedDate, sleepPlan],
  );
  const selectedDayEnd = useMemo(() => addMinutes(selectedDayStart, DAY_MINUTES), [
    selectedDayStart,
  ]);
  const sessionDayGroups = useMemo<SessionDayGroup[]>(() => {
    const previousDayStart = addMinutes(selectedDayStart, -DAY_MINUTES);
    const previousDate = addCalendarDays(selectedDate, -1);
    const selectedGroupSessions = nearbySessions.filter((session) =>
      sessionStartsInRange(session, selectedDayStart, selectedDayEnd),
    );
    const previousGroupSessions = nearbySessions.filter((session) => {
      if (sessionStartsInRange(session, selectedDayStart, selectedDayEnd)) {
        return false;
      }

      return sleepSessionOverlapsDay(session, previousDayStart, selectedDayStart, now);
    });

    return [
      {
        key: 'selected',
        sessions: sortSessionsNewestFirst(selectedGroupSessions),
        subtitle: formatDateLabel(selectedDate),
        title: formatSessionGroupTitle(selectedDate, now),
      },
      {
        key: 'previous',
        sessions: sortSessionsNewestFirst(previousGroupSessions),
        subtitle: formatDateLabel(previousDate),
        title: formatSessionGroupTitle(previousDate, now),
      },
    ];
  }, [nearbySessions, now, selectedDate, selectedDayEnd, selectedDayStart]);
  const displayedSessionCount = useMemo(
    () => sessionDayGroups.reduce((total, group) => total + group.sessions.length, 0),
    [sessionDayGroups],
  );
  const displayedSessionCountLabel =
    displayedSessionCount === 0
      ? 'Пока нет записей'
      : `Всего ${formatSessionCount(displayedSessionCount)}`;
  const editModalSessions = useMemo(() => {
    const uniqueSessions = new Map<string, SleepSession>();

    [...nearbySessions, ...sessions].forEach((session) => {
      uniqueSessions.set(session.id, session);
    });

    return Array.from(uniqueSessions.values());
  }, [nearbySessions, sessions]);
  const summaryReferenceDate = dayType === 'today' ? now : dateAtNoon(selectedDate);
  const daySummary = useMemo(
    () => buildSleepDaySummary(sessions, summaryReferenceDate, now, sleepPlan),
    [now, sessions, sleepPlan, summaryReferenceDate],
  );
  const timelineSegments = useMemo(
    () =>
      buildSleepTimelineSegments(
        sessions,
        selectedDayStart,
        selectedDayEnd,
        now,
        sleepPlan,
      ),
    [now, selectedDayEnd, selectedDayStart, sessions, sleepPlan],
  );
  const snapshot = useMemo(
    () => buildTodaySleepSnapshot(sessions, now, sleepPlan),
    [sessions, now, sleepPlan],
  );
  const predictedBedtimeCaption =
    snapshot.projectedRemainingDaySleepMinutes > 0
      ? `ещё сна днём ${formatDuration(snapshot.projectedRemainingDaySleepMinutes)}`
      : 'с учётом сна днём';
  const isToday = dayType === 'today';
  const isSleeping = isToday && snapshot.state === 'sleeping';
  const nextSleepWaitLabel = formatNextSleepWaitLabel(
    isSleeping,
    now,
    snapshot.nextSleepAt,
    snapshot.nextSleepKind,
  );
  const buttonLabel = isSaving
    ? 'Сохраняем...'
    : isSleeping
      ? 'Завершить сон'
      : 'Начать сон';
  const canGoForward = useMemo(() => {
    const tomorrow = addCalendarDays(now, 1);

    return startOfCalendarDay(selectedDate).getTime() < startOfCalendarDay(tomorrow).getTime();
  }, [now, selectedDate]);

  function openEditEditor(session: SleepSession) {
    setEditorState({
      mode: 'edit',
      referenceDate: session.endedAt ? new Date(session.endedAt) : now,
      session,
    });
  }

  async function reloadSelectedDay(referenceDate: Date, currentNow: Date) {
    const loadedSessions = await fetchSessionsForDate(referenceDate, currentNow, sleepPlan);

    setNow(currentNow);
    setSessions(loadedSessions.selectedSessions);
    setNearbySessions(loadedSessions.nearbySessions);
    setLatestSleepSessionId(loadedSessions.latestSleepSessionId);
  }

  function openProfile() {
    router.push('/profile');
  }

  function openSleepPlan() {
    router.push(SLEEP_PLAN_ROUTE);
  }

  function openCreateEditor() {
    setEditorState({
      mode: 'create',
      referenceDate: isToday ? new Date() : dateAtNoon(selectedDate),
      session: null,
    });
  }

  function selectQuickDate(dayOffset: -1 | 0 | 1) {
    setSelectedDate(dayOffset === 0 ? new Date() : addCalendarDays(now, dayOffset));
  }

  function goToPreviousDay() {
    setSelectedDate((currentDate) => addCalendarDays(currentDate, -1));
  }

  function goToNextDay() {
    if (!canGoForward) {
      return;
    }

    setSelectedDate((currentDate) => addCalendarDays(currentDate, 1));
  }

  async function handleSleepButtonPress() {
    if (!isToday) {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (isSleeping) {
        const activeSession = sessions.find((session) => session.endedAt === null);
        const sleepKind = activeSession
          ? inferSleepKindForInterval(
              new Date(activeSession.startedAt),
              actionAt,
              sleepPlan,
            )
          : undefined;

        await stopActiveSleepSession(db, actionAt, sleepKind);
      } else {
        await startSleepSession(db, inferSleepKindForStart(actionAt, sleepPlan), actionAt);
      }

      await reloadSelectedDay(selectedDate, actionAt);
    } catch {
      setErrorMessage('Не удалось сохранить сон');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditorSave(input: {
    startedAt: Date;
    endedAt: Date | null;
  }) {
    const actionAt = new Date();
    const inputWithKind = {
      ...input,
      kind: inferSleepKindForInterval(input.startedAt, input.endedAt, sleepPlan),
    };

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (editorState?.mode === 'edit') {
        await updateSleepSession(db, editorState.session.id, inputWithKind);
      } else if (!input.endedAt) {
        await startSleepSession(db, inputWithKind.kind, input.startedAt);
      } else {
        await createSleepSession(db, inputWithKind);
      }

      await reloadSelectedDay(selectedDate, actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось сохранить запись');
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
      await deleteSleepSession(db, editorState.session.id);
      await reloadSelectedDay(selectedDate, actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось удалить запись');
    } finally {
      setIsSaving(false);
    }
  }

  function renderDateShortcut(label: string, dayOffset: -1 | 0 | 1) {
    const targetDate = dayOffset === 0 ? now : addCalendarDays(now, dayOffset);
    const isActive =
      startOfCalendarDay(targetDate).getTime() === startOfCalendarDay(selectedDate).getTime();

    return (
      <Pressable
        accessibilityRole="button"
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

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="План сна"
                accessibilityRole="button"
                hitSlop={8}
                onPress={openSleepPlan}
                style={({ pressed }) => [
                  styles.sleepPlanButton,
                  pressed ? styles.headerIconButtonPressed : null,
                ]}>
                <SleepPlanIcon backgroundColor={colors.surface} />
              </Pressable>
              <Pressable
                accessibilityLabel="Профиль и настройки"
                accessibilityRole="button"
                hitSlop={8}
                onPress={openProfile}
                style={({ pressed }) => [
                  styles.profileButton,
                  pressed ? styles.headerIconButtonPressed : null,
                ]}>
                <Text style={styles.profileButtonText}>{profileInitial}</Text>
              </Pressable>
            </View>
          ),
          title: headerTitle,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.datePickerBlock}>
            <View style={styles.dayNavigator}>
              <Pressable
                accessibilityLabel="Предыдущий день"
                accessibilityRole="button"
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
                accessibilityLabel="Следующий день"
                accessibilityRole="button"
                disabled={!canGoForward}
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
            </View>

            <View style={styles.dateShortcutRow}>
              {renderDateShortcut('Сегодня', 0)}
              {renderDateShortcut('Вчера', -1)}
              {renderDateShortcut('Завтра', 1)}
            </View>
          </View>

          {isToday ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.status}>
                  {isLoading ? 'Загрузка' : isSleeping ? 'Спит' : 'Бодрствует'}
                </Text>
                <Text style={styles.timer}>
                  {isLoading ? '--' : formatDuration(snapshot.currentDurationMinutes)}
                </Text>
                <Text style={styles.helper}>с {formatClock(snapshot.statusStartedAt)}</Text>
              </View>

              <View style={styles.actionRow}>
                <PrimaryButton
                  compact
                  disabled={isLoading || isSaving}
                  label={buttonLabel}
                  onPress={handleSleepButtonPress}
                  style={styles.timerButton}
                />
                <PrimaryButton
                  compact
                  disabled={isLoading || isSaving}
                  label="Внести сон"
                  onPress={openCreateEditor}
                  style={styles.manualButton}
                  variant="secondary"
                />
              </View>

              <View style={styles.grid}>
                <SummaryCard
                  title="Следующий сон"
                  value={isSleeping ? 'после сна' : formatClock(snapshot.nextSleepAt)}
                  detail={nextSleepWaitLabel}
                  caption={snapshot.onTrackLabel}
                  tone="accent"
                />
                <SummaryCard
                  title="Прогноз ночи"
                  value={formatClock(snapshot.predictedBedtimeAt)}
                  caption={predictedBedtimeCaption}
                />
              </View>

              <View style={styles.grid}>
                <SummaryCard
                  title="До цели бодрств."
                  value={formatDuration(snapshot.remainingAwakeMinutes)}
                  caption={`всего ${formatDuration(snapshot.totalAwakeMinutes)}`}
                />
                <SummaryCard
                  title="Сон днем"
                  value={formatDuration(snapshot.totalDaySleepMinutes)}
                  caption={`${snapshot.completedNaps} сна сегодня`}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Сценарии</Text>
                <View style={styles.scenarioList}>
                  {snapshot.scenarios.map((scenario) => (
                    <View
                      key={scenario.id}
                      style={[
                        styles.scenario,
                        scenario.priority === 'primary' ? styles.primaryScenario : null,
                      ]}>
                      <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                      <Text style={styles.scenarioText}>{scenario.detail}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.historyHero}>
                <Text style={styles.status}>
                  {dayType === 'future' ? 'План на завтра' : 'Итоги дня'}
                </Text>
                <Text style={styles.historyValue}>
                  {formatDuration(daySummary.totalDaySleepMinutes)}
                </Text>
                <Text style={styles.helper}>
                  {daySummary.sleepSessionCount === 0
                    ? 'Пока нет записей сна'
                    : `${formatSessionCount(daySummary.sleepSessionCount)} сна`}
                </Text>
              </View>

              <View style={styles.grid}>
                <SummaryCard
                  title="Сон днем"
                  value={formatDuration(daySummary.totalDaySleepMinutes)}
                  caption={formatNapCount(daySummary.completedNaps)}
                  tone={dayType === 'future' ? 'accent' : 'default'}
                />
                <SummaryCard
                  title={dayType === 'future' ? 'Цель бодрств.' : 'Бодрствование'}
                  value={formatDuration(
                    dayType === 'future'
                      ? sleepPlan.targetAwakeMinutes
                      : daySummary.totalAwakeMinutes,
                  )}
                  caption={dayType === 'future' ? 'план дня' : daySummary.onTrackLabel}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Таймлайн</Text>
                <SleepDayTimeline dayStart={selectedDayStart} segments={timelineSegments} />
              </View>

              <PrimaryButton
                compact
                disabled={isLoading || isSaving}
                label="Внести сон"
                onPress={openCreateEditor}
                variant="secondary"
              />
            </>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, styles.sectionHeaderTitle]}>
                Записи за два дня
              </Text>
              <Text style={styles.sectionMeta}>{displayedSessionCountLabel}</Text>
            </View>
            <View style={styles.sessionList}>
              {sessionDayGroups.map((group) => (
                <View key={group.key} style={styles.sessionDayGroup}>
                  <View style={styles.sessionDayHeader}>
                    <View style={styles.sessionDayTitleRow}>
                      <View
                        style={[
                          styles.sessionDayMarker,
                          group.key === 'selected'
                            ? styles.selectedSessionDayMarker
                            : styles.previousSessionDayMarker,
                        ]}
                      />
                      <View>
                        <Text style={styles.sessionDayTitle}>{group.title}</Text>
                        <Text style={styles.sessionDaySubtitle}>{group.subtitle}</Text>
                      </View>
                    </View>
                    <Text style={styles.sessionDayCount}>
                      {group.sessions.length === 0
                        ? 'нет'
                        : formatSessionCount(group.sessions.length)}
                    </Text>
                  </View>

                  {group.sessions.length === 0 ? (
                    <Text style={styles.groupEmptyText}>Нет записей</Text>
                  ) : (
                    group.sessions.map((session) => {
                      const startedAt = new Date(session.startedAt);
                      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
                      const effectiveKind = getSessionKindForCalculations(
                        session,
                        endedAt ?? now,
                        sleepPlan,
                      );

                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={session.id}
                          onPress={() => openEditEditor(session)}
                          style={({ pressed }) => [
                            styles.sessionRow,
                            group.key === 'previous' ? styles.previousSessionRow : null,
                            pressed ? styles.sessionRowPressed : null,
                          ]}>
                          <View style={styles.sessionInfo}>
                            <Text style={styles.sessionTitle}>
                              {effectiveKind === 'night' ? 'Ночной сон' : 'Сон'}
                            </Text>
                            <Text style={styles.sessionTime}>
                              {formatSessionTimeRange(startedAt, endedAt, now)}
                            </Text>
                          </View>
                          <Text style={styles.sessionDuration}>
                            {formatDuration(getSessionDurationMinutes(session, now))}
                          </Text>
                          <Text style={styles.sessionAction}>Изменить</Text>
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

      <SleepSessionEditorModal
        existingSessions={editModalSessions}
        isSaving={isSaving}
        latestSleepSessionId={latestSleepSessionId}
        mode={editorState?.mode ?? 'create'}
        onClose={() => setEditorState(null)}
        onDelete={handleEditorDelete}
        onSave={handleEditorSave}
        referenceDate={editorState?.referenceDate ?? now}
        shortcutBaseDate={now}
        session={editorState?.session ?? null}
        visible={editorState !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sleepPlanButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  profileButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  headerIconButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  profileButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
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
  datePickerBlock: {
    gap: spacing.xs,
  },
  dayNavigator: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayArrow: {
    width: 38,
    height: 38,
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
    fontSize: 20,
    fontWeight: '900',
  },
  dayArrowTextDisabled: {
    color: colors.textMuted,
  },
  dayTitle: {
    flex: 1,
    color: colors.text,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '900',
  },
  dateShortcutRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateShortcut: {
    minHeight: 34,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  hero: {
    minHeight: 172,
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyHero: {
    minHeight: 138,
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  status: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  timer: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
  },
  historyValue: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
  },
  helper: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 16,
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timerButton: {
    flex: 1,
  },
  manualButton: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeaderTitle: {
    flex: 1,
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  scenarioList: {
    gap: spacing.sm,
  },
  scenario: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  primaryScenario: {
    borderColor: colors.primary,
  },
  scenarioTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  scenarioText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  sessionList: {
    gap: spacing.lg,
  },
  sessionDayGroup: {
    gap: spacing.sm,
  },
  sessionDayHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sessionDayTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionDayMarker: {
    width: 5,
    height: 30,
    borderRadius: 3,
  },
  selectedSessionDayMarker: {
    backgroundColor: colors.primary,
  },
  previousSessionDayMarker: {
    backgroundColor: colors.border,
  },
  sessionDayTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sessionDaySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  sessionDayCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  groupEmptyText: {
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
  sessionRow: {
    minHeight: 72,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionRowPressed: {
    backgroundColor: colors.primarySoft,
  },
  previousSessionRow: {
    backgroundColor: colors.surfaceMuted,
  },
  sessionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionTime: {
    color: colors.textMuted,
    fontSize: 14,
  },
  sessionDuration: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sessionAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
