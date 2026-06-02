import { useCallback, useEffect, useState } from 'react';
import { Stack, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottleFeedingEditorModal } from '@/components/BottleFeedingEditorModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SelectAllTextInput } from '@/components/SelectAllTextInput';
import {
  BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS,
  DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
  DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
} from '@/constants/bottleFeeding';
import { colors, radius, spacing } from '@/constants/theme';
import {
  calculateBottleFeedingStats,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
} from '@/core/bottleFeeding';
import {
  formatLocalClock,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
} from '@/core/localDateTime';
import {
  createBottleFeeding,
  deleteBottleFeeding,
  getChildProfile,
  getLatestBottleFeeding,
  listBottleFeedingsInRange,
  updateBottleFeedingReminderSettings,
  updateBottleFeeding,
} from '@/db';
import { syncSleepNotificationsFromDatabase } from '@/notifications/sleepNotifications';
import type { BottleFeeding, BottleFeedingStats } from '@/types/bottleFeeding';

type FeedingPeriod = 'today' | 'last24Hours';

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

const HOME_ROUTE = '/' as Href;
const PERIOD_OPTIONS: Array<{ label: string; value: FeedingPeriod }> = [
  { label: 'Сегодня', value: 'today' },
  { label: '24 часа', value: 'last24Hours' },
];
const CUSTOM_REMINDER_INTERVAL_VALUE = 'custom';
const EMPTY_BOTTLE_FEEDING_STATS: BottleFeedingStats = {
  count: 0,
  totalVolumeMl: 0,
};

function formatClock(date: Date): string {
  return formatLocalClock(date);
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (hours < 24) {
    return restMinutes === 0 ? `${hours} ч` : `${hours} ч ${restMinutes} мин`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  return restHours === 0 ? `${days} д` : `${days} д ${restHours} ч`;
}

function formatElapsed(startedAt: Date, now: Date): string {
  return `${formatDuration(Math.floor((now.getTime() - startedAt.getTime()) / 60_000))} назад`;
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

function formatStatsLine(stats: BottleFeedingStats): string {
  return `${stats.totalVolumeMl} мл · ${formatCount(
    stats.count,
    'кормление',
    'кормления',
    'кормлений',
  )}`;
}

function formatRelativeDateLabel(date: Date, now: Date): string {
  const dayDiff = getLocalCalendarDayDiff(date, now);

  if (dayDiff === 0) {
    return 'сегодня';
  }

  if (dayDiff === -1) {
    return 'вчера';
  }

  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'long',
  });
}

function formatLatestFeedingDetail(feeding: BottleFeeding, now: Date): string {
  const startedAt = new Date(feeding.startedAt);

  return `${feeding.volumeMl} мл · ${formatRelativeDateLabel(startedAt, now)} в ${formatClock(
    startedAt,
  )}`;
}

function getPeriodTitle(period: FeedingPeriod): string {
  return period === 'today' ? 'Сегодня' : 'За последние 24 часа';
}

function getPeriodRange(period: FeedingPeriod, now: Date) {
  return period === 'today'
    ? getTodayBottleFeedingRange(now)
    : getLast24HoursBottleFeedingRange(now);
}

function sortFeedingsNewestFirst(feedings: BottleFeeding[]): BottleFeeding[] {
  return [...feedings].sort(
    (first, second) =>
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime(),
  );
}

function normalizeReminderIntervalInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function isPresetReminderInterval(intervalMinutes: number): boolean {
  return BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS.some(
    (option) => option.value === intervalMinutes,
  );
}

export default function BottleFeedingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [period, setPeriod] = useState<FeedingPeriod>('today');
  const [latestFeeding, setLatestFeeding] = useState<BottleFeeding | null>(null);
  const [todayStats, setTodayStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [last24HoursStats, setLast24HoursStats] =
    useState<BottleFeedingStats>(EMPTY_BOTTLE_FEEDING_STATS);
  const [periodFeedings, setPeriodFeedings] = useState<BottleFeeding[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState(
    DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES,
  );
  const [notifyDuringSleep, setNotifyDuringSleep] = useState(
    DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP,
  );
  const [customReminderIntervalText, setCustomReminderIntervalText] = useState(
    String(DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES),
  );
  const [isCustomReminderIntervalOpen, setIsCustomReminderIntervalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<BottleFeedingEditorState | null>(null);

  const loadFeedings = useCallback(
    async (currentPeriod: FeedingPeriod, loadedAt: Date, shouldApply: () => boolean) => {
      setIsLoading(true);

      try {
        const profile = await getChildProfile(db);

        if (!profile.bottleFeedingEnabled) {
          if (shouldApply()) {
            router.replace(HOME_ROUTE);
          }

          return;
        }

        const todayRange = getTodayBottleFeedingRange(loadedAt);
        const last24HoursRange = getLast24HoursBottleFeedingRange(loadedAt);
        const selectedRange = getPeriodRange(currentPeriod, loadedAt);
        const [loadedLatestFeeding, todayFeedings, last24HourFeedings, selectedFeedings] =
          await Promise.all([
            getLatestBottleFeeding(db),
            listBottleFeedingsInRange(db, todayRange.start, todayRange.end),
            listBottleFeedingsInRange(db, last24HoursRange.start, last24HoursRange.end),
            listBottleFeedingsInRange(db, selectedRange.start, selectedRange.end),
          ]);

        if (shouldApply()) {
          setLatestFeeding(loadedLatestFeeding);
          setTodayStats(calculateBottleFeedingStats(todayFeedings));
          setLast24HoursStats(calculateBottleFeedingStats(last24HourFeedings));
          setPeriodFeedings(sortFeedingsNewestFirst(selectedFeedings));
          setRemindersEnabled(profile.bottleFeedingRemindersEnabled);
          setReminderIntervalMinutes(profile.bottleFeedingReminderIntervalMinutes);
          setNotifyDuringSleep(profile.bottleFeedingNotifyDuringSleep);
          setCustomReminderIntervalText(String(profile.bottleFeedingReminderIntervalMinutes));
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

      void loadFeedings(period, new Date(), () => isActive);

      return () => {
        isActive = false;
      };
    }, [loadFeedings, period]),
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
    await loadFeedings(period, currentNow, () => true);
  }

  async function saveReminderSettings(input: {
    remindersEnabled: boolean;
    reminderIntervalMinutes: number;
    notifyDuringSleep: boolean;
  }) {
    if (
      !Number.isInteger(input.reminderIntervalMinutes) ||
      input.reminderIntervalMinutes <= 0
    ) {
      setErrorMessage('Введите интервал в минутах');
      return;
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
    setCustomReminderIntervalText(String(input.reminderIntervalMinutes));
    setIsCustomReminderIntervalOpen(!isPresetReminderInterval(input.reminderIntervalMinutes));
    setIsSettingsSaving(true);
    setErrorMessage(null);

    try {
      await updateBottleFeedingReminderSettings(db, input);
      await syncSleepNotificationsFromDatabase(db, actionAt);
      setNow(actionAt);
    } catch {
      setRemindersEnabled(previousSettings.remindersEnabled);
      setReminderIntervalMinutes(previousSettings.reminderIntervalMinutes);
      setNotifyDuringSleep(previousSettings.notifyDuringSleep);
      setCustomReminderIntervalText(String(previousSettings.reminderIntervalMinutes));
      setIsCustomReminderIntervalOpen(previousSettings.isCustomReminderIntervalOpen);
      setErrorMessage('Не удалось сохранить напоминания');
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
    setIsCustomReminderIntervalOpen(true);
    setCustomReminderIntervalText(String(reminderIntervalMinutes));
  }

  function handleCustomReminderIntervalSave() {
    const intervalMinutes = Number(customReminderIntervalText);

    void saveReminderSettings({
      notifyDuringSleep,
      reminderIntervalMinutes: intervalMinutes,
      remindersEnabled,
    });
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

  const selectedStats = period === 'today' ? todayStats : last24HoursStats;
  const isSettingsDisabled = isLoading || isSaving || isSettingsSaving;
  const areReminderOptionsDisabled = isSettingsDisabled || !remindersEnabled;

  return (
    <>
      <Stack.Screen options={{ title: 'Кормление' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.latestBlock}>
            <Text style={styles.blockTitle}>Последнее кормление</Text>
            {latestFeeding ? (
              <>
                <Text style={styles.latestElapsed}>
                  {formatElapsed(new Date(latestFeeding.startedAt), now)}
                </Text>
                <Text style={styles.latestDetail}>
                  {formatLatestFeedingDetail(latestFeeding, now)}
                </Text>
              </>
            ) : (
              <Text style={styles.emptyLatest}>Записей пока нет</Text>
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

          <View style={styles.periodSelector}>
            {PERIOD_OPTIONS.map((option) => {
              const isSelected = option.value === period;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disabled={isSaving}
                  key={option.value}
                  onPress={() => setPeriod(option.value)}
                  style={({ pressed }) => [
                    styles.periodButton,
                    isSelected ? styles.periodButtonSelected : null,
                    pressed && !isSaving ? styles.periodButtonPressed : null,
                  ]}>
                  <Text
                    style={[
                      styles.periodButtonText,
                      isSelected ? styles.periodButtonTextSelected : null,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.statsBlock}>
            <Text style={styles.statsTitle}>{getPeriodTitle(period)}</Text>
            <Text style={styles.statsValue}>{formatStatsLine(selectedStats)}</Text>
          </View>

          <View style={styles.reminderBlock}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderTextBlock}>
                <Text style={styles.reminderTitle}>Напоминания о кормлении</Text>
                <Text style={styles.reminderDescription}>
                  Напоминать, если прошло больше выбранного времени с последнего кормления.
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
                  pressed && !areReminderOptionsDisabled ? styles.intervalButtonPressed : null,
                ]}>
                <Text
                  style={[
                    styles.intervalButtonText,
                    isCustomReminderIntervalOpen ? styles.intervalButtonTextSelected : null,
                  ]}>
                  Свой
                </Text>
              </Pressable>
            </View>

            {isCustomReminderIntervalOpen ? (
              <View style={styles.customIntervalRow}>
                <SelectAllTextInput
                  accessibilityLabel="Свой интервал напоминания в минутах"
                  editable={!areReminderOptionsDisabled}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={4}
                  normalizeText={normalizeReminderIntervalInput}
                  onChangeText={(value) => {
                    setCustomReminderIntervalText(value);
                    setErrorMessage(null);
                  }}
                  placeholder="180"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.customIntervalInput}
                  value={customReminderIntervalText}
                />
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
          </View>

          <View style={styles.feedList}>
            {periodFeedings.length === 0 ? (
              <Text style={styles.emptyList}>Записей за выбранный период нет</Text>
            ) : (
              periodFeedings.map((feeding) => {
                const startedAt = new Date(feeding.startedAt);

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={feeding.id}
                    onPress={() => openEditEditor(feeding)}
                    style={({ pressed }) => [
                      styles.feedRow,
                      pressed ? styles.feedRowPressed : null,
                    ]}>
                    <Text style={styles.feedRowText}>
                      {formatClock(startedAt)} · {feeding.volumeMl} мл
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </SafeAreaView>
      </ScrollView>

      <BottleFeedingEditorModal
        feeding={editorState?.feeding ?? null}
        isSaving={isSaving}
        lastUsedVolumeMl={latestFeeding?.volumeMl ?? null}
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
  latestBlock: {
    minHeight: 190,
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  blockTitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  latestElapsed: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
  },
  latestDetail: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyLatest: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  addButton: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
  },
  addButtonText: {
    fontSize: 17,
  },
  periodSelector: {
    minHeight: 44,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
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
    fontSize: 15,
    fontWeight: '900',
  },
  periodButtonTextSelected: {
    color: colors.primary,
  },
  statsBlock: {
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
    fontSize: 22,
    fontWeight: '900',
  },
  reminderBlock: {
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  reminderHeader: {
    minHeight: 48,
    justifyContent: 'center',
  },
  reminderTextBlock: {
    gap: spacing.xs,
  },
  reminderTitle: {
    color: colors.text,
    fontSize: 18,
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
  customIntervalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customIntervalInput: {
    minHeight: 48,
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 18,
    fontWeight: '900',
  },
  customIntervalButton: {
    minWidth: 118,
    minHeight: 48,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  customIntervalButtonText: {
    fontSize: 14,
  },
  feedList: {
    gap: spacing.sm,
  },
  feedRow: {
    minHeight: 58,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  feedRowPressed: {
    backgroundColor: colors.primarySoft,
  },
  feedRowText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyList: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
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
