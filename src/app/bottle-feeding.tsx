import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottleFeedingEditorModal } from '@/components/BottleFeedingEditorModal';
import { EventTypeBadge } from '@/components/EventTypeBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SelectAllTextInput } from '@/components/SelectAllTextInput';
import {
  BOTTLE_FEEDING_DEFAULT_VOLUME_OPTIONS,
  BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS,
  BOTTLE_FEEDING_TOP_UP_THRESHOLD_OPTIONS,
  DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
  DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
  DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML,
  DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
  MAX_BOTTLE_FEEDING_VOLUME_ML,
} from '@/constants/bottleFeeding';
import { colors, radius, spacing } from '@/constants/theme';
import {
  BOTTLE_FEEDING_EMPTY_TEXT,
  calculateBottleFeedingStats,
  formatBottleFeedingCount,
  formatBottleFeedingRecordLine,
  formatBottleFeedingReminderStatusLine,
  formatBottleFeedingStatsLine,
  formatBottleFeedingTopUpThresholdLine,
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
  updateBottleFeedingDefaultVolume,
  updateBottleFeedingReminderSettings,
  updateBottleFeedingTopUpThreshold,
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

interface TimeParts {
  hours: number;
  minutes: number;
}

const HOME_ROUTE = '/' as Href;
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

function formatReminderIntervalInput(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  return `${hours}:${String(restMinutes).padStart(2, '0')}`;
}

function normalizeVolumeMlInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function parseVolumeMlInput(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const volumeMl = Number(value);

  return Number.isInteger(volumeMl) && volumeMl > 0 && volumeMl <= MAX_BOTTLE_FEEDING_VOLUME_ML
    ? volumeMl
    : null;
}

function isValidReminderIntervalParts(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeReminderIntervalInput(value: string): string {
  const normalized = value.trim().replace(/[.,]/g, ':');
  const compactDigits = normalized.replace(/\D/g, '').slice(0, 4);

  if (normalized.includes(':')) {
    const [rawHours, ...rawMinuteParts] = normalized.split(':');
    const rawMinutes = rawMinuteParts.join('').replace(/\D/g, '');

    if (rawMinutes.length > 2 && compactDigits.length === 4) {
      return `${compactDigits.slice(0, 2)}:${compactDigits.slice(2)}`;
    }

    const hours = rawHours.replace(/\D/g, '').slice(0, 2);
    const minutes = rawMinutes.slice(0, 2);

    return `${hours}:${minutes}`;
  }

  if (compactDigits.length <= 2) {
    return compactDigits;
  }

  if (compactDigits.length === 3) {
    return `${compactDigits.slice(0, 1)}:${compactDigits.slice(1)}`;
  }

  return `${compactDigits.slice(0, 2)}:${compactDigits.slice(2)}`;
}

function parseReminderIntervalInput(value: string): number | null {
  const trimmed = value.trim().replace(/[.,]/g, ':');
  const colonMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  let parts: TimeParts | null = null;

  if (colonMatch) {
    parts = {
      hours: Number(colonMatch[1]),
      minutes: Number(colonMatch[2]),
    };
  } else {
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length === 0 || digits.length > 4) {
      return null;
    }

    parts = {
      hours: digits.length <= 1 ? 0 : Number(digits.slice(0, -2)),
      minutes: digits.length <= 1 ? Number(digits) : Number(digits.slice(-2)),
    };
  }

  if (!isValidReminderIntervalParts(parts.hours, parts.minutes)) {
    return null;
  }

  const minutes = parts.hours * 60 + parts.minutes;

  return minutes > 0 ? minutes : null;
}

function isPresetReminderInterval(intervalMinutes: number): boolean {
  return BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS.some(
    (option) => option.value === intervalMinutes,
  );
}

function isPresetTopUpThreshold(thresholdMl: number): boolean {
  return BOTTLE_FEEDING_TOP_UP_THRESHOLD_OPTIONS.some(
    (option) => option === thresholdMl,
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
  const scrollViewRef = useRef<ScrollView | null>(null);
  const customReminderIntervalScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState(
    DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
  );
  const [notifyDuringSleep, setNotifyDuringSleep] = useState(
    DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
  );
  const [isBottleFeedingAvailable, setIsBottleFeedingAvailable] = useState<boolean | null>(
    null,
  );
  const [customReminderIntervalText, setCustomReminderIntervalText] = useState(
    formatReminderIntervalInput(DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES),
  );
  const [customTopUpThresholdText, setCustomTopUpThresholdText] = useState(
    String(DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML),
  );
  const [isCustomTopUpThresholdOpen, setIsCustomTopUpThresholdOpen] = useState(false);
  const [isCustomTopUpThresholdSaveConfirmed, setIsCustomTopUpThresholdSaveConfirmed] =
    useState(false);
  const [isCustomReminderIntervalOpen, setIsCustomReminderIntervalOpen] = useState(false);
  const [isCustomReminderSaveConfirmed, setIsCustomReminderSaveConfirmed] =
    useState(false);
  const [isCustomReminderIntervalFocused, setIsCustomReminderIntervalFocused] =
    useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
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
            setCustomTopUpThresholdText(String(DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML));
            setIsCustomTopUpThresholdOpen(false);
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
          setCustomTopUpThresholdText(String(profile.bottleFeedingTopUpThresholdMl));
          setIsCustomTopUpThresholdOpen(
            !isPresetTopUpThreshold(profile.bottleFeedingTopUpThresholdMl),
          );
          setRemindersEnabled(profile.bottleFeedingRemindersEnabled);
          setReminderIntervalMinutes(profile.bottleFeedingReminderIntervalMinutes);
          setNotifyDuringSleep(profile.bottleFeedingNotifyDuringSleep);
          setCustomReminderIntervalText(
            formatReminderIntervalInput(profile.bottleFeedingReminderIntervalMinutes),
          );
          setIsCustomReminderIntervalOpen(
            !isPresetReminderInterval(profile.bottleFeedingReminderIntervalMinutes),
          );
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

  const scrollCustomReminderIntervalIntoView = useCallback((delayMs = 0) => {
    if (customReminderIntervalScrollTimerRef.current !== null) {
      clearTimeout(customReminderIntervalScrollTimerRef.current);
    }

    customReminderIntervalScrollTimerRef.current = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      customReminderIntervalScrollTimerRef.current = null;
    }, delayMs);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isCustomReminderSaveConfirmed) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsCustomReminderSaveConfirmed(false);
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [isCustomReminderSaveConfirmed]);

  useEffect(() => {
    if (!isCustomTopUpThresholdSaveConfirmed) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsCustomTopUpThresholdSaveConfirmed(false);
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [isCustomTopUpThresholdSaveConfirmed]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (isCustomReminderIntervalFocused) {
        scrollCustomReminderIntervalIntoView(60);
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsCustomReminderIntervalFocused(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isCustomReminderIntervalFocused, scrollCustomReminderIntervalIntoView]);

  useEffect(() => {
    return () => {
      if (customReminderIntervalScrollTimerRef.current !== null) {
        clearTimeout(customReminderIntervalScrollTimerRef.current);
      }
    };
  }, []);

  async function reloadCurrentPeriod(currentNow = new Date()) {
    await loadFeedings(currentNow, () => true);
  }

  async function handleDefaultVolumeSelect(volumeMl: number) {
    if (volumeMl === defaultVolumeMl || isSettingsSaving) {
      return;
    }

    const previousVolumeMl = defaultVolumeMl;

    setDefaultVolumeMl(volumeMl);
    setIsSettingsSaving(true);
    setErrorMessage(null);

    try {
      await updateBottleFeedingDefaultVolume(db, volumeMl);
    } catch {
      setDefaultVolumeMl(previousVolumeMl);
      setErrorMessage('Не удалось сохранить объём по умолчанию');
    } finally {
      setIsSettingsSaving(false);
    }
  }

  async function saveTopUpThreshold(nextThresholdMl: number): Promise<boolean> {
    setIsCustomTopUpThresholdSaveConfirmed(false);

    if (
      !Number.isInteger(nextThresholdMl) ||
      nextThresholdMl <= 0 ||
      nextThresholdMl > MAX_BOTTLE_FEEDING_VOLUME_ML
    ) {
      setErrorMessage('Введите порог доешки в мл');
      return false;
    }

    const previousSettings = {
      customTopUpThresholdText,
      isCustomTopUpThresholdOpen,
      topUpThresholdMl,
    };

    setTopUpThresholdMl(nextThresholdMl);
    setCustomTopUpThresholdText(String(nextThresholdMl));
    setIsCustomTopUpThresholdOpen(!isPresetTopUpThreshold(nextThresholdMl));
    setIsSettingsSaving(true);
    setErrorMessage(null);

    try {
      await updateBottleFeedingTopUpThreshold(db, nextThresholdMl);
      return true;
    } catch {
      setTopUpThresholdMl(previousSettings.topUpThresholdMl);
      setCustomTopUpThresholdText(previousSettings.customTopUpThresholdText);
      setIsCustomTopUpThresholdOpen(previousSettings.isCustomTopUpThresholdOpen);
      setErrorMessage('Не удалось сохранить порог доешки');
      return false;
    } finally {
      setIsSettingsSaving(false);
    }
  }

  function handleTopUpThresholdSelect(thresholdMl: number) {
    if (isSettingsSaving) {
      return;
    }

    if (thresholdMl === topUpThresholdMl && !isCustomTopUpThresholdOpen) {
      return;
    }

    void saveTopUpThreshold(thresholdMl);
  }

  function openCustomTopUpThreshold() {
    setIsCustomTopUpThresholdSaveConfirmed(false);
    setIsCustomTopUpThresholdOpen(true);
    setCustomTopUpThresholdText(String(topUpThresholdMl));
  }

  async function handleCustomTopUpThresholdSave() {
    const thresholdMl = parseVolumeMlInput(customTopUpThresholdText);

    if (thresholdMl === null) {
      setIsCustomTopUpThresholdSaveConfirmed(false);
      setErrorMessage('Введите порог доешки в мл');
      return;
    }

    const didSave = await saveTopUpThreshold(thresholdMl);

    if (didSave) {
      setIsCustomTopUpThresholdSaveConfirmed(true);
    }
  }

  async function saveReminderSettings(input: {
    remindersEnabled: boolean;
    reminderIntervalMinutes: number;
    notifyDuringSleep: boolean;
  }): Promise<boolean> {
    setIsCustomReminderSaveConfirmed(false);

    if (
      !Number.isInteger(input.reminderIntervalMinutes) ||
      input.reminderIntervalMinutes <= 0
    ) {
      setErrorMessage('Введите интервал как часы:минуты');
      return false;
    }

    const previousSettings = {
      notifyDuringSleep,
      reminderIntervalMinutes,
      remindersEnabled,
      isCustomReminderIntervalOpen,
    };
    const actionAt = new Date();

    setRemindersEnabled(input.remindersEnabled);
    setReminderIntervalMinutes(input.reminderIntervalMinutes);
    setNotifyDuringSleep(input.notifyDuringSleep);
    setCustomReminderIntervalText(formatReminderIntervalInput(input.reminderIntervalMinutes));
    setIsCustomReminderIntervalOpen(!isPresetReminderInterval(input.reminderIntervalMinutes));
    setIsSettingsSaving(true);
    setErrorMessage(null);

    try {
      await updateBottleFeedingReminderSettings(db, input);
      await syncSleepNotificationsFromDatabase(db, actionAt, {
        showOverdueBottleFeedingReminder: true,
      });
      setNow(actionAt);
      return true;
    } catch {
      setRemindersEnabled(previousSettings.remindersEnabled);
      setReminderIntervalMinutes(previousSettings.reminderIntervalMinutes);
      setNotifyDuringSleep(previousSettings.notifyDuringSleep);
      setCustomReminderIntervalText(
        formatReminderIntervalInput(previousSettings.reminderIntervalMinutes),
      );
      setIsCustomReminderIntervalOpen(previousSettings.isCustomReminderIntervalOpen);
      setErrorMessage('Не удалось сохранить напоминания');
      return false;
    } finally {
      setIsSettingsSaving(false);
    }
  }

  function handleReminderEnabledChange(enabled: boolean) {
    void saveReminderSettings({
      notifyDuringSleep,
      reminderIntervalMinutes,
      remindersEnabled: enabled,
    });
  }

  function handleNotifyDuringSleepChange(enabled: boolean) {
    void saveReminderSettings({
      notifyDuringSleep: enabled,
      reminderIntervalMinutes,
      remindersEnabled,
    });
  }

  function handleReminderIntervalSelect(intervalMinutes: number) {
    void saveReminderSettings({
      notifyDuringSleep,
      reminderIntervalMinutes: intervalMinutes,
      remindersEnabled,
    });
  }

  function openCustomReminderInterval() {
    setIsCustomReminderSaveConfirmed(false);
    setIsCustomReminderIntervalOpen(true);
    setCustomReminderIntervalText(formatReminderIntervalInput(reminderIntervalMinutes));
  }

  async function handleCustomReminderIntervalSave() {
    const intervalMinutes = parseReminderIntervalInput(customReminderIntervalText);

    if (intervalMinutes === null) {
      setIsCustomReminderSaveConfirmed(false);
      setErrorMessage('Введите интервал как часы:минуты');
      return;
    }

    const didSave = await saveReminderSettings({
      notifyDuringSleep,
      reminderIntervalMinutes: intervalMinutes,
      remindersEnabled,
    });

    if (didSave) {
      setIsCustomReminderSaveConfirmed(true);
    }
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
  const reminderStatusLine = formatBottleFeedingReminderStatusLine({
    notifyDuringSleep,
    reminderIntervalMinutes,
    remindersEnabled,
  });
  const topUpThresholdLine = formatBottleFeedingTopUpThresholdLine(topUpThresholdMl);
  const isSettingsDisabled = isLoading || isSaving || isSettingsSaving;
  const areReminderOptionsDisabled = isSettingsDisabled || !remindersEnabled;

  if (isBottleFeedingAvailable !== true) {
    return <Stack.Screen options={{ title: 'Кормление' }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Кормление' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoider}>
        <ScrollView
          ref={scrollViewRef}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}>
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

          <View style={styles.defaultVolumeBlock}>
            <View style={styles.reminderTextBlock}>
              <Text style={styles.reminderTitle}>Объём по умолчанию</Text>
              <Text style={styles.reminderDescription}>Подставится в новом кормлении.</Text>
            </View>
            <View
              style={[
                styles.intervalOptions,
                isSettingsDisabled ? styles.settingOptionsDisabled : null,
              ]}>
              {BOTTLE_FEEDING_DEFAULT_VOLUME_OPTIONS.map((volumeMl) => {
                const isSelected = defaultVolumeMl === volumeMl;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    disabled={isSettingsDisabled}
                    key={volumeMl}
                    onPress={() => {
                      void handleDefaultVolumeSelect(volumeMl);
                    }}
                    style={({ pressed }) => [
                      styles.intervalButton,
                      isSelected ? styles.intervalButtonSelected : null,
                      pressed && !isSettingsDisabled ? styles.intervalButtonPressed : null,
                    ]}>
                    <Text
                      style={[
                        styles.intervalButtonText,
                        isSelected ? styles.intervalButtonTextSelected : null,
                      ]}>
                      {volumeMl} мл
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.defaultVolumeBlock}>
            <View style={styles.reminderTextBlock}>
              <Text style={styles.reminderTitle}>Доешка</Text>
              <Text style={styles.reminderDescription}>
                {topUpThresholdLine}. Пометка появится в таймлайне.
              </Text>
            </View>
            <View
              style={[
                styles.intervalOptions,
                isSettingsDisabled ? styles.settingOptionsDisabled : null,
              ]}>
              {BOTTLE_FEEDING_TOP_UP_THRESHOLD_OPTIONS.map((thresholdMl) => {
                const isSelected =
                  !isCustomTopUpThresholdOpen && topUpThresholdMl === thresholdMl;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    disabled={isSettingsDisabled}
                    key={thresholdMl}
                    onPress={() => handleTopUpThresholdSelect(thresholdMl)}
                    style={({ pressed }) => [
                      styles.intervalButton,
                      isSelected ? styles.intervalButtonSelected : null,
                      pressed && !isSettingsDisabled ? styles.intervalButtonPressed : null,
                    ]}>
                    <Text
                      style={[
                        styles.intervalButtonText,
                        isSelected ? styles.intervalButtonTextSelected : null,
                      ]}>
                      до {thresholdMl} мл
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isCustomTopUpThresholdOpen }}
                disabled={isSettingsDisabled}
                onPress={openCustomTopUpThreshold}
                style={({ pressed }) => [
                  styles.intervalButton,
                  isCustomTopUpThresholdOpen ? styles.intervalButtonSelected : null,
                  pressed && !isSettingsDisabled ? styles.intervalButtonPressed : null,
                ]}>
                <Text
                  style={[
                    styles.intervalButtonText,
                    isCustomTopUpThresholdOpen ? styles.intervalButtonTextSelected : null,
                  ]}>
                  Свой
                </Text>
              </Pressable>
            </View>

            {isCustomTopUpThresholdOpen ? (
              <View style={styles.customIntervalBlock}>
                <View style={styles.customIntervalRow}>
                  <View style={styles.customIntervalInputGroup}>
                    <Text style={styles.compactLabel}>Порог, мл</Text>
                    <SelectAllTextInput
                      accessibilityLabel="Свой порог доешки в миллилитрах"
                      editable={!isSettingsDisabled}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={4}
                      normalizeText={normalizeVolumeMlInput}
                      onChangeText={(value) => {
                        setCustomTopUpThresholdText(value);
                        setIsCustomTopUpThresholdSaveConfirmed(false);
                        setErrorMessage(null);
                      }}
                      placeholder={String(DEFAULT_BOTTLE_FEEDING_TOP_UP_THRESHOLD_ML)}
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      style={styles.customIntervalInput}
                      underlineColorAndroid="transparent"
                      value={customTopUpThresholdText}
                    />
                  </View>
                  <PrimaryButton
                    compact
                    disabled={isSettingsDisabled}
                    label="Сохранить"
                    onPress={handleCustomTopUpThresholdSave}
                    style={styles.customIntervalButton}
                    textStyle={styles.customIntervalButtonText}
                    variant="secondary"
                  />
                </View>
                {isCustomTopUpThresholdSaveConfirmed ? (
                  <Text accessibilityLiveRegion="polite" style={styles.customIntervalSavedText}>
                    Сохранено
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.reminderBlock}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderTextBlock}>
                <Text style={styles.reminderTitle}>Напоминания о кормлении</Text>
                <Text style={styles.reminderDescription}>
                  {reminderStatusLine}
                </Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingTitle}>Включить напоминания</Text>
              <Switch
                accessibilityLabel="Включить напоминания о кормлении"
                disabled={isSettingsDisabled}
                onValueChange={handleReminderEnabledChange}
                thumbColor={remindersEnabled ? colors.primary : colors.surface}
                trackColor={{
                  false: colors.surfaceMuted,
                  true: colors.primarySoft,
                }}
                value={remindersEnabled}
              />
            </View>

            {remindersEnabled ? (
              <>
                <View
                  style={[
                    styles.intervalOptions,
                    areReminderOptionsDisabled ? styles.settingOptionsDisabled : null,
                  ]}>
                  {BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS.map((option) => {
                    const isSelected =
                      !isCustomReminderIntervalOpen &&
                      reminderIntervalMinutes === option.value;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        disabled={areReminderOptionsDisabled}
                        key={option.value}
                        onPress={() => handleReminderIntervalSelect(option.value)}
                        style={({ pressed }) => [
                          styles.intervalButton,
                          isSelected ? styles.intervalButtonSelected : null,
                          pressed && !areReminderOptionsDisabled
                            ? styles.intervalButtonPressed
                            : null,
                        ]}>
                        <Text
                          style={[
                            styles.intervalButtonText,
                            isSelected ? styles.intervalButtonTextSelected : null,
                          ]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isCustomReminderIntervalOpen }}
                    disabled={areReminderOptionsDisabled}
                    onPress={openCustomReminderInterval}
                    style={({ pressed }) => [
                      styles.intervalButton,
                      isCustomReminderIntervalOpen ? styles.intervalButtonSelected : null,
                      pressed && !areReminderOptionsDisabled
                        ? styles.intervalButtonPressed
                        : null,
                    ]}>
                    <Text
                      style={[
                        styles.intervalButtonText,
                        isCustomReminderIntervalOpen
                          ? styles.intervalButtonTextSelected
                          : null,
                      ]}>
                      Свой
                    </Text>
                  </Pressable>
                </View>

                {isCustomReminderIntervalOpen ? (
                  <View style={styles.customIntervalBlock}>
                    <View style={styles.customIntervalRow}>
                      <View style={styles.customIntervalInputGroup}>
                        <Text style={styles.compactLabel}>Интервал</Text>
                        <SelectAllTextInput
                          accessibilityLabel="Свой интервал напоминания в часах и минутах"
                          editable={!areReminderOptionsDisabled}
                          inputMode="numeric"
                          keyboardType="number-pad"
                          maxLength={5}
                          normalizeText={normalizeReminderIntervalInput}
                          onChangeText={(value) => {
                            setCustomReminderIntervalText(value);
                            setIsCustomReminderSaveConfirmed(false);
                            setErrorMessage(null);
                          }}
                          onBlur={() => {
                            setIsCustomReminderIntervalFocused(false);
                          }}
                          onFocus={() => {
                            setIsCustomReminderIntervalFocused(true);
                            scrollCustomReminderIntervalIntoView(
                              Platform.OS === 'android' ? 320 : 80,
                            );
                          }}
                          placeholder="3:00"
                          placeholderTextColor={colors.textMuted}
                          returnKeyType="done"
                          style={styles.customIntervalInput}
                          underlineColorAndroid="transparent"
                          value={customReminderIntervalText}
                        />
                      </View>
                      <PrimaryButton
                        compact
                        disabled={areReminderOptionsDisabled}
                        label="Сохранить"
                        onPress={handleCustomReminderIntervalSave}
                        style={styles.customIntervalButton}
                        textStyle={styles.customIntervalButtonText}
                        variant="secondary"
                      />
                    </View>
                    {isCustomReminderSaveConfirmed ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={styles.customIntervalSavedText}>
                        Сохранено
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View
                  style={[
                    styles.settingRow,
                    areReminderOptionsDisabled ? styles.settingOptionsDisabled : null,
                  ]}>
                  <View style={styles.settingTextBlock}>
                    <Text style={styles.settingTitle}>Уведомлять во время сна</Text>
                    <Text style={styles.settingDescription}>
                      Если выключить, уведомление появится сразу после завершения сна.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Уведомлять во время сна"
                    disabled={areReminderOptionsDisabled}
                    onValueChange={handleNotifyDuringSleepChange}
                    thumbColor={notifyDuringSleep ? colors.primary : colors.surface}
                    trackColor={{
                      false: colors.surfaceMuted,
                      true: colors.primarySoft,
                    }}
                    value={notifyDuringSleep}
                  />
                </View>
              </>
            ) : null}
          </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>

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
