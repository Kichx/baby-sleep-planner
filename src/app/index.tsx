import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Stack,
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { BottleFeedingEditorModal } from '@/components/BottleFeedingEditorModal';
import { BottleFeedingIcon } from '@/components/BottleFeedingIcon';
import { EventTypeBadge } from '@/components/EventTypeBadge';
import { SleepCoachAlternativesSheet } from '@/components/SleepCoachAlternativesSheet';
import { SleepCoachCard } from '@/components/SleepCoachCard';
import { SleepCoachWhySheet } from '@/components/SleepCoachWhySheet';
import { SleepDayTimeline } from '@/components/SleepDayTimeline';
import { SleepSessionEditorModal } from '@/components/SleepSessionEditorModal';
import { SummaryCard } from '@/components/SummaryCard';
import { TodayShortSummary } from '@/components/TodayShortSummary';
import {
  DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
  DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
  DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
} from '@/constants/bottleFeeding';
import { DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
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
  buildSleepCoachAlternativesSheetVm,
  buildSleepCoachCardVm,
  buildSleepCoachWhySheetVm,
} from '@/core/mainScreenSleepCoach';
import { buildTodayShortSummaryVm } from '@/core/todayShortSummary';
import {
  addLocalCalendarDays,
  dateAtLocalNoon,
  formatLocalClock,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
  getLocalMinutesFromMidnight,
  isSameLocalCalendarDay,
  startOfLocalCalendarDay,
} from '@/core/localDateTime';
import { deriveMainScreenSleepUiState } from '@/core/mainScreenFlow';
import {
  filterSleepSessionsForDisplayedDay,
  sleepSessionOverlapsDisplayedDay,
} from '@/core/mainScreenDaySessions';
import {
  dateFromSleepDayDateKey,
  formatSleepDayDateKey,
} from '@/core/sleepDay';
import {
  buildTodayEffectiveSleepPlan,
  getActualWakeDayStartForToday,
  getTemporaryModeBadgeLabel,
  shouldShowEarlyWakeModeSuggestion,
} from '@/core/todayEffectiveSleepPlan';
import {
  checkTotalSleepAgainstOfficialGuideline,
  formatDurationRangeShort,
  getAgeInCompletedMonths,
  type OfficialSleepGuideline,
  type SleepGuidelineStatus,
} from '@/core/officialSleepGuidelines';
import { buildTodayPlanShareText } from '@/core/shareTodayPlan';
import {
  filterBottleFeedingsInCalendarDay,
  formatBottleFeedingRecordLine,
  formatLatestBottleFeedingLine,
  formatTodayBottleFeedingCountWithTopUpsLine,
  getBottleFeedingCalendarDayRange,
  isBottleFeedingTopUp,
} from '@/core/bottleFeeding';
import {
  buildDayFeedItems,
  countDayFeedRecords,
  isBottleFeedingInsideSleep,
  type DayFeedItem,
} from '@/core/dayFeed';
import {
  assignSleepDayPlanSnapshot,
  createBottleFeeding,
  createSleepSession,
  deleteBottleFeeding,
  deleteSleepSession,
  dismissEveningPlanPrompt,
  dismissSleepDayTemporaryModeSuggestion,
  enableSleepDayTemporaryMode,
  getAppSettings,
  getLatestBottleFeeding,
  getChildProfile,
  getLatestSleepSession,
  getOnboardingState,
  getSleepDayPlan,
  listSleepDayTemporaryModes,
  listTargetDayPlans,
  listBottleFeedingsInRange,
  listSleepSessionsInRange,
  startSleepSession,
  stopActiveSleepSession,
  updateBottleFeeding,
  updateSleepSession,
} from '@/db';
import { syncSleepNotificationsFromDatabase } from '@/notifications/sleepNotifications';
import {
  canAskForNotificationPermission,
  requestNotificationPermission,
} from '@/notifications/expoNotifications';
import type { OnboardingMode } from '@/types/appSettings';
import type { BottleFeeding } from '@/types/bottleFeeding';
import type {
  ChildProfile,
  SleepDayPlan,
  SleepDayTemporaryMode,
  SleepKind,
  SleepPlanPreset,
  SleepSession,
  TargetDayPlan,
} from '@/types/sleep';

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

type SelectedDayType = 'past' | 'today' | 'future';

interface LoadedSessionsForDate {
  latestSleepSessionId: string | null;
  nearbySessions: SleepSession[];
}

interface LoadedBottleFeedingsForDate {
  latestBottleFeeding: BottleFeeding | null;
  nearbyFeedings: BottleFeeding[];
  todayFeedings: BottleFeeding[];
}

interface LoadedSelectedDayData {
  actualWakeTime: Date | null;
  bottleFeedings: LoadedBottleFeedingsForDate;
  dayPlan: SleepDayPlan;
  effectivePlan: SleepPlanPreset;
  sessions: LoadedSessionsForDate;
  temporaryModes: SleepDayTemporaryMode[];
}

interface LoadedMainScreenData extends LoadedSelectedDayData {
  availablePlans: TargetDayPlan[];
  eveningPlanPromptDismissedDateKey: string | null;
  hasActiveTargetPlan: boolean;
  onboardingMode: OnboardingMode | null;
  profile: ChildProfile;
}

interface SessionDayGroup {
  key: 'selected' | 'previous';
  title: string;
  subtitle: string;
  items: DayFeedItem[];
}

const DAY_MINUTES = 24 * 60;
const ACTIVE_SLEEP_DETAIL_SECONDS = 5 * 60;
const DEFAULT_TIMER_REFRESH_MS = 30_000;
const ACTIVE_SLEEP_DETAIL_REFRESH_MS = 1_000;
const TIMELINE_ROW_HEIGHT = 62;
const MAX_PAST_DAY_FEEDBACK_LINES = 3;
const FIRST_RUN_ROUTE = '/first-run' as Href;
const EVENING_PROMPT_SLEEP_PLAN_ROUTE =
  '/sleep-plan?source=evening-prompt&returnTo=home' as Href;
const BOTTLE_FEEDING_ROUTE = '/bottle-feeding' as Href;
const OFFICIAL_SLEEP_SOURCE_SUMMARY =
  'Источники: ВОЗ, CDC, AASM, Australian/Canadian 24-Hour';

function formatClock(date: Date): string {
  return formatLocalClock(date);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function parseBirthDateValue(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const [rawYear, rawMonth, rawDay] = value.split('-');
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function buildFallbackChildProfile(): ChildProfile {
  return {
    birthDate: null,
    bottleFeedingDefaultVolumeMl: DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
    bottleFeedingEnabled: false,
    bottleFeedingNotifyDuringSleep: DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
    bottleFeedingPromptDismissed: false,
    bottleFeedingReminderIntervalMinutes: DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
    bottleFeedingRemindersEnabled: false,
    bottleFeedingTopUpThresholdMl: DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
    createdAt: new Date().toISOString(),
    id: DEFAULT_CHILD_ID,
    name: DEFAULT_CHILD_NAME,
    photoUri: null,
  };
}

function getOfficialRangeCaption(params: {
  recommendedMinMinutes: number | null;
  recommendedMaxMinutes: number | null;
}): string {
  if (params.recommendedMinMinutes === null || params.recommendedMaxMinutes === null) {
    return 'ориентир не рассчитан';
  }

  return `ориентир ${formatDurationRangeShort(
    params.recommendedMinMinutes,
    params.recommendedMaxMinutes,
  )}`;
}

function getOfficialSleepStatusLabel(status: SleepGuidelineStatus): string {
  switch (status) {
    case 'below_recommended':
      return 'ниже ориентира';
    case 'above_recommended':
      return 'выше ориентира';
    case 'within_recommended':
      return 'в рамках ориентира';
    case 'unknown':
      return 'ориентир не рассчитан';
  }
}

function formatOfficialGuidelineSources(guideline: OfficialSleepGuideline | null): string {
  if (!guideline) {
    return `${OFFICIAL_SLEEP_SOURCE_SUMMARY}. Укажите дату рождения, чтобы выбрать возрастной диапазон.`;
  }

  const sourceNames = guideline.sourceNames.map((sourceName) => {
    if (sourceName === 'Australian 24-Hour Movement Guidelines') {
      return 'Australian 24-Hour';
    }

    if (sourceName === 'Canadian 24-Hour Movement Guidelines') {
      return 'Canadian 24-Hour';
    }

    return sourceName;
  });

  return `Источники: ${sourceNames.join(', ')}`;
}

function formatClockMinutes(minutes: number): string {
  const normalizedMinutes = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(normalizedMinutes / 60);
  const restMinutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
}

function formatClockRange(startMinutes: number, endMinutes: number): string {
  const start = formatClockMinutes(startMinutes);
  const end = formatClockMinutes(endMinutes);

  return start === end ? start : `${start}-${end}`;
}

function formatDurationDelta(deltaMinutes: number): string {
  if (Math.abs(deltaMinutes) <= 30) {
    return 'близко к цели';
  }

  const sign = deltaMinutes > 0 ? '+' : '-';

  return `${sign}${formatDuration(Math.abs(deltaMinutes))} к цели`;
}

function formatNapDelta(delta: number): string {
  if (delta === 0) {
    return 'по плану';
  }

  return `${delta > 0 ? '+' : ''}${delta} к плану`;
}

function formatBedtimeDelta(deltaMinutes: number | null): string {
  if (deltaMinutes === null) {
    return 'нет ночного сна';
  }

  if (Math.abs(deltaMinutes) <= 30) {
    return 'в плане';
  }

  return `${formatDuration(Math.abs(deltaMinutes))} ${deltaMinutes > 0 ? 'позже' : 'раньше'}`;
}

function isDurationOffPlan(deltaMinutes: number): boolean {
  return Math.abs(deltaMinutes) > 30;
}

function getDateDeltaOutsideRange(date: Date, rangeStart: Date, rangeEnd: Date): number {
  if (date.getTime() < rangeStart.getTime()) {
    return -minutesBetween(date, rangeStart);
  }

  if (date.getTime() > rangeEnd.getTime()) {
    return minutesBetween(rangeEnd, date);
  }

  return 0;
}

function getWakeUpDeltaMinutes(
  wakeUpAt: Date | null,
  dayStart: Date,
  plan: SleepPlanPreset,
): number | null {
  if (!wakeUpAt) {
    return null;
  }

  const nextMorning = addMinutes(dayStart, DAY_MINUTES);
  const rangeStart = dateAtMinutes(nextMorning, plan.wakeUpStartMinutes);
  let rangeEnd = dateAtMinutes(nextMorning, plan.wakeUpEndMinutes);

  if (rangeEnd.getTime() < rangeStart.getTime()) {
    rangeEnd = addMinutes(rangeEnd, DAY_MINUTES);
  }

  return getDateDeltaOutsideRange(wakeUpAt, rangeStart, rangeEnd);
}

function getElapsedSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1_000));
}

function formatDurationWithSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes} мин ${restSeconds} сек`;
}

function startOfCalendarDay(date: Date): Date {
  return startOfLocalCalendarDay(date);
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return isSameLocalCalendarDay(first, second);
}

function dateAtNoon(date: Date): Date {
  return dateAtLocalNoon(date);
}

function parseSelectedDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = dateFromSleepDayDateKey(value);

  return formatSleepDayDateKey(date) === value ? date : null;
}

function addCalendarDays(date: Date, days: number): Date {
  return addLocalCalendarDays(date, days);
}

function getCalendarDayDiff(first: Date, second: Date): number {
  return getLocalCalendarDayDiff(first, second);
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
  actualDayStart: Date | null = null,
): Date {
  if (getSelectedDayType(selectedDate, now) === 'today') {
    return actualDayStart ?? getDayStart(now, plan);
  }

  return dateAtMinutes(dateAtNoon(selectedDate), plan.dayStartMinutes);
}

function formatDateLabel(date: Date): string {
  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'long',
  });
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

function sortSessionsNewestFirst(sessions: SleepSession[]): SleepSession[] {
  return [...sessions].sort(
    (first, second) =>
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime(),
  );
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

interface CurrentTimerTextProps {
  currentDurationMinutes: number;
  isLoading: boolean;
  isSleeping: boolean;
  statusStartedAt: Date;
}

function CurrentTimerText({
  currentDurationMinutes,
  isLoading,
  isSleeping,
  statusStartedAt,
}: CurrentTimerTextProps) {
  const [localNow, setLocalNow] = useState(() => new Date());
  const statusStartedAtTime = statusStartedAt.getTime();
  const elapsedSeconds = isSleeping
    ? getElapsedSeconds(new Date(statusStartedAtTime), localNow)
    : 0;
  const shouldShowSeconds = isSleeping && elapsedSeconds < ACTIVE_SLEEP_DETAIL_SECONDS;
  const timerDurationMinutes = isSleeping && shouldShowSeconds
    ? Math.floor(elapsedSeconds / 60)
    : currentDurationMinutes;
  const timerValue = shouldShowSeconds
    ? formatDurationWithSeconds(elapsedSeconds)
    : formatDuration(timerDurationMinutes);

  useEffect(() => {
    if (!isSleeping || !shouldShowSeconds) {
      return;
    }

    setLocalNow(new Date());

    const timer = setInterval(() => {
      setLocalNow(new Date());
    }, ACTIVE_SLEEP_DETAIL_REFRESH_MS);

    return () => {
      clearInterval(timer);
    };
  }, [isSleeping, shouldShowSeconds, statusStartedAtTime]);

  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.86}
      numberOfLines={1}
      style={styles.currentTimer}>
      {isLoading ? '--' : timerValue}
    </Text>
  );
}

export default function TodaySleepScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [nearbySessions, setNearbySessions] = useState<SleepSession[]>([]);
  const [nearbyBottleFeedings, setNearbyBottleFeedings] = useState<BottleFeeding[]>([]);
  const [latestBottleFeeding, setLatestBottleFeeding] = useState<BottleFeeding | null>(null);
  const [todayBottleFeedings, setTodayBottleFeedings] = useState<BottleFeeding[]>([]);
  const [latestSleepSessionId, setLatestSleepSessionId] = useState<string | null>(null);
  const [childBirthDate, setChildBirthDate] = useState<string | null>(null);
  const [bottleFeedingEnabled, setBottleFeedingEnabled] = useState(false);
  const [bottleFeedingDefaultVolumeMl, setBottleFeedingDefaultVolumeMl] = useState(
    DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
  );
  const [bottleFeedingTopUpThresholdMl, setBottleFeedingTopUpThresholdMl] = useState(
    DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  );
  const [showFeedingsInTimeline, setShowFeedingsInTimeline] = useState(true);
  const [sleepPlan, setSleepPlan] = useState(DEFAULT_SLEEP_PLAN);
  const [sleepDayPlan, setSleepDayPlan] = useState<SleepDayPlan | null>(null);
  const [sleepDayTemporaryModes, setSleepDayTemporaryModes] = useState<
    SleepDayTemporaryMode[]
  >([]);
  const [actualWakeTime, setActualWakeTime] = useState<Date | null>(null);
  const [availablePlans, setAvailablePlans] = useState<TargetDayPlan[]>([]);
  const [hasActiveTargetPlan, setHasActiveTargetPlan] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode | null>(null);
  const [childName, setChildName] = useState(DEFAULT_CHILD_NAME);
  const [eveningPlanPromptDismissedDateKey, setEveningPlanPromptDismissedDateKey] =
    useState<string | null>(null);
  const [
    isNotificationPermissionPromptDismissed,
    setIsNotificationPermissionPromptDismissed,
  ] = useState(false);
  const [
    shouldShowNotificationPermissionPrompt,
    setShouldShowNotificationPermissionPrompt,
  ] = useState(false);
  const [isRequestingNotificationPermission, setIsRequestingNotificationPermission] =
    useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingDayPlan, setIsChangingDayPlan] = useState(false);
  const [isPlanPickerOpen, setIsPlanPickerOpen] = useState(false);
  const [isSleepCoachWhySheetOpen, setIsSleepCoachWhySheetOpen] = useState(false);
  const [isSleepCoachAlternativesSheetOpen, setIsSleepCoachAlternativesSheetOpen] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [bottleFeedingEditorState, setBottleFeedingEditorState] =
    useState<BottleFeedingEditorState | null>(null);

  const fetchSessionsForDate = useCallback(
    async (
      referenceDate: Date,
      currentNow: Date,
      plan: SleepPlanPreset,
    ): Promise<LoadedSessionsForDate> => {
      const dayStart = getSleepDayStartForSelection(referenceDate, currentNow, plan);
      const dayEnd = addMinutes(dayStart, DAY_MINUTES);
      const previousDayStart = addMinutes(dayStart, -DAY_MINUTES);
      const loadedSessions = await listSleepSessionsInRange(db, previousDayStart, dayEnd);
      const latestSleepSession = await getLatestSleepSession(db);
      const nearbySessionsForDisplay = filterSleepSessionsForDisplayedDay(
        loadedSessions,
        previousDayStart,
        dayEnd,
        currentNow,
      );

      return {
        latestSleepSessionId: latestSleepSession?.id ?? null,
        nearbySessions: nearbySessionsForDisplay,
      };
    },
    [db],
  );

  const fetchBottleFeedingsForDate = useCallback(
    async (
      referenceDate: Date,
      currentNow: Date,
      enabled: boolean,
    ): Promise<LoadedBottleFeedingsForDate> => {
      if (!enabled) {
        return {
          latestBottleFeeding: null,
          nearbyFeedings: [],
          todayFeedings: [],
        };
      }

      const selectedFeedingRange = getBottleFeedingCalendarDayRange(referenceDate);
      const todayFeedingRange = getBottleFeedingCalendarDayRange(currentNow);
      const previousFeedingRange = getBottleFeedingCalendarDayRange(
        addCalendarDays(referenceDate, -1),
      );
      const [loadedFeedings, todayFeedings, latestFeeding] = await Promise.all([
        listBottleFeedingsInRange(
          db,
          previousFeedingRange.start,
          selectedFeedingRange.end,
        ),
        listBottleFeedingsInRange(db, todayFeedingRange.start, todayFeedingRange.end),
        getLatestBottleFeeding(db),
      ]);

      return {
        latestBottleFeeding: latestFeeding,
        nearbyFeedings: loadedFeedings,
        todayFeedings,
      };
    },
    [db],
  );

  const loadSelectedDayData = useCallback(
    async (
      referenceDate: Date,
      currentNow: Date,
      isBottleFeedingEnabled: boolean,
      hasActiveTargetPlanForDay: boolean,
    ): Promise<LoadedSelectedDayData> => {
      const loadedDayPlan = await getSleepDayPlan(db, referenceDate, currentNow);
      const loadedSessions = await fetchSessionsForDate(
        referenceDate,
        currentNow,
        loadedDayPlan.plan,
      );
      let effectivePlan = loadedDayPlan.plan;
      let actualWakeTimeForDay: Date | null = null;
      let temporaryModes: SleepDayTemporaryMode[] = [];

      if (
        hasActiveTargetPlanForDay &&
        getSelectedDayType(referenceDate, currentNow) === 'today'
      ) {
        temporaryModes = await listSleepDayTemporaryModes(
          db,
          loadedDayPlan.childId,
          loadedDayPlan.sleepDayDate,
        );

        const effectivePlanResult = buildTodayEffectiveSleepPlan({
          basePlan: buildTargetPlanFromSleepDayPlan(loadedDayPlan),
          now: currentNow,
          sessions: loadedSessions.nearbySessions,
          sleepDayDateKey: loadedDayPlan.sleepDayDate,
          temporaryModes,
        });

        effectivePlan = effectivePlanResult.plan;
        actualWakeTimeForDay = effectivePlanResult.actualWakeTime;
      }

      const loadedBottleFeedings = await fetchBottleFeedingsForDate(
        referenceDate,
        currentNow,
        isBottleFeedingEnabled,
      );

      return {
        actualWakeTime: actualWakeTimeForDay,
        bottleFeedings: loadedBottleFeedings,
        dayPlan: loadedDayPlan,
        effectivePlan,
        sessions: loadedSessions,
        temporaryModes,
      };
    },
    [db, fetchBottleFeedingsForDate, fetchSessionsForDate],
  );

  const loadMainScreenData = useCallback(
    async (referenceDate: Date, currentNow: Date): Promise<LoadedMainScreenData> => {
      const profile = await getChildProfile(db).catch(() => buildFallbackChildProfile());
      const [appSettings, plans] = await Promise.all([
        getAppSettings(db),
        listTargetDayPlans(db).catch(() => []),
      ]);
      const hasActivePlan = plans.some((plan) => plan.isActive);
      const selectedDayData = await loadSelectedDayData(
        referenceDate,
        currentNow,
        profile.bottleFeedingEnabled,
        hasActivePlan,
      );
      const loadedOnboardingMode = appSettings.onboardingMode;

      return {
        ...selectedDayData,
        availablePlans: plans,
        eveningPlanPromptDismissedDateKey:
          appSettings.eveningPlanPromptDismissedDateKey,
        hasActiveTargetPlan: hasActivePlan,
        onboardingMode: loadedOnboardingMode,
        profile,
      };
    },
    [db, loadSelectedDayData],
  );

  function applySelectedDayData(loadedData: LoadedSelectedDayData, currentNow: Date) {
    setNow(currentNow);
    setSleepDayPlan(loadedData.dayPlan);
    setSleepPlan(loadedData.effectivePlan);
    setSleepDayTemporaryModes(loadedData.temporaryModes);
    setActualWakeTime(loadedData.actualWakeTime);
    setNearbySessions(loadedData.sessions.nearbySessions);
    setNearbyBottleFeedings(loadedData.bottleFeedings.nearbyFeedings);
    setLatestBottleFeeding(loadedData.bottleFeedings.latestBottleFeeding);
    setTodayBottleFeedings(loadedData.bottleFeedings.todayFeedings);
    setLatestSleepSessionId(loadedData.sessions.latestSleepSessionId);
  }

  function applyMainScreenData(loadedData: LoadedMainScreenData, currentNow: Date) {
    setBottleFeedingEnabled(loadedData.profile.bottleFeedingEnabled);
    setBottleFeedingDefaultVolumeMl(loadedData.profile.bottleFeedingDefaultVolumeMl);
    setBottleFeedingTopUpThresholdMl(loadedData.profile.bottleFeedingTopUpThresholdMl);
    setChildBirthDate(loadedData.profile.birthDate);
    setChildName(loadedData.profile.name);
    setAvailablePlans(loadedData.availablePlans);
    setHasActiveTargetPlan(loadedData.hasActiveTargetPlan);
    setOnboardingMode(loadedData.onboardingMode);
    setEveningPlanPromptDismissedDateKey(
      loadedData.eveningPlanPromptDismissedDateKey,
    );
    applySelectedDayData(loadedData, currentNow);
  }

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadMainScreen() {
        const loadedAt = new Date();

        setIsLoading(true);

        try {
          const onboardingState = await getOnboardingState(db);

          if (onboardingState === 'not_started') {
            if (isActive) {
              router.replace(FIRST_RUN_ROUTE);
              setIsLoading(false);
            }

            return;
          }

          const loadedData = await loadMainScreenData(selectedDate, loadedAt);

          if (isActive) {
            applyMainScreenData(loadedData, loadedAt);
            setErrorMessage(null);
          }
        } catch {
          if (isActive) {
            setErrorMessage('Не удалось загрузить сон');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      loadMainScreen();

      return () => {
        isActive = false;
      };
    }, [db, loadMainScreenData, router, selectedDate]),
  );

  const dayType = useMemo(() => getSelectedDayType(selectedDate, now), [now, selectedDate]);
  const isToday = dayType === 'today';
  const todayBottleFeedingStatsLine = useMemo(
    () =>
      formatTodayBottleFeedingCountWithTopUpsLine(
        todayBottleFeedings,
        bottleFeedingTopUpThresholdMl,
      ),
    [bottleFeedingTopUpThresholdMl, todayBottleFeedings],
  );
  const selectedDayTitle = useMemo(
    () => formatSelectedDayTitle(selectedDate, now),
    [now, selectedDate],
  );
  const baseSleepPlan = sleepDayPlan?.plan ?? sleepPlan;
  const actualTodayDayStart = useMemo(
    () =>
      isToday
        ? getActualWakeDayStartForToday({
            actualWakeTime,
            basePlan: baseSleepPlan,
            now,
          })
        : null,
    [actualWakeTime, baseSleepPlan, isToday, now],
  );
  const selectedDayStart = useMemo(
    () => getSleepDayStartForSelection(selectedDate, now, sleepPlan, actualTodayDayStart),
    [actualTodayDayStart, now, selectedDate, sleepPlan],
  );
  const selectedDayEnd = useMemo(() => addMinutes(selectedDayStart, DAY_MINUTES), [
    selectedDayStart,
  ]);
  const selectedSessionsForDay = useMemo(
    () =>
      filterSleepSessionsForDisplayedDay(
        nearbySessions,
        selectedDayStart,
        selectedDayEnd,
        now,
        {
          includeNightEndingAtStart: isToday,
        },
      ),
    [isToday, nearbySessions, now, selectedDayEnd, selectedDayStart],
  );
  const sessionDayGroups = useMemo<SessionDayGroup[]>(() => {
    const shouldShowBottleFeedingsInTimeline =
      bottleFeedingEnabled && showFeedingsInTimeline;
    const timelineBottleFeedings = shouldShowBottleFeedingsInTimeline
      ? nearbyBottleFeedings
      : [];
    const previousDayStart = addMinutes(selectedDayStart, -DAY_MINUTES);
    const previousDate = addCalendarDays(selectedDate, -1);
    const selectedGroupSessions = selectedSessionsForDay;
    const selectedGroupFeedings = shouldShowBottleFeedingsInTimeline
      ? filterBottleFeedingsInCalendarDay(nearbyBottleFeedings, selectedDate)
      : [];
    const previousGroupSessions = nearbySessions.filter((session) => {
      if (
        sleepSessionOverlapsDisplayedDay(session, selectedDayStart, selectedDayEnd, now, {
          includeNightEndingAtStart: isToday,
        })
      ) {
        return false;
      }

      return sleepSessionOverlapsDisplayedDay(
        session,
        previousDayStart,
        selectedDayStart,
        now,
      );
    });
    const previousGroupFeedings = shouldShowBottleFeedingsInTimeline
      ? filterBottleFeedingsInCalendarDay(nearbyBottleFeedings, previousDate)
      : [];
    const selectedNestedFeedingIds = new Set(
      timelineBottleFeedings
        .filter((feeding) =>
          selectedGroupSessions.some((session) =>
            isBottleFeedingInsideSleep(feeding, session, now, selectedDayEnd),
          ),
        )
        .map((feeding) => feeding.id),
    );
    const previousNestedFeedingIds = new Set(
      timelineBottleFeedings
        .filter((feeding) =>
          previousGroupSessions.some((session) =>
            isBottleFeedingInsideSleep(feeding, session, now, selectedDayStart),
          ),
        )
        .map((feeding) => feeding.id),
    );
    const selectedStandaloneFeedings = selectedGroupFeedings.filter(
      (feeding) => !previousNestedFeedingIds.has(feeding.id),
    );
    const previousStandaloneFeedings = previousGroupFeedings.filter(
      (feeding) => !selectedNestedFeedingIds.has(feeding.id),
    );

    return [
      {
        items: buildDayFeedItems({
          feedings: timelineBottleFeedings,
          now,
          rangeEnd: selectedDayEnd,
          rangeStart: selectedDayStart,
          sessions: selectedGroupSessions,
          standaloneFeedings: selectedStandaloneFeedings,
        }),
        key: 'selected',
        subtitle: formatDateLabel(selectedDate),
        title: formatSessionGroupTitle(selectedDate, now),
      },
      {
        items: buildDayFeedItems({
          feedings: timelineBottleFeedings,
          now,
          rangeEnd: selectedDayStart,
          rangeStart: previousDayStart,
          sessions: previousGroupSessions,
          standaloneFeedings: previousStandaloneFeedings,
        }),
        key: 'previous',
        subtitle: formatDateLabel(previousDate),
        title: formatSessionGroupTitle(previousDate, now),
      },
    ];
  }, [
    bottleFeedingEnabled,
    nearbyBottleFeedings,
    nearbySessions,
    now,
    selectedDate,
    selectedDayEnd,
    selectedDayStart,
    selectedSessionsForDay,
    showFeedingsInTimeline,
    isToday,
  ]);
  useEffect(() => {
    const routeDate = parseSelectedDateParam(params.date);

    if (!routeDate) {
      return;
    }

    setSelectedDate((currentDate) =>
      formatSleepDayDateKey(currentDate) === formatSleepDayDateKey(routeDate)
        ? currentDate
        : routeDate,
    );
  }, [params.date]);

  const editModalSessions = useMemo(() => {
    const uniqueSessions = new Map<string, SleepSession>();

    [...nearbySessions, ...selectedSessionsForDay].forEach((session) => {
      uniqueSessions.set(session.id, session);
    });

    return Array.from(uniqueSessions.values());
  }, [nearbySessions, selectedSessionsForDay]);
  const summaryReferenceDate = dayType === 'today' ? now : dateAtNoon(selectedDate);
  const childBirthDateValue = useMemo(
    () => parseBirthDateValue(childBirthDate),
    [childBirthDate],
  );
  const childAgeMonths = useMemo(
    () =>
      childBirthDateValue
        ? getAgeInCompletedMonths(childBirthDateValue, summaryReferenceDate)
        : null,
    [childBirthDateValue, summaryReferenceDate],
  );
  const daySummary = useMemo(
    () =>
      buildSleepDaySummary(selectedSessionsForDay, summaryReferenceDate, now, sleepPlan, {
        dayStart: selectedDayStart,
      }),
    [now, selectedDayStart, selectedSessionsForDay, sleepPlan, summaryReferenceDate],
  );
  const timelineSegments = useMemo(
    () =>
      buildSleepTimelineSegments(
        selectedSessionsForDay,
        selectedDayStart,
        selectedDayEnd,
        now,
        sleepPlan,
      ),
    [now, selectedDayEnd, selectedDayStart, selectedSessionsForDay, sleepPlan],
  );
  const snapshot = useMemo(
    () =>
      buildTodaySleepSnapshot(selectedSessionsForDay, now, sleepPlan, {
        dayStart: selectedDayStart,
      }),
    [now, selectedDayStart, selectedSessionsForDay, sleepPlan],
  );
  const currentPlanName = sleepDayPlan?.sourcePlanName ?? 'Основной';
  const currentSleepDayDateKey = sleepDayPlan?.sleepDayDate ?? null;
  const mainScreenSleepUi = deriveMainScreenSleepUiState({
    eveningPlanPromptDismissedDateKey,
    hasActiveTargetPlan,
    nowMinutesFromMidnight: getLocalMinutesFromMidnight(now),
    onboardingMode,
    selectedDayType: dayType,
    selectedSleepSessionCount: selectedSessionsForDay.length,
    sleepDayDateKey: currentSleepDayDateKey,
  });
  const canChangeSleepDayPlan =
    mainScreenSleepUi.hasActiveTargetPlan &&
    mainScreenSleepUi.isPastSelected &&
    availablePlans.length > 0;
  const isSleeping = mainScreenSleepUi.isTodaySelected && snapshot.state === 'sleeping';
  const hasPersistedCurrentPlan = useMemo(
    () =>
      hasActiveTargetPlan && sleepDayPlan?.sourcePlanId
        ? availablePlans.some((plan) => plan.id === sleepDayPlan.sourcePlanId)
        : false,
    [availablePlans, hasActiveTargetPlan, sleepDayPlan?.sourcePlanId],
  );
  const temporaryModeBadgeLabel = mainScreenSleepUi.canShowTemporaryModeBadges
    ? getTemporaryModeBadgeLabel(sleepDayTemporaryModes)
    : null;
  const sleepCoachInput = {
    now,
    plan: sleepPlan,
    sleepDayStart: selectedDayStart,
    snapshot,
    temporaryModeBadge: temporaryModeBadgeLabel,
    viewState: mainScreenSleepUi,
  };
  const sleepCoachCard = buildSleepCoachCardVm(sleepCoachInput);
  const sleepCoachWhySheet = buildSleepCoachWhySheetVm(sleepCoachInput);
  const sleepCoachAlternativesSheet = buildSleepCoachAlternativesSheetVm(sleepCoachInput);
  const todayShortSummary = buildTodayShortSummaryVm({
    bottleFeedingEnabled,
    daySummary,
    hasDetails: sleepCoachWhySheet.visible,
    latestBottleFeeding,
    now,
    plan: sleepPlan,
    snapshot,
    viewState: mainScreenSleepUi,
  });
  useEffect(() => {
    if (!sleepCoachWhySheet.visible && isSleepCoachWhySheetOpen) {
      setIsSleepCoachWhySheetOpen(false);
    }
  }, [isSleepCoachWhySheetOpen, sleepCoachWhySheet.visible]);
  useEffect(() => {
    if (!sleepCoachAlternativesSheet.visible && isSleepCoachAlternativesSheetOpen) {
      setIsSleepCoachAlternativesSheetOpen(false);
    }
  }, [isSleepCoachAlternativesSheetOpen, sleepCoachAlternativesSheet.visible]);
  const shouldShowEarlyWakeSuggestion =
    mainScreenSleepUi.canShowCoachBlocks &&
    hasPersistedCurrentPlan &&
    shouldShowEarlyWakeModeSuggestion({
      actualWakeTime,
      basePlan: baseSleepPlan,
      temporaryModes: sleepDayTemporaryModes,
    });
  const buttonLabel = isSaving
    ? 'Сохраняем...'
    : isSleeping
      ? 'Завершить сон'
      : 'Начать сон';
  const shouldShowPlanBasedUi = mainScreenSleepUi.canShowPlanBasedBlocks;
  const shouldShowPlanStartNoDataHint = mainScreenSleepUi.showPlanStartNoDataHint;
  const hasCurrentStatusFact =
    isSleeping || selectedSessionsForDay.some((session) => session.endedAt !== null);
  const shouldShowHeroPlaceholder = !shouldShowPlanBasedUi && !hasCurrentStatusFact;
  const planStartSleepNowLabel =
    shouldShowPlanStartNoDataHint && inferSleepKindForStart(now, sleepPlan) === 'night'
      ? 'Начать ночь'
      : 'Начать сон';
  const shouldShowEveningPlanPromptCard = mainScreenSleepUi.canShowEveningPlanPrompt;
  const hasPastDayRecords = daySummary.sleepSessionCount > 0;
  const pastDayTotalSleepMinutes = daySummary.totalDaySleepMinutes + daySummary.totalNightSleepMinutes;
  const pastDayOfficialSleepCheck = useMemo(
    () =>
      checkTotalSleepAgainstOfficialGuideline({
        ageMonths: childAgeMonths,
        totalSleepMinutes: pastDayTotalSleepMinutes,
      }),
    [childAgeMonths, pastDayTotalSleepMinutes],
  );
  const pastDayOfficialSleepCaption = hasPastDayRecords
    ? `${getOfficialRangeCaption(pastDayOfficialSleepCheck)} · ${getOfficialSleepStatusLabel(
        pastDayOfficialSleepCheck.status,
      )}`
    : getOfficialRangeCaption(pastDayOfficialSleepCheck);
  const pastDayFeedbackLines = daySummary.feedbackLines.slice(0, MAX_PAST_DAY_FEEDBACK_LINES);
  const pastDayMetrics = useMemo(() => {
    const wakeUpDeltaMinutes = getWakeUpDeltaMinutes(
      daySummary.wakeUpAt,
      selectedDayStart,
      sleepPlan,
    );

    return [
      {
        caption: hasPastDayRecords
          ? formatDurationDelta(daySummary.targetAwakeDeltaMinutes)
          : undefined,
        isAttention:
          hasPastDayRecords && isDurationOffPlan(daySummary.targetAwakeDeltaMinutes),
        label: 'Бодрствование',
        value: hasPastDayRecords ? formatDuration(daySummary.totalAwakeMinutes) : '--',
      },
      {
        caption: hasPastDayRecords
          ? formatDurationDelta(daySummary.targetDaySleepDeltaMinutes)
          : undefined,
        isAttention:
          hasPastDayRecords && isDurationOffPlan(daySummary.targetDaySleepDeltaMinutes),
        label: 'Сон днем',
        value: hasPastDayRecords ? formatDuration(daySummary.totalDaySleepMinutes) : '--',
      },
      {
        caption: hasPastDayRecords ? 'за сутки' : undefined,
        isAttention: false,
        label: 'Ночной сон',
        value: hasPastDayRecords ? formatDuration(daySummary.totalNightSleepMinutes) : '--',
      },
      {
        caption: hasPastDayRecords ? formatNapDelta(daySummary.napCountDelta) : undefined,
        isAttention: hasPastDayRecords && daySummary.napCountDelta !== 0,
        label: 'Сны',
        value: hasPastDayRecords ? `${daySummary.completedNaps}/${sleepPlan.napCount}` : '--',
      },
      {
        caption: hasPastDayRecords
          ? formatBedtimeDelta(daySummary.targetBedtimeDeltaMinutes)
          : undefined,
        isAttention:
          hasPastDayRecords &&
          daySummary.targetBedtimeDeltaMinutes !== null &&
          isDurationOffPlan(daySummary.targetBedtimeDeltaMinutes),
        label: 'Отбой',
        value:
          hasPastDayRecords && daySummary.bedtimeAt ? formatClock(daySummary.bedtimeAt) : '--',
      },
      {
        caption: hasPastDayRecords
          ? `план ${formatClockRange(sleepPlan.wakeUpStartMinutes, sleepPlan.wakeUpEndMinutes)}`
          : undefined,
        isAttention:
          hasPastDayRecords && wakeUpDeltaMinutes !== null && wakeUpDeltaMinutes !== 0,
        label: 'Подъем',
        value: hasPastDayRecords && daySummary.wakeUpAt ? formatClock(daySummary.wakeUpAt) : '--',
      },
    ];
  }, [daySummary, hasPastDayRecords, selectedDayStart, sleepPlan]);
  const canGoForward = useMemo(() => {
    const tomorrow = addCalendarDays(now, 1);

    return startOfCalendarDay(selectedDate).getTime() < startOfCalendarDay(tomorrow).getTime();
  }, [now, selectedDate]);

  useEffect(() => {
    setIsPlanPickerOpen(false);
  }, [selectedDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, DEFAULT_TIMER_REFRESH_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (
      !mainScreenSleepUi.canShowCoachBlocks ||
      onboardingMode !== 'plan_saved' ||
      isNotificationPermissionPromptDismissed
    ) {
      setShouldShowNotificationPermissionPrompt(false);
      return () => {
        isActive = false;
      };
    }

    canAskForNotificationPermission()
      .then((canAsk) => {
        if (isActive) {
          setShouldShowNotificationPermissionPrompt(canAsk);
        }
      })
      .catch(() => {
        if (isActive) {
          setShouldShowNotificationPermissionPrompt(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    isNotificationPermissionPromptDismissed,
    mainScreenSleepUi.canShowCoachBlocks,
    onboardingMode,
  ]);

  function openEditEditor(session: SleepSession) {
    setEditorState({
      mode: 'edit',
      referenceDate: session.endedAt ? new Date(session.endedAt) : now,
      session,
    });
  }

  async function reloadSelectedDay(referenceDate: Date, currentNow: Date) {
    const loadedData = await loadSelectedDayData(
      referenceDate,
      currentNow,
      bottleFeedingEnabled,
      hasActiveTargetPlan,
    );

    applySelectedDayData(loadedData, currentNow);
  }

  function openSleepCoachWhy() {
    if (!sleepCoachWhySheet.visible) {
      return;
    }

    setIsSleepCoachWhySheetOpen(true);
  }

  function closeSleepCoachWhy() {
    setIsSleepCoachWhySheetOpen(false);
  }

  function openSleepCoachAlternatives() {
    if (!sleepCoachAlternativesSheet.visible) {
      return;
    }

    setIsSleepCoachAlternativesSheetOpen(true);
  }

  function closeSleepCoachAlternatives() {
    setIsSleepCoachAlternativesSheetOpen(false);
  }

  function openEveningPromptSleepPlan() {
    router.push(EVENING_PROMPT_SLEEP_PLAN_ROUTE);
  }

  function openBottleFeeding() {
    router.push(BOTTLE_FEEDING_ROUTE);
  }

  function openCreateEditor() {
    setEditorState({
      mode: 'create',
      referenceDate: isToday ? new Date() : dateAtNoon(selectedDate),
      session: null,
    });
  }

  function openCreateBottleFeedingEditor() {
    setBottleFeedingEditorState({
      feeding: null,
      mode: 'create',
      referenceDate: new Date(),
    });
  }

  function openEditBottleFeedingEditor(feeding: BottleFeeding) {
    setBottleFeedingEditorState({
      feeding,
      mode: 'edit',
      referenceDate: new Date(feeding.startedAt),
    });
  }

  function selectQuickDate(dayOffset: -1 | 0) {
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

  function syncNotificationsInBackground(actionAt: Date) {
    void syncSleepNotificationsFromDatabase(db, actionAt).catch(() => undefined);
  }

  async function handleDismissEveningPlanPrompt() {
    if (!mainScreenSleepUi.canShowEveningPlanPrompt || !currentSleepDayDateKey) {
      return;
    }

    const actionAt = new Date();
    const dateKey = currentSleepDayDateKey;
    const previousDismissedDateKey = eveningPlanPromptDismissedDateKey;

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);
    setEveningPlanPromptDismissedDateKey(dateKey);

    try {
      await dismissEveningPlanPrompt(db, dateKey);
    } catch {
      setEveningPlanPromptDismissedDateKey(previousDismissedDateKey);
      setErrorMessage('Не удалось скрыть подсказку');
    } finally {
      setIsSaving(false);
    }
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
        const activeSession = selectedSessionsForDay.find((session) => session.endedAt === null);
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
      syncNotificationsInBackground(actionAt);
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
      syncNotificationsInBackground(actionAt);
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
      syncNotificationsInBackground(actionAt);
    } catch {
      setErrorMessage('Не удалось удалить запись');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBottleFeedingSave(input: { startedAt: Date; volumeMl: number }) {
    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (bottleFeedingEditorState?.mode === 'edit') {
        await updateBottleFeeding(db, bottleFeedingEditorState.feeding.id, input);
      } else {
        await createBottleFeeding(db, input);
      }

      await reloadSelectedDay(selectedDate, actionAt);
      setBottleFeedingEditorState(null);
      syncNotificationsInBackground(actionAt);
    } catch {
      setErrorMessage('Не удалось сохранить кормление');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBottleFeedingDelete() {
    if (bottleFeedingEditorState?.mode !== 'edit') {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await deleteBottleFeeding(db, bottleFeedingEditorState.feeding.id);
      await reloadSelectedDay(selectedDate, actionAt);
      setBottleFeedingEditorState(null);
      syncNotificationsInBackground(actionAt);
    } catch {
      setErrorMessage('Не удалось удалить кормление');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSleepDayPlanSelect(planId: string) {
    if (!canChangeSleepDayPlan) {
      return;
    }

    const actionAt = new Date();

    setIsChangingDayPlan(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await assignSleepDayPlanSnapshot(db, selectedDate, planId);
      await reloadSelectedDay(selectedDate, actionAt);
      setIsPlanPickerOpen(false);
    } catch {
      setErrorMessage('Не удалось сменить план дня');
    } finally {
      setIsChangingDayPlan(false);
    }
  }

  async function handleEnableEarlyWakeMode() {
    if (
      !mainScreenSleepUi.canShowCoachBlocks ||
      !sleepDayPlan?.sourcePlanId ||
      !hasPersistedCurrentPlan
    ) {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await enableSleepDayTemporaryMode(
        db,
        sleepDayPlan.childId || DEFAULT_CHILD_ID,
        sleepDayPlan.sleepDayDate,
        'early_wake',
        sleepDayPlan.sourcePlanId,
      );

      await reloadSelectedDay(selectedDate, actionAt);
      syncNotificationsInBackground(actionAt);
    } catch {
      setErrorMessage('Не удалось включить ранний подъём');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDismissEarlyWakeSuggestion() {
    if (!mainScreenSleepUi.canShowCoachBlocks || !sleepDayPlan || !hasPersistedCurrentPlan) {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await dismissSleepDayTemporaryModeSuggestion(
        db,
        sleepDayPlan.childId || DEFAULT_CHILD_ID,
        sleepDayPlan.sleepDayDate,
        'early_wake',
      );
      await reloadSelectedDay(selectedDate, actionAt);
    } catch {
      setErrorMessage('Не удалось скрыть подсказку раннего подъёма');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShareTodayPlan() {
    if (!mainScreenSleepUi.isTodaySelected || !mainScreenSleepUi.canShowPlanBasedBlocks) {
      return;
    }

    const shareAt = new Date();
    const shareChildName = childName || 'ребёнок';
    const message = buildTodayPlanShareText({
      bottleFeedingTopUpThresholdMl,
      bottleFeedings: bottleFeedingEnabled ? todayBottleFeedings : undefined,
      childName,
      generatedAt: shareAt,
      latestBottleFeeding: bottleFeedingEnabled ? latestBottleFeeding : null,
      plan: sleepPlan,
      planName: currentPlanName,
      sessions: selectedSessionsForDay,
    });

    setNow(shareAt);
    setErrorMessage(null);

    try {
      await Share.share({
        message,
        title: `Сон на сегодня: ${shareChildName}`,
      });
    } catch {
      setErrorMessage('Не удалось поделиться планом');
    }
  }

  async function handleEnableNotificationPermission() {
    if (isRequestingNotificationPermission) {
      return;
    }

    const actionAt = new Date();

    setIsRequestingNotificationPermission(true);
    setNow(actionAt);

    try {
      await syncSleepNotificationsFromDatabase(db, actionAt).catch(() => undefined);
      const isGranted = await requestNotificationPermission();

      setIsNotificationPermissionPromptDismissed(true);
      setShouldShowNotificationPermissionPrompt(false);

      if (isGranted) {
        syncNotificationsInBackground(new Date());
      }
    } catch {
      setIsNotificationPermissionPromptDismissed(true);
      setShouldShowNotificationPermissionPrompt(false);
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  }

  function handleDismissNotificationPermissionPrompt() {
    setIsNotificationPermissionPromptDismissed(true);
    setShouldShowNotificationPermissionPrompt(false);
  }

  function renderNotificationPermissionPromptCard() {
    if (!shouldShowNotificationPermissionPrompt) {
      return null;
    }

    return (
      <View style={styles.notificationPermissionPromptCard}>
        <Text style={styles.notificationPermissionPromptTitle}>
          Напоминать о следующем сне?
        </Text>
        <Text style={styles.notificationPermissionPromptText}>
          Можем мягко напоминать перед дневным сном и отбоем. Если не включать,
          план и записи продолжат работать локально.
        </Text>
        <View style={styles.notificationPermissionPromptActions}>
          <PrimaryButton
            compact
            disabled={isLoading || isSaving || isRequestingNotificationPermission}
            label={isRequestingNotificationPermission ? 'Включаем...' : 'Включить'}
            onPress={handleEnableNotificationPermission}
            style={styles.notificationPermissionPromptButton}
            textStyle={styles.notificationPermissionPromptButtonText}
          />
          <PrimaryButton
            compact
            disabled={isLoading || isSaving || isRequestingNotificationPermission}
            label="Позже"
            onPress={handleDismissNotificationPermissionPrompt}
            style={styles.notificationPermissionPromptButton}
            textStyle={styles.notificationPermissionPromptButtonText}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderEveningPlanPromptCard() {
    if (!shouldShowEveningPlanPromptCard) {
      return null;
    }

    return (
      <View style={styles.eveningPlanPromptCard}>
        <Text style={styles.eveningPlanPromptTitle}>Уже есть первые записи сна</Text>
        <Text style={styles.eveningPlanPromptText}>
          {
            'Если выбрать План дня, приложение сможет подсказывать следующий сон, примерный отбой и мягко сравнивать день с ориентиром.'
          }
        </Text>
        <View style={styles.eveningPlanPromptActions}>
          <PrimaryButton
            compact
            disabled={isLoading || isSaving}
            label="Выбрать План дня"
            onPress={openEveningPromptSleepPlan}
            style={styles.eveningPlanPromptButton}
            textStyle={styles.eveningPlanPromptButtonText}
          />
          <PrimaryButton
            compact
            disabled={isLoading || isSaving}
            label="Не сегодня"
            onPress={handleDismissEveningPlanPrompt}
            style={styles.eveningPlanPromptButton}
            textStyle={styles.eveningPlanPromptButtonText}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderTrackingOnlyEmptyHint() {
    if (isLoading || !mainScreenSleepUi.showTrackingOnlyEmptyHint) {
      return null;
    }

    return (
      <View style={styles.trackingOnlyEmptyCard}>
        <Text style={styles.trackingOnlyEmptyTitle}>Пока нет записей сна</Text>
        <Text style={styles.trackingOnlyEmptyText}>
          Начните сон сейчас или внесите уже прошедший сон вручную.
        </Text>
      </View>
    );
  }

  function renderPlanStartNoDataHint() {
    if (isLoading || !shouldShowPlanStartNoDataHint) {
      return null;
    }

    return (
      <View style={styles.planStartNoDataCard}>
        <Text style={styles.planStartNoDataTitle}>Сегодня ещё без оценки</Text>
        <Text style={styles.planStartNoDataText}>
          План выбран, но за сегодня пока нет записей сна. Без них день не оцениваем.
        </Text>
        <Text style={styles.planStartNoDataText}>
          Можно внести дневные сны по одному. Если восстанавливать день не хочется,
          начните с ближайшего сна или ночи.
        </Text>
        <View style={styles.planStartNoDataActions}>
          <PrimaryButton
            compact
            disabled={isLoading || isSaving}
            label="Внести сон"
            onPress={openCreateEditor}
            style={styles.planStartNoDataButton}
            textStyle={styles.planStartNoDataButtonText}
          />
          <PrimaryButton
            compact
            disabled={isLoading || isSaving}
            label={planStartSleepNowLabel}
            onPress={handleSleepButtonPress}
            style={styles.planStartNoDataButton}
            textStyle={styles.planStartNoDataButtonText}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderDateShortcut(label: string, dayOffset: -1 | 0) {
    const targetDate = dayOffset === 0 ? now : addCalendarDays(now, dayOffset);
    const isActive =
      startOfCalendarDay(targetDate).getTime() === startOfCalendarDay(selectedDate).getTime();

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

  function renderSleepDayPlanBar() {
    return (
      <View style={styles.dayPlanBlock}>
        <View style={styles.dayPlanBar}>
          <Text numberOfLines={1} style={styles.dayPlanText}>
            {isToday ? 'Активный план' : 'План'}: {currentPlanName}
          </Text>
          {canChangeSleepDayPlan ? (
            <Pressable
              accessibilityRole="button"
              disabled={isChangingDayPlan}
              hitSlop={4}
              onPress={() => setIsPlanPickerOpen((isOpen) => !isOpen)}
              style={({ pressed }) => [
                styles.dayPlanChangeButton,
                pressed ? styles.dayPlanChangeButtonPressed : null,
                isChangingDayPlan ? styles.dayPlanChangeButtonDisabled : null,
              ]}>
              <Text style={styles.dayPlanChangeText}>
                {isPlanPickerOpen ? 'Скрыть' : 'Сменить'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isPlanPickerOpen && canChangeSleepDayPlan ? (
          <View style={styles.dayPlanPicker}>
            {availablePlans.map((plan) => {
              const isSelected = sleepDayPlan?.sourcePlanId === plan.id;

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isChangingDayPlan || isSelected}
                  key={plan.id}
                  onPress={() => handleSleepDayPlanSelect(plan.id)}
                  style={({ pressed }) => [
                    styles.dayPlanOption,
                    isSelected ? styles.dayPlanOptionSelected : null,
                    pressed && !isSelected ? styles.dayPlanOptionPressed : null,
                  ]}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dayPlanOptionText,
                      isSelected ? styles.dayPlanOptionTextSelected : null,
                    ]}>
                    {plan.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Сон' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.datePickerBlock}>
            <View style={styles.dayNavigator}>
              <Pressable
                accessibilityLabel="Предыдущий день"
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
                accessibilityLabel="Следующий день"
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

          {renderEveningPlanPromptCard()}
          {renderNotificationPermissionPromptCard()}

          {mainScreenSleepUi.isTodaySelected || !mainScreenSleepUi.hasActiveTargetPlan
            ? null
            : renderSleepDayPlanBar()}

          {mainScreenSleepUi.isTodaySelected ? (
            <>
              <View style={styles.hero}>
                <View style={styles.heroStatusRow}>
                  <View
                    style={[
                      styles.heroStatusDot,
                      isSleeping ? styles.heroStatusDotSleeping : styles.heroStatusDotAwake,
                    ]}
                  />
                  <Text style={styles.currentStatus}>
                    {isLoading
                      ? 'Загрузка'
                      : shouldShowPlanStartNoDataHint
                        ? 'План готов'
                      : shouldShowHeroPlaceholder
                        ? 'Пока нет записей'
                        : isSleeping
                          ? 'Спит'
                          : 'Бодрствует'}
                  </Text>
                </View>
                <CurrentTimerText
                  currentDurationMinutes={snapshot.currentDurationMinutes}
                  isLoading={isLoading || shouldShowHeroPlaceholder}
                  isSleeping={isSleeping}
                  statusStartedAt={snapshot.statusStartedAt}
                />
                <Text numberOfLines={1} style={styles.currentHelper}>
                  {shouldShowPlanStartNoDataHint
                    ? 'сегодня ещё без оценки'
                    : shouldShowHeroPlaceholder
                    ? 'начните сон или внесите запись'
                    : `с ${formatClock(snapshot.statusStartedAt)}`}
                </Text>
              </View>

              {shouldShowPlanStartNoDataHint ? null : (
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
              )}

              <SleepCoachCard
                onOpenAlternatives={openSleepCoachAlternatives}
                onOpenWhy={openSleepCoachWhy}
                vm={sleepCoachCard}
              />

              <TodayShortSummary
                onOpenDetails={openSleepCoachWhy}
                vm={todayShortSummary}
              />

              {bottleFeedingEnabled ? (
                <View style={styles.bottleFeedingCard}>
                  <Pressable
                    accessibilityLabel="Открыть кормление бутылочкой"
                    accessibilityRole="button"
                    onPress={openBottleFeeding}
                    style={({ pressed }) => [
                      styles.bottleFeedingContentButton,
                      pressed ? styles.bottleFeedingContentButtonPressed : null,
                    ]}>
                    <View style={styles.bottleFeedingTextBlock}>
                      <View style={styles.bottleFeedingTitleRow}>
                        <BottleFeedingIcon />
                        <Text numberOfLines={1} style={styles.bottleFeedingTitle}>
                          Кормление
                        </Text>
                      </View>
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.86}
                        numberOfLines={1}
                        style={styles.bottleFeedingValue}>
                        {formatLatestBottleFeedingLine(latestBottleFeeding, now)}
                      </Text>
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                        numberOfLines={1}
                        style={styles.bottleFeedingCaption}>
                        {todayBottleFeedingStatsLine}
                      </Text>
                    </View>
                  </Pressable>
                  <PrimaryButton
                    compact
                    disabled={isLoading || isSaving}
                    label="+ Кормление"
                    onPress={openCreateBottleFeedingEditor}
                    style={styles.bottleFeedingButton}
                    textStyle={styles.bottleFeedingButtonText}
                    variant="secondary"
                  />
                </View>
              ) : null}

              {shouldShowPlanBasedUi ? (
                <>
                  <View style={styles.section}>
                    <View style={styles.scenarioHeader}>
                      <View style={styles.scenarioTitleBlock}>
                        <Text style={styles.sectionTitle}>План дня</Text>
                        <Text numberOfLines={1} style={styles.scenarioPlanLabel}>
                          Активный план: {currentPlanName}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel="Поделиться планом дня"
                        accessibilityRole="button"
                        disabled={isLoading || isSaving}
                        hitSlop={4}
                        onPress={handleShareTodayPlan}
                        style={({ pressed }) => [
                          styles.sharePlanButton,
                          pressed ? styles.sharePlanButtonPressed : null,
                          isLoading || isSaving ? styles.sharePlanButtonDisabled : null,
                        ]}>
                        <Text
                          adjustsFontSizeToFit
                          minimumFontScale={0.86}
                          numberOfLines={1}
                          style={styles.sharePlanButtonText}>
                          Поделиться
                        </Text>
                      </Pressable>
                    </View>
                    {shouldShowEarlyWakeSuggestion ? (
                      <View style={styles.earlyWakeSuggestionCard}>
                        <Text style={styles.earlyWakeSuggestionText}>
                          {
                            'Похоже, день начался раньше обычного. Можно включить ранний подъём, чтобы первое бодрствование было мягче.'
                          }
                        </Text>
                        <View style={styles.earlyWakeSuggestionActions}>
                          <PrimaryButton
                            compact
                            disabled={isLoading || isSaving}
                            label="Включить"
                            onPress={handleEnableEarlyWakeMode}
                            style={styles.earlyWakeSuggestionButton}
                          />
                          <PrimaryButton
                            compact
                            disabled={isLoading || isSaving}
                            label="Не сейчас"
                            onPress={handleDismissEarlyWakeSuggestion}
                            style={styles.earlyWakeSuggestionButton}
                            variant="secondary"
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : shouldShowPlanStartNoDataHint ? (
                renderPlanStartNoDataHint()
              ) : (
                renderTrackingOnlyEmptyHint()
              )}
            </>
          ) : !shouldShowPlanBasedUi ? (
            <>
              {renderTrackingOnlyEmptyHint()}
              <PrimaryButton
                compact
                disabled={isLoading || isSaving}
                label="Внести сон"
                onPress={openCreateEditor}
                variant="secondary"
              />
            </>
          ) : mainScreenSleepUi.isFutureSelected ? (
            <>
              <View style={styles.historyHero}>
                <Text style={styles.status}>План на завтра</Text>
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
                  tone="accent"
                />
                <SummaryCard
                  title="Цель бодрств."
                  value={formatDuration(sleepPlan.targetAwakeMinutes)}
                  caption="план дня"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Всё по порядку</Text>
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
          ) : (
            <>
              <View style={styles.pastDayHero}>
                <Text style={styles.status}>Итоги дня</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={2}
                  style={styles.pastVerdict}>
                  {daySummary.verdictLabel}
                </Text>
                <View style={styles.pastFeedbackList}>
                  {pastDayFeedbackLines.map((line) => (
                    <View key={line} style={styles.pastFeedbackRow}>
                      <Text style={styles.pastFeedbackBullet}>•</Text>
                      <Text numberOfLines={2} style={styles.pastFeedbackText}>
                        {line}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.pastMetricGrid}>
                {pastDayMetrics.map((metric) => (
                  <View
                    key={metric.label}
                    style={[
                      styles.pastMetricCard,
                      metric.isAttention ? styles.pastMetricCardAttention : null,
                    ]}>
                    <Text style={styles.pastMetricTitle}>{metric.label}</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.pastMetricValue}>
                      {metric.value}
                    </Text>
                    {metric.caption ? (
                      <Text numberOfLines={2} style={styles.pastMetricCaption}>
                        {metric.caption}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.grid}>
                <SummaryCard
                  title="Сон за 24 ч"
                  value={hasPastDayRecords ? formatDuration(pastDayTotalSleepMinutes) : '--'}
                  detail={hasPastDayRecords ? pastDayOfficialSleepCaption : 'нет записей сна'}
                  caption={formatOfficialGuidelineSources(pastDayOfficialSleepCheck.guideline)}
                  tone={
                    hasPastDayRecords &&
                    (pastDayOfficialSleepCheck.status === 'below_recommended' ||
                      pastDayOfficialSleepCheck.status === 'above_recommended')
                      ? 'warning'
                      : 'default'
                  }
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Всё по порядку</Text>
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
              <View style={styles.timelineTitleRow}>
                <Text style={[styles.sectionTitle, styles.timelineTitleText]}>
                  Всё по порядку
                </Text>
              </View>
              {bottleFeedingEnabled ? (
                <Pressable
                  accessibilityLabel={
                    showFeedingsInTimeline
                      ? 'Скрыть кормления в списке «Всё по порядку»'
                      : 'Показать кормления в списке «Всё по порядку»'
                  }
                  accessibilityRole="switch"
                  accessibilityState={{ checked: showFeedingsInTimeline }}
                  onPress={() => setShowFeedingsInTimeline((value) => !value)}
                  style={({ pressed }) => [
                    styles.timelineFilterButton,
                    showFeedingsInTimeline ? styles.timelineFilterButtonActive : null,
                    pressed ? styles.timelineFilterButtonPressed : null,
                  ]}>
                  <BottleFeedingIcon active={showFeedingsInTimeline} />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.timelineFilterButtonText,
                      showFeedingsInTimeline ? styles.timelineFilterButtonTextActive : null,
                    ]}>
                    Кормление
                  </Text>
                  <View
                    style={[
                      styles.timelineFilterStateBadge,
                      showFeedingsInTimeline ? styles.timelineFilterStateBadgeActive : null,
                    ]}>
                    <Text
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={[
                        styles.timelineFilterStateBadgeText,
                        showFeedingsInTimeline
                          ? styles.timelineFilterStateBadgeTextActive
                          : null,
                      ]}>
                      {showFeedingsInTimeline ? '-' : '+'}
                    </Text>
                  </View>
                </Pressable>
              ) : null}
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
                      {group.items.length === 0
                        ? 'нет'
                        : formatSessionCount(countDayFeedRecords(group.items))}
                    </Text>
                  </View>

                  {group.items.length === 0 ? (
                    <Text style={styles.groupEmptyText}>Нет записей</Text>
                  ) : (
                    group.items.map((item) => {
                      if (item.type === 'bottleFeeding') {
                        const recordLine = formatBottleFeedingRecordLine(item.feeding);
                        const isTopUp = isBottleFeedingTopUp(
                          item.feeding,
                          bottleFeedingTopUpThresholdMl,
                        );

                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Редактировать кормление ${recordLine}${
                              isTopUp ? ', доешка' : ''
                            }`}
                            key={item.id}
                            onPress={() => openEditBottleFeedingEditor(item.feeding)}
                            style={({ pressed }) => [
                              styles.sessionRow,
                              styles.bottleFeedingRow,
                              group.key === 'previous' ? styles.previousSessionRow : null,
                              pressed ? styles.bottleFeedingRowPressed : null,
                            ]}>
                            <BottleFeedingIcon variant="timeline" />
                            <Text
                              numberOfLines={1}
                              style={[styles.sessionTitle, styles.bottleFeedingLine]}>
                              {recordLine}
                            </Text>
                            {isTopUp ? (
                              <Text style={styles.timelineTopUpBadge}>Доешка</Text>
                            ) : null}
                          </Pressable>
                        );
                      }

                      const session = item.session;
                      const sleepFeedings = item.sleepFeedings;
                      const hasSleepFeedings = sleepFeedings.length > 0;
                      const startedAt = new Date(session.startedAt);
                      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
                      const effectiveKind = getSessionKindForCalculations(
                        session,
                        endedAt ?? now,
                        sleepPlan,
                      );

                      if (hasSleepFeedings) {
                        return (
                          <View
                            key={session.id}
                            style={[
                              styles.sessionCard,
                              group.key === 'previous' ? styles.previousSessionRow : null,
                            ]}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => openEditEditor(session)}
                              style={({ pressed }) => [
                                styles.sessionCardMain,
                                pressed ? styles.sessionRowPressed : null,
                              ]}>
                              <EventTypeBadge
                                kind={effectiveKind === 'night' ? 'nightSleep' : 'napSleep'}
                                quiet
                              />
                              <View style={styles.sessionInfo}>
                                <Text numberOfLines={1} style={styles.sessionTitle}>
                                  {effectiveKind === 'night' ? 'Ночной сон' : 'Сон'}
                                </Text>
                                <Text numberOfLines={1} style={styles.sessionTime}>
                                  {formatSessionTimeRange(startedAt, endedAt, now)}
                                </Text>
                              </View>
                              <View style={styles.sessionMeta}>
                                <Text numberOfLines={1} style={styles.sessionDuration}>
                                  {formatDuration(getSessionDurationMinutes(session, now))}
                                </Text>
                                <Text style={styles.sessionAction}>Изменить</Text>
                              </View>
                            </Pressable>

                            <View style={styles.sleepFeedingList}>
                              {sleepFeedings.map((feeding) => {
                                const recordLine = formatBottleFeedingRecordLine(feeding);
                                const isTopUp = isBottleFeedingTopUp(
                                  feeding,
                                  bottleFeedingTopUpThresholdMl,
                                );

                                return (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Редактировать кормление во время сна ${recordLine}${
                                      isTopUp ? ', доешка' : ''
                                    }`}
                                    key={feeding.id}
                                    onPress={() => openEditBottleFeedingEditor(feeding)}
                                    style={({ pressed }) => [
                                      styles.sleepFeedingRow,
                                      pressed ? styles.sleepFeedingRowPressed : null,
                                    ]}>
                                    <BottleFeedingIcon variant="timeline" />
                                    <Text numberOfLines={1} style={styles.sleepFeedingLine}>
                                      {recordLine}
                                    </Text>
                                    {isTopUp ? (
                                      <Text style={styles.timelineTopUpBadge}>Доешка</Text>
                                    ) : null}
                                    <Text style={styles.sleepFeedingAction}>Изменить</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }

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
                          <EventTypeBadge
                            kind={effectiveKind === 'night' ? 'nightSleep' : 'napSleep'}
                            quiet
                          />
                          <View style={styles.sessionInfo}>
                            <Text numberOfLines={1} style={styles.sessionTitle}>
                              {effectiveKind === 'night' ? 'Ночной сон' : 'Сон'}
                            </Text>
                            <Text numberOfLines={1} style={styles.sessionTime}>
                              {formatSessionTimeRange(startedAt, endedAt, now)}
                            </Text>
                          </View>
                          <View style={styles.sessionMeta}>
                            <Text numberOfLines={1} style={styles.sessionDuration}>
                              {formatDuration(getSessionDurationMinutes(session, now))}
                            </Text>
                            <Text style={styles.sessionAction}>Изменить</Text>
                          </View>
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

      <SleepCoachWhySheet
        onClose={closeSleepCoachWhy}
        visible={isSleepCoachWhySheetOpen}
        vm={sleepCoachWhySheet}
      />
      <SleepCoachAlternativesSheet
        onClose={closeSleepCoachAlternatives}
        visible={isSleepCoachAlternativesSheetOpen}
        vm={sleepCoachAlternativesSheet}
      />
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
      {bottleFeedingEnabled ? (
        <BottleFeedingEditorModal
          defaultVolumeMl={bottleFeedingDefaultVolumeMl}
          feeding={bottleFeedingEditorState?.feeding ?? null}
          isSaving={isSaving}
          mode={bottleFeedingEditorState?.mode ?? 'create'}
          onClose={() => setBottleFeedingEditorState(null)}
          onDelete={handleBottleFeedingDelete}
          onSave={handleBottleFeedingSave}
          referenceDate={bottleFeedingEditorState?.referenceDate ?? now}
          visible={bottleFeedingEditorState !== null}
        />
      ) : null}
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
  dayPlanBlock: {
    gap: spacing.sm,
  },
  dayPlanBar: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  dayPlanText: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  dayPlanChangeButton: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  dayPlanChangeButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dayPlanChangeButtonDisabled: {
    opacity: 0.5,
  },
  dayPlanChangeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  dayPlanPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayPlanOption: {
    minHeight: 34,
    maxWidth: '100%',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dayPlanOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dayPlanOptionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dayPlanOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dayPlanOptionTextSelected: {
    color: colors.primary,
  },
  hero: {
    minHeight: 122,
    borderRadius: radius.sm,
    borderLeftWidth: 5,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    gap: spacing.xs,
  },
  heroStatusRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusDotSleeping: {
    backgroundColor: colors.primary,
  },
  heroStatusDotAwake: {
    backgroundColor: colors.textMuted,
  },
  currentStatus: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  currentTimer: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
  },
  currentHelper: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
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
  pastDayHero: {
    minHeight: 150,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pastVerdict: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  pastFeedbackList: {
    gap: spacing.xs,
  },
  pastFeedbackRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  pastFeedbackBullet: {
    width: 12,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'center',
  },
  pastFeedbackText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  eveningPlanPromptCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  eveningPlanPromptTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  eveningPlanPromptText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  eveningPlanPromptActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eveningPlanPromptButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  eveningPlanPromptButtonText: {
    fontSize: 15,
  },
  notificationPermissionPromptCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  notificationPermissionPromptTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  notificationPermissionPromptText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  notificationPermissionPromptActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  notificationPermissionPromptButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  notificationPermissionPromptButtonText: {
    fontSize: 15,
  },
  trackingOnlyEmptyCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  trackingOnlyEmptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  trackingOnlyEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  planStartNoDataCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  planStartNoDataTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  planStartNoDataText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  planStartNoDataActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  planStartNoDataButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  planStartNoDataButtonText: {
    fontSize: 15,
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
  bottleFeedingCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  bottleFeedingContentButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  bottleFeedingContentButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  bottleFeedingTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bottleFeedingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bottleFeedingTitle: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  bottleFeedingValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  bottleFeedingCaption: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  bottleFeedingButton: {
    flexShrink: 0,
    minWidth: 106,
    minHeight: 34,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  bottleFeedingButtonText: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pastMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pastMetricCard: {
    minHeight: 92,
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  pastMetricCardAttention: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  pastMetricTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  pastMetricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  pastMetricCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  timelineTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timelineTitleText: {
    flexShrink: 1,
  },
  timelineFilterButton: {
    minHeight: 32,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.surface,
  },
  timelineFilterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  timelineFilterButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  timelineFilterButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  timelineFilterButtonTextActive: {
    color: colors.primary,
  },
  timelineFilterStateBadge: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  timelineFilterStateBadgeActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timelineFilterStateBadgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  timelineFilterStateBadgeTextActive: {
    color: colors.surface,
  },
  scenarioHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  scenarioTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  scenarioPlanLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  sharePlanButton: {
    minHeight: 34,
    minWidth: 104,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  sharePlanButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  sharePlanButtonDisabled: {
    opacity: 0.6,
  },
  sharePlanButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  earlyWakeSuggestionCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  earlyWakeSuggestionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  earlyWakeSuggestionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  earlyWakeSuggestionButton: {
    flex: 1,
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
    height: TIMELINE_ROW_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionCard: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sessionCardMain: {
    height: TIMELINE_ROW_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  bottleFeedingRow: {
    gap: spacing.sm,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bottleFeedingRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  bottleFeedingLine: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  timelineTopUpBadge: {
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
  sleepFeedingList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sleepFeedingRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sleepFeedingRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  sleepFeedingLine: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  sleepFeedingAction: {
    flexShrink: 0,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  sessionMeta: {
    flexShrink: 0,
    alignItems: 'flex-end',
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
    textAlign: 'right',
  },
  sessionAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
