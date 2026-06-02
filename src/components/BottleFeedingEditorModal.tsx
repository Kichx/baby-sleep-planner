import { useEffect, useMemo, useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SelectAllTextInput } from '@/components/SelectAllTextInput';
import {
  DEFAULT_BOTTLE_FEEDING_VOLUME_ML,
  MAX_BOTTLE_FEEDING_VOLUME_ML,
  QUICK_BOTTLE_FEEDING_VOLUME_ROWS,
} from '@/constants/bottleFeeding';
import { colors, radius, spacing } from '@/constants/theme';
import { formatBottleFeedingRecordLine } from '@/core/bottleFeeding';
import {
  addLocalCalendarDays,
  dateWithLocalDateAndTime,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
  getLocalDateTimeParts,
} from '@/core/localDateTime';
import type { BottleFeeding } from '@/types/bottleFeeding';

type BottleFeedingEditorMode = 'create' | 'edit';
type DateShortcutOffset = -1 | 0;

interface BottleFeedingEditorModalProps {
  visible: boolean;
  mode: BottleFeedingEditorMode;
  feeding: BottleFeeding | null;
  referenceDate: Date;
  isSaving: boolean;
  defaultVolumeMl?: number | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onSave: (input: { startedAt: Date; volumeMl: number }) => Promise<void>;
}

interface TimeParts {
  hours: number;
  minutes: number;
}

function normalizeVolumeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function formatDate(date: Date): string {
  return formatLocalDateLabel(date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeInput(date: Date): string {
  const timeParts = getLocalDateTimeParts(date);
  const hours = String(timeParts.hours).padStart(2, '0');
  const minutes = String(timeParts.minutes).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function getDefaultVolumeText(defaultVolumeMl?: number | null): string {
  if (
    typeof defaultVolumeMl === 'number' &&
    Number.isInteger(defaultVolumeMl) &&
    defaultVolumeMl > 0 &&
    defaultVolumeMl <= MAX_BOTTLE_FEEDING_VOLUME_ML
  ) {
    return String(defaultVolumeMl);
  }

  return String(DEFAULT_BOTTLE_FEEDING_VOLUME_ML);
}

function isValidTimeParts(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function parseTimeInput(value: string): TimeParts | null {
  const trimmed = value.trim().replace(/[.,]/g, ':');
  const colonMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);

    return isValidTimeParts(hours, minutes) ? { hours, minutes } : null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0 || digits.length > 4) {
    return null;
  }

  const hours = digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2));
  const minutes = digits.length <= 2 ? 0 : Number(digits.slice(-2));

  return isValidTimeParts(hours, minutes) ? { hours, minutes } : null;
}

function normalizeTimeInput(value: string): string {
  const normalized = value.trim().replace(/[.,]/g, ':');

  if (normalized.includes(':')) {
    const [rawHours, ...rawMinuteParts] = normalized.split(':');
    const hours = rawHours.replace(/\D/g, '').slice(0, 2);
    const minutes = rawMinuteParts.join('').replace(/\D/g, '').slice(0, 2);

    return `${hours}:${minutes}`;
  }

  const digits = normalized.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length === 3 && Number(digits.slice(0, 2)) > 23) {
    return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function getDateShortcutBaseDate(dayOffset: DateShortcutOffset): Date {
  const today = new Date();

  return dayOffset === 0 ? today : addLocalCalendarDays(today, dayOffset);
}

export function BottleFeedingEditorModal({
  visible,
  mode,
  feeding,
  referenceDate,
  isSaving,
  defaultVolumeMl,
  onClose,
  onDelete,
  onSave,
}: BottleFeedingEditorModalProps) {
  const initialStartedAt = useMemo(
    () => (feeding ? new Date(feeding.startedAt) : referenceDate),
    [feeding, referenceDate],
  );
  const initialVolumeText = useMemo(
    () => (feeding ? String(feeding.volumeMl) : getDefaultVolumeText(defaultVolumeMl)),
    [defaultVolumeMl, feeding],
  );
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [timeText, setTimeText] = useState(formatTimeInput(initialStartedAt));
  const [volumeText, setVolumeText] = useState(initialVolumeText);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeDateShortcut = getLocalCalendarDayDiff(startedAt, new Date());
  const title = mode === 'edit' ? 'Редактировать кормление' : 'Кормление бутылочкой';
  const saveLabel = mode === 'edit' ? 'Сохранить изменения' : 'Сохранить';

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStartedAt(initialStartedAt);
    setTimeText(formatTimeInput(initialStartedAt));
    setVolumeText(initialVolumeText);
    setErrorMessage(null);
  }, [initialStartedAt, initialVolumeText, visible]);

  function openDatePicker() {
    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      display: 'calendar',
      maximumDate: new Date(),
      mode: 'date',
      onChange: (_event, selectedDate) => {
        if (!selectedDate) {
          return;
        }

        const timeParts = parseTimeInput(timeText) ?? getLocalDateTimeParts(startedAt);
        const nextStartedAt = dateWithLocalDateAndTime(selectedDate, {
          hours: timeParts.hours,
          minutes: timeParts.minutes,
        });

        setStartedAt(nextStartedAt);
        setErrorMessage(null);
      },
      value: startedAt,
    });
  }

  function selectDateShortcut(dayOffset: DateShortcutOffset) {
    const timeParts = parseTimeInput(timeText) ?? getLocalDateTimeParts(startedAt);

    setStartedAt(
      dateWithLocalDateAndTime(getDateShortcutBaseDate(dayOffset), {
        hours: timeParts.hours,
        minutes: timeParts.minutes,
      }),
    );
    setErrorMessage(null);
  }

  function selectVolume(volumeMl: number) {
    setVolumeText(String(volumeMl));
    setErrorMessage(null);
  }

  async function handleSave() {
    const volumeMl = Number(volumeText);
    const timeParts = parseTimeInput(timeText);

    if (
      !/^\d+$/.test(volumeText) ||
      !Number.isInteger(volumeMl) ||
      volumeMl <= 0 ||
      volumeMl > MAX_BOTTLE_FEEDING_VOLUME_ML
    ) {
      setErrorMessage('Введите объём в мл');
      return;
    }

    if (!timeParts) {
      setErrorMessage('Проверьте время кормления');
      return;
    }

    const nextStartedAt = dateWithLocalDateAndTime(startedAt, timeParts);

    if (nextStartedAt.getTime() > new Date().getTime()) {
      setErrorMessage('Время кормления не может быть в будущем');
      return;
    }

    setErrorMessage(null);
    await onSave({ startedAt: nextStartedAt, volumeMl });
  }

  function confirmDelete() {
    if (!feeding) {
      return;
    }

    const deleteMessage = `Запись ${formatBottleFeedingRecordLine(feeding)} будет удалена.`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Удалить кормление?\n${deleteMessage}`)) {
        void onDelete();
      }

      return;
    }

    Alert.alert('Удалить кормление?', deleteMessage, [
      {
        text: 'Удалить',
        onPress: () => {
          void onDelete();
        },
        style: 'destructive',
      },
      {
        style: 'cancel',
        text: 'Отмена',
      },
    ]);
  }

  function renderDateShortcut(label: string, dayOffset: DateShortcutOffset) {
    const isSelected = activeDateShortcut === dayOffset;

    return (
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        key={label}
        onPress={() => selectDateShortcut(dayOffset)}
        style={({ pressed }) => [
          styles.dateShortcut,
          isSelected ? styles.dateShortcutSelected : null,
          pressed && !isSaving ? styles.shortcutPressed : null,
        ]}>
        <Text
          style={[
            styles.dateShortcutText,
            isSelected ? styles.dateShortcutTextSelected : null,
          ]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  function renderVolumeButton(volumeMl: number) {
    const isSelected = Number(volumeText) === volumeMl;

    return (
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        key={volumeMl}
        onPress={() => selectVolume(volumeMl)}
        style={({ pressed }) => [
          styles.volumeShortcut,
          isSelected ? styles.volumeShortcutSelected : null,
          pressed && !isSaving ? styles.shortcutPressed : null,
        ]}>
        <Text
          style={[
            styles.volumeShortcutText,
            isSelected ? styles.volumeShortcutTextSelected : null,
          ]}>
          {volumeMl}
        </Text>
      </Pressable>
    );
  }

  return (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.volumeField}>
            <Text style={styles.fieldLabel}>Объём, мл</Text>
            <SelectAllTextInput
              accessibilityLabel="Объём кормления в миллилитрах"
              editable={!isSaving}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              normalizeText={normalizeVolumeInput}
              onChangeText={(value) => {
                setVolumeText(value);
                setErrorMessage(null);
              }}
              placeholder={String(DEFAULT_BOTTLE_FEEDING_VOLUME_ML)}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.volumeInput}
              value={volumeText}
            />
            <View style={styles.volumeShortcutRows}>
              {QUICK_BOTTLE_FEEDING_VOLUME_ROWS.map((row) => (
                <View key={row.join('-')} style={styles.volumeShortcutRow}>
                  {row.map(renderVolumeButton)}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>Дата</Text>
              <Pressable
                accessibilityLabel="Дата кормления"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={openDatePicker}
                style={({ pressed }) => [
                  styles.dateValueButton,
                  pressed && !isSaving ? styles.shortcutPressed : null,
                ]}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                  style={styles.dateValue}>
                  {formatDate(startedAt)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.dateShortcutRow}>
              {renderDateShortcut('Сегодня', 0)}
              {renderDateShortcut('Вчера', -1)}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Время</Text>
            <View style={styles.timeField}>
              <SelectAllTextInput
                accessibilityLabel="Время кормления"
                editable={!isSaving}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={5}
                normalizeText={normalizeTimeInput}
                onChangeText={(value) => {
                  setTimeText(value);
                  setErrorMessage(null);
                }}
                placeholder="0930"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.timeInput}
                underlineColorAndroid="transparent"
                value={timeText}
              />
            </View>
          </View>

          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton
              compact
              disabled={isSaving}
              label={isSaving ? 'Сохраняем...' : saveLabel}
              onPress={handleSave}
              style={styles.actionButton}
            />
            {mode === 'edit' ? (
              <PrimaryButton
                compact
                disabled={isSaving}
                label="Удалить"
                onPress={confirmDelete}
                style={styles.actionButton}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 32, 29, 0.28)',
  },
  sheet: {
    maxHeight: '92%',
    gap: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  formScroll: {
    flexShrink: 1,
  },
  formContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 44,
    height: 5,
    alignSelf: 'center',
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  dateValueButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  dateValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  dateShortcutRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateShortcut: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dateShortcutSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dateShortcutText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '900',
  },
  dateShortcutTextSelected: {
    color: colors.primary,
  },
  timeField: {
    minHeight: 50,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  timeInput: {
    minHeight: 34,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  volumeField: {
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  volumeInput: {
    minHeight: 42,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  volumeShortcutRows: {
    gap: spacing.xs,
  },
  volumeShortcutRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  volumeShortcut: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
  },
  volumeShortcutSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  volumeShortcutText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '900',
  },
  volumeShortcutTextSelected: {
    color: colors.primary,
  },
  shortcutPressed: {
    backgroundColor: colors.primarySoft,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radius.sm,
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
