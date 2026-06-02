import { useEffect, useMemo, useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SelectAllTextInput } from '@/components/SelectAllTextInput';
import { colors, radius, spacing } from '@/constants/theme';
import {
  dateWithLocalDateAndTime,
  formatLocalClock,
  formatLocalDateInput,
  getLocalDateTimeParts,
} from '@/core/localDateTime';
import type { BottleFeeding } from '@/types/bottleFeeding';

type BottleFeedingEditorMode = 'create' | 'edit';

interface BottleFeedingEditorModalProps {
  visible: boolean;
  mode: BottleFeedingEditorMode;
  feeding: BottleFeeding | null;
  referenceDate: Date;
  isSaving: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onSave: (input: { startedAt: Date; volumeMl: number }) => Promise<void>;
}

function normalizeVolumeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function formatDate(date: Date): string {
  return formatLocalDateInput(date);
}

function formatTime(date: Date): string {
  return formatLocalClock(date);
}

export function BottleFeedingEditorModal({
  visible,
  mode,
  feeding,
  referenceDate,
  isSaving,
  onClose,
  onDelete,
  onSave,
}: BottleFeedingEditorModalProps) {
  const initialStartedAt = useMemo(
    () => (feeding ? new Date(feeding.startedAt) : referenceDate),
    [feeding, referenceDate],
  );
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [volumeText, setVolumeText] = useState(feeding ? String(feeding.volumeMl) : '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStartedAt(initialStartedAt);
    setVolumeText(feeding ? String(feeding.volumeMl) : '');
    setErrorMessage(null);
  }, [feeding, initialStartedAt, visible]);

  function openDatePicker() {
    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      display: 'calendar',
      mode: 'date',
      onChange: (_event, selectedDate) => {
        if (!selectedDate) {
          return;
        }

        const timeParts = getLocalDateTimeParts(startedAt);
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

  function openTimePicker() {
    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      display: 'clock',
      is24Hour: true,
      mode: 'time',
      onChange: (_event, selectedDate) => {
        if (!selectedDate) {
          return;
        }

        const timeParts = getLocalDateTimeParts(selectedDate);

        setStartedAt(
          dateWithLocalDateAndTime(startedAt, {
            hours: timeParts.hours,
            minutes: timeParts.minutes,
          }),
        );
        setErrorMessage(null);
      },
      value: startedAt,
    });
  }

  async function handleSave() {
    const volumeMl = Number(volumeText);

    if (!Number.isInteger(volumeMl) || volumeMl <= 0) {
      setErrorMessage('Укажите объём в мл');
      return;
    }

    setErrorMessage(null);
    await onSave({ startedAt, volumeMl });
  }

  function confirmDelete() {
    if (Platform.OS === 'web') {
      if (globalThis.confirm('Удалить кормление?\nЗапись исчезнет из дневной ленты.')) {
        void onDelete();
      }

      return;
    }

    Alert.alert('Удалить кормление?', 'Запись исчезнет из дневной ленты.', [
      {
        style: 'cancel',
        text: 'Отмена',
      },
      {
        onPress: () => {
          void onDelete();
        },
        style: 'destructive',
        text: 'Удалить',
      },
    ]);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>
                {mode === 'edit' ? 'Кормление бутылочкой' : 'Добавить кормление'}
              </Text>
              <Text style={styles.subtitle}>Время и объём</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.fieldRow}>
            <Pressable
              accessibilityLabel="Дата кормления"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={openDatePicker}
              style={({ pressed }) => [styles.pickerField, pressed ? styles.pickerFieldPressed : null]}>
              <Text style={styles.fieldLabel}>Дата</Text>
              <Text style={styles.fieldValue}>{formatDate(startedAt)}</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Время кормления"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={openTimePicker}
              style={({ pressed }) => [styles.pickerField, pressed ? styles.pickerFieldPressed : null]}>
              <Text style={styles.fieldLabel}>Время</Text>
              <Text style={styles.fieldValue}>{formatTime(startedAt)}</Text>
            </Pressable>
          </View>

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
              placeholder="120"
              placeholderTextColor={colors.textMuted}
              style={styles.volumeInput}
              value={volumeText}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              compact
              disabled={isSaving}
              label={isSaving ? 'Сохраняем...' : 'Сохранить'}
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
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
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
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerField: {
    flex: 1,
    minHeight: 68,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  pickerFieldPressed: {
    backgroundColor: colors.primarySoft,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  fieldValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  volumeField: {
    minHeight: 86,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  volumeInput: {
    minHeight: 44,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
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
