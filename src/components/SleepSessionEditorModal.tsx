import { useEffect, useMemo, useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { addMinutes, minutesBetween } from '@/core/sleepCalculations';
import type { SleepSession } from '@/types/sleep';

type EditorMode = 'create' | 'edit';

interface SleepSessionEditorModalProps {
  visible: boolean;
  mode: EditorMode;
  session: SleepSession | null;
  existingSessions: SleepSession[];
  latestSleepSessionId: string | null;
  referenceDate: Date;
  shortcutBaseDate: Date;
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (input: {
    startedAt: Date;
    endedAt: Date | null;
  }) => Promise<void>;
}

interface TimeParts {
  hours: number;
  minutes: number;
}

interface DateParts {
  day: number;
  month: number;
}

interface ParsedFormDates {
  startedAt: Date;
  endedAt: Date | null;
}

function padTimePart(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatTimeInput(date: Date): string {
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

function formatDateInput(date: Date): string {
  return `${padTimePart(date.getDate())}.${padTimePart(date.getMonth() + 1)}`;
}

function formatRussianDateLabel(date: Date): string {
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];

  return `${date.getDate()} ${months[date.getMonth()]}`;
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

function parseDateInput(value: string, referenceDate: Date): Date | null {
  const trimmed = value.trim().replace(/[,\-/]/g, '.');
  const parts = parseDateParts(trimmed, referenceDate);

  if (!parts) {
    return null;
  }

  return resolveDateNearReference(parts, referenceDate);
}

function parseDateParts(value: string, referenceDate: Date): DateParts | null {
  if (value.includes('.')) {
    const [rawDay, rawMonth] = value.split('.');
    const day = Number(rawDay.replace(/\D/g, ''));
    const month = Number(rawMonth.replace(/\D/g, ''));

    return isValidDateParts(day, month) ? { day, month } : null;
  }

  const digits = value.replace(/\D/g, '');

  if (digits.length === 0 || digits.length > 4) {
    return null;
  }

  if (digits.length <= 2) {
    const day = Number(digits);
    const month = referenceDate.getMonth() + 1;

    return isValidDateParts(day, month) ? { day, month } : null;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2));

  return isValidDateParts(day, month) ? { day, month } : null;
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

function isValidTimeParts(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidDateParts(day: number, month: number): boolean {
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

function resolveDateNearReference(parts: DateParts, referenceDate: Date): Date | null {
  const referenceYear = referenceDate.getFullYear();
  const candidates = [referenceYear - 1, referenceYear, referenceYear + 1]
    .map((year) => {
      const date = new Date(year, parts.month - 1, parts.day, 0, 0, 0, 0);

      if (date.getDate() !== parts.day || date.getMonth() !== parts.month - 1) {
        return null;
      }

      return date;
    })
    .filter((date): date is Date => date !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((closestDate, candidate) => {
    const closestDistance = Math.abs(closestDate.getTime() - referenceDate.getTime());
    const candidateDistance = Math.abs(candidate.getTime() - referenceDate.getTime());

    return candidateDistance < closestDistance ? candidate : closestDate;
  });
}

function dateWithDateAndTime(dateBase: Date, timeParts: TimeParts): Date {
  const date = new Date(dateBase);
  date.setHours(timeParts.hours, timeParts.minutes, 0, 0);

  return date;
}

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addCalendarDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return startOfCalendarDay(first).getTime() === startOfCalendarDay(second).getTime();
}

function hasValidInterval(parsed: ParsedFormDates): boolean {
  return !parsed.endedAt || parsed.endedAt.getTime() > parsed.startedAt.getTime();
}

function getIntervalEndTime(date: Date | null): number {
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

function sleepSessionsOverlap(
  firstStart: Date,
  firstEnd: Date | null,
  secondStart: Date,
  secondEnd: Date | null,
): boolean {
  return (
    firstStart.getTime() < getIntervalEndTime(secondEnd) &&
    secondStart.getTime() < getIntervalEndTime(firstEnd)
  );
}

function formatSessionRange(session: SleepSession): string {
  const startedAt = new Date(session.startedAt);
  const endedAt = session.endedAt ? new Date(session.endedAt) : null;

  return `${formatDateInput(startedAt)} ${formatTimeInput(startedAt)} - ${
    endedAt ? `${formatDateInput(endedAt)} ${formatTimeInput(endedAt)}` : 'идёт'
  }`;
}

export function SleepSessionEditorModal({
  visible,
  mode,
  session,
  existingSessions,
  latestSleepSessionId,
  referenceDate,
  shortcutBaseDate,
  isSaving,
  onClose,
  onDelete,
  onSave,
}: SleepSessionEditorModalProps) {
  const [startedDateText, setStartedDateText] = useState('');
  const [startedAtText, setStartedAtText] = useState('');
  const [endedDateText, setEndedDateText] = useState('');
  const [endedAtText, setEndedAtText] = useState('');
  const [isEndOngoing, setIsEndOngoing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditingActiveSession = mode === 'edit' && session?.endedAt === null;
  const canCreateOngoingEnd =
    mode === 'create' && isSameCalendarDay(referenceDate, shortcutBaseDate);
  const isLatestEditableSession = mode === 'edit' && session?.id === latestSleepSessionId;
  const showOngoingEndButton = mode === 'edit' || canCreateOngoingEnd;
  const canUseOngoingEnd =
    isEditingActiveSession ||
    (mode === 'edit' && isLatestEditableSession) ||
    canCreateOngoingEnd;
  const modalTitle = mode === 'edit' ? 'Редактировать сон' : 'Внести сон';
  const saveLabel = isSaving
    ? 'Сохраняем...'
    : mode === 'create' && isEndOngoing
      ? 'Начать сон'
      : 'Сохранить';

  useEffect(() => {
    if (!visible) {
      return;
    }

    setFormError(null);

    if (mode === 'edit' && session) {
      const startedAt = new Date(session.startedAt);
      const endedAt = session.endedAt ? new Date(session.endedAt) : referenceDate;

      setStartedDateText(formatDateInput(startedAt));
      setStartedAtText(formatTimeInput(startedAt));
      setEndedDateText(formatDateInput(endedAt));
      setEndedAtText(session.endedAt ? formatTimeInput(endedAt) : '');
      setIsEndOngoing(session.endedAt === null);

      return;
    }

    const defaultEndedAt = referenceDate;
    const defaultStartedAt = addMinutes(defaultEndedAt, -5);

    setStartedDateText(formatDateInput(defaultStartedAt));
    setStartedAtText(formatTimeInput(defaultStartedAt));
    setEndedDateText(formatDateInput(defaultEndedAt));
    setEndedAtText(formatTimeInput(defaultEndedAt));
    setIsEndOngoing(false);
  }, [mode, referenceDate, session, visible]);

  const durationLabel = useMemo(() => {
    const parsed = parseFormDates();

    if (!parsed) {
      return null;
    }

    if (!parsed.endedAt) {
      return isEndOngoing ? 'идёт' : null;
    }

    if (!hasValidInterval(parsed)) {
      return null;
    }

    const minutes = minutesBetween(parsed.startedAt, parsed.endedAt);
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;

    return hours === 0 ? `${restMinutes} мин` : `${hours} ч ${restMinutes} мин`;
  }, [
    endedAtText,
    endedDateText,
    isEndOngoing,
    referenceDate,
    session,
    startedAtText,
    startedDateText,
  ]);

  const futureWarning = useMemo(() => {
    const parsed = parseFormDates();

    if (!parsed || !hasValidInterval(parsed)) {
      return null;
    }

    const maxAllowedDate = addMinutes(new Date(), 2);

    if (parsed.endedAt && parsed.endedAt.getTime() > maxAllowedDate.getTime()) {
      return 'Конец в будущем. Запись можно сохранить.';
    }

    if (parsed.startedAt.getTime() > maxAllowedDate.getTime()) {
      return 'Начало в будущем. Запись можно сохранить.';
    }

    return null;
  }, [
    endedAtText,
    endedDateText,
    isEndOngoing,
    referenceDate,
    session,
    startedAtText,
    startedDateText,
  ]);

  const overlappingSession = useMemo(() => {
    const parsed = parseFormDates();

    if (!parsed || !hasValidInterval(parsed)) {
      return null;
    }

    return (
      existingSessions.find((existingSession) => {
        if (existingSession.id === session?.id) {
          return false;
        }

        return sleepSessionsOverlap(
          parsed.startedAt,
          parsed.endedAt,
          new Date(existingSession.startedAt),
          existingSession.endedAt ? new Date(existingSession.endedAt) : null,
        );
      }) ?? null
    );
  }, [
    endedAtText,
    endedDateText,
    existingSessions,
    isEndOngoing,
    referenceDate,
    session,
    startedAtText,
    startedDateText,
  ]);

  const overlapWarning = overlappingSession
    ? `Пересекается с записью ${formatSessionRange(overlappingSession)}`
    : null;

  function parseFormDates(): ParsedFormDates | null {
    const startedAtParts = parseTimeInput(startedAtText);
    const startedDate = parseDateInput(
      startedDateText,
      session ? new Date(session.startedAt) : referenceDate,
    );

    if (!startedAtParts || !startedDate) {
      return null;
    }

    const startedAt = dateWithDateAndTime(startedDate, startedAtParts);
    const trimmedEnd = endedAtText.trim();

    if (isEndOngoing) {
      return { startedAt, endedAt: null };
    }

    const endedAtParts = parseTimeInput(trimmedEnd);
    const endedDate = parseDateInput(
      endedDateText,
      session?.endedAt ? new Date(session.endedAt) : referenceDate,
    );

    if (!endedAtParts || !endedDate) {
      return null;
    }

    const endedAt = dateWithDateAndTime(endedDate, endedAtParts);

    return { startedAt, endedAt };
  }

  function handleOngoingToggle() {
    if (!canUseOngoingEnd || isSaving) {
      return;
    }

    setFormError(null);
    setIsEndOngoing((currentValue) => !currentValue);
  }

  function setShortcutDate(target: 'start' | 'end', offsetDays: number) {
    const date = addCalendarDays(shortcutBaseDate, offsetDays);
    const dateText = formatDateInput(date);

    if (target === 'start') {
      setStartedDateText(dateText);
    } else {
      setEndedDateText(dateText);
    }
  }

  function getSelectedDate(target: 'start' | 'end'): Date {
    const dateText = target === 'start' ? startedDateText : endedDateText;
    const fallbackDate =
      target === 'start'
        ? session
          ? new Date(session.startedAt)
          : referenceDate
        : session?.endedAt
          ? new Date(session.endedAt)
          : referenceDate;

    return parseDateInput(dateText, fallbackDate) ?? fallbackDate;
  }

  function openDatePicker(target: 'start' | 'end') {
    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      display: 'calendar',
      mode: 'date',
      negativeButton: {
        label: 'Отмена',
      },
      onDismiss: () => {},
      onValueChange: (_event, selectedDate) => {
        const dateText = formatDateInput(selectedDate);

        if (target === 'start') {
          setStartedDateText(dateText);
        } else {
          setEndedDateText(dateText);
        }
      },
      positiveButton: {
        label: 'Готово',
      },
      value: getSelectedDate(target),
    });
  }

  function renderDateShortcut(
    target: 'start' | 'end',
    label: string,
    offsetDays: number,
    selectedDateText: string,
    disabled = false,
  ) {
    const date = addCalendarDays(shortcutBaseDate, offsetDays);
    const dateText = formatDateInput(date);
    const selectedDate = parseDateInput(selectedDateText, referenceDate);
    const isActive = !disabled && selectedDate ? isSameCalendarDay(selectedDate, date) : false;

    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        key={`${target}-${label}`}
        onPress={() => setShortcutDate(target, offsetDays)}
        style={({ pressed }) => [
          styles.dateShortcut,
          isActive ? styles.activeDateShortcut : null,
          disabled ? styles.disabledShortcut : null,
          pressed && !disabled ? styles.dateShortcutPressed : null,
        ]}>
        <Text
          style={[
            styles.dateShortcutText,
            isActive ? styles.activeDateShortcutText : null,
            disabled ? styles.disabledText : null,
          ]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  function renderEndpointGroup({
    dateText,
    onTimeChange,
    target,
    timePlaceholder,
    timeText,
    title,
    showOngoingToggle = false,
    canToggleOngoing = false,
    isOngoing = false,
  }: {
    dateText: string;
    onTimeChange: (value: string) => void;
    target: 'start' | 'end';
    timePlaceholder: string;
    timeText: string;
    title: string;
    showOngoingToggle?: boolean;
    canToggleOngoing?: boolean;
    isOngoing?: boolean;
  }) {
    const areFieldsDisabled = isOngoing;
    const isOngoingButtonDisabled = isSaving || !canToggleOngoing;

    return (
      <View style={styles.endpointCard}>
        <View style={styles.endpointHeader}>
          <Text style={styles.endpointTitle}>{title}</Text>
          {showOngoingToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: isOngoingButtonDisabled,
                selected: isOngoing,
              }}
              disabled={isOngoingButtonDisabled}
              onPress={handleOngoingToggle}
              style={({ pressed }) => [
                styles.ongoingButton,
                isOngoing ? styles.activeOngoingButton : null,
                pressed && !isOngoingButtonDisabled ? styles.ongoingButtonPressed : null,
                isOngoingButtonDisabled ? styles.disabledButton : null,
              ]}>
              <Text
                style={[
                  styles.ongoingButtonText,
                  isOngoing ? styles.activeOngoingButtonText : null,
                  isOngoingButtonDisabled && !isOngoing ? styles.disabledText : null,
                ]}>
                Идёт
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.endpointInputs}>
          <Pressable
            accessibilityRole="button"
            disabled={areFieldsDisabled}
            onPress={() => openDatePicker(target)}
            style={({ pressed }) => [
              styles.valueField,
              styles.dateField,
              areFieldsDisabled ? styles.disabledField : null,
              pressed && !areFieldsDisabled ? styles.valueFieldPressed : null,
            ]}>
            <Text style={[styles.compactLabel, areFieldsDisabled ? styles.disabledText : null]}>
              Дата
            </Text>
            <Text style={[styles.dateButtonText, areFieldsDisabled ? styles.disabledText : null]}>
              {formatRussianDateLabel(getSelectedDate(target))}
            </Text>
          </Pressable>
          <View
            style={[
              styles.valueField,
              styles.timeField,
              areFieldsDisabled ? styles.disabledField : null,
            ]}>
            <Text style={[styles.compactLabel, areFieldsDisabled ? styles.disabledText : null]}>
              Время
            </Text>
            <TextInput
              editable={!areFieldsDisabled}
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) => onTimeChange(normalizeTimeInput(value))}
              placeholder={timePlaceholder}
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus={!areFieldsDisabled}
              style={[styles.timeInput, areFieldsDisabled ? styles.disabledText : null]}
              underlineColorAndroid="transparent"
              value={areFieldsDisabled ? '' : timeText}
            />
          </View>
        </View>
        <View style={styles.dateShortcutsRow}>
          {renderDateShortcut(target, 'Вчера', -1, dateText, areFieldsDisabled)}
          {renderDateShortcut(target, 'Сегодня', 0, dateText, areFieldsDisabled)}
          {renderDateShortcut(target, 'Завтра', 1, dateText, areFieldsDisabled)}
        </View>
      </View>
    );
  }

  async function saveParsedDates(parsed: ParsedFormDates) {
    await onSave({
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
    });
  }

  async function handleSavePress() {
    if (!isEndOngoing && endedAtText.trim().length === 0) {
      setFormError('Укажите конец сна');
      return;
    }

    const parsed = parseFormDates();

    if (!parsed) {
      setFormError('Проверьте время сна');
      return;
    }

    if (!hasValidInterval(parsed)) {
      setFormError('Конец должен быть позже начала');
      return;
    }

    if (!parsed.endedAt && !isEndOngoing) {
      setFormError('Укажите конец сна');
      return;
    }

    setFormError(null);

    if (overlappingSession) {
      Alert.alert(
        'Есть пересечение',
        `Новая запись пересекается с ${formatSessionRange(overlappingSession)}. Сохранить всё равно?`,
        [
          {
            text: 'Отмена',
            style: 'cancel',
          },
          {
            text: 'Сохранить',
            style: 'destructive',
            onPress: () => {
              void saveParsedDates(parsed);
            },
          },
        ],
      );

      return;
    }

    await saveParsedDates(parsed);
  }

  function handleDeletePress() {
    Alert.alert('Удалить запись?', 'Запись сна будет удалена с телефона.', [
      {
        text: 'Отмена',
        style: 'cancel',
      },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: onDelete,
      },
    ]);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{modalTitle}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Закрыть</Text>
            </Pressable>
          </View>

          {renderEndpointGroup({
            dateText: startedDateText,
            onTimeChange: setStartedAtText,
            target: 'start',
            timePlaceholder: '0930',
            timeText: startedAtText,
            title: 'Начало',
          })}

          {renderEndpointGroup({
            dateText: endedDateText,
            onTimeChange: setEndedAtText,
            target: 'end',
            timePlaceholder: isEndOngoing ? 'идёт' : '1015',
            timeText: endedAtText,
            title: 'Конец',
            showOngoingToggle: showOngoingEndButton,
            canToggleOngoing: canUseOngoingEnd,
            isOngoing: isEndOngoing,
          })}

          {durationLabel ? (
            <Text style={styles.duration}>Длительность: {durationLabel}</Text>
          ) : null}

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {!formError && futureWarning ? (
            <Text style={styles.warningText}>{futureWarning}</Text>
          ) : null}
          {!formError && overlapWarning ? (
            <Text style={styles.overlapText}>{overlapWarning}</Text>
          ) : null}

          <View style={styles.actions}>
            {mode === 'edit' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={handleDeletePress}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && !isSaving ? styles.deleteButtonPressed : null,
                ]}>
                <Text style={styles.deleteButtonText}>Удалить</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={handleSavePress}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && !isSaving ? styles.saveButtonPressed : null,
                isSaving ? styles.disabledButton : null,
              ]}>
              <Text style={styles.saveButtonText}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  sheet: {
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  endpointCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  endpointHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  endpointTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  ongoingButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  activeOngoingButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  ongoingButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  ongoingButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  activeOngoingButtonText: {
    color: colors.surface,
  },
  endpointInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  valueField: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  valueFieldPressed: {
    backgroundColor: colors.primarySoft,
  },
  disabledField: {
    opacity: 0.5,
  },
  dateField: {
    flex: 0.88,
  },
  timeField: {
    flex: 1,
  },
  compactLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  timeInput: {
    minHeight: 30,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  dateShortcutsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateShortcut: {
    flex: 1,
    minHeight: 36,
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
  disabledShortcut: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.5,
  },
  dateShortcutText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  activeDateShortcutText: {
    color: colors.primary,
  },
  disabledText: {
    color: colors.textMuted,
  },
  duration: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  warningText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  overlapText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    fontSize: 15,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteButton: {
    minHeight: 58,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  deleteButtonPressed: {
    backgroundColor: colors.warningSoft,
  },
  deleteButtonText: {
    color: colors.warning,
    fontSize: 17,
    fontWeight: '900',
  },
  saveButton: {
    minHeight: 58,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '900',
  },
});
