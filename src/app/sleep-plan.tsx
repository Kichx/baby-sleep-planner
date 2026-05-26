import { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  buildIdealSleepPlanSegments,
  buildSleepPlanPreset,
  calculatePlanBedtimeRange,
  type IdealSleepPlanSegment,
} from '@/core/sleepPlan';
import {
  activateTargetDayPlan,
  createTargetDayPlan,
  deleteTargetDayPlan,
  listTargetDayPlans,
  updateTargetDayPlan,
} from '@/db';
import type { SleepPlanPreset, TargetDayPlan } from '@/types/sleep';

type EditorType = 'wakeUp' | 'awake' | 'napCount' | 'daySleep';
type NameEditorMode = 'create' | 'edit';

interface PlanDraft {
  name: string;
  wakeUpStart: string;
  wakeUpEnd: string;
  awakeStart: string;
  awakeEnd: string;
  napCount: string;
  daySleepStart: string;
  daySleepEnd: string;
}

interface ParsedPlanDraft {
  plan: SleepPlanPreset | null;
  errorMessage: string | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  caption: string;
  disabled: boolean;
  onPress: () => void;
}

interface PlanCardProps {
  plan: TargetDayPlan;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
}

interface TimeParts {
  hours: number;
  minutes: number;
}

interface RangeEditorProps {
  title: string;
  helper: string;
  startValue: string;
  endValue: string;
  startPlaceholder: string;
  endPlaceholder: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
}

const NAP_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;
const DEFAULT_PLAN_NAME = 'Основной';
const PLAN_NAME_MAX_LENGTH = 40;

function padTimePart(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatClockMinutes(minutes: number): string {
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const restMinutes = normalizedMinutes % 60;

  return `${padTimePart(hours)}:${padTimePart(restMinutes)}`;
}

function formatDurationInput(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return `${hours}:${padTimePart(restMinutes)}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatDurationRange(startMinutes: number, endMinutes: number): string {
  const start = formatDuration(startMinutes);
  const end = formatDuration(endMinutes);

  return start === end ? start : `${start} - ${end}`;
}

function formatClockRange(startMinutes: number, endMinutes: number): string {
  const start = formatClockMinutes(startMinutes);
  const end = formatClockMinutes(endMinutes);

  return start === end ? start : `${start} - ${end}`;
}

function createDraftFromPlan(plan: SleepPlanPreset, name = DEFAULT_PLAN_NAME): PlanDraft {
  return {
    awakeEnd: formatDurationInput(plan.targetAwakeMaxMinutes),
    awakeStart: formatDurationInput(plan.targetAwakeMinMinutes),
    daySleepEnd: formatDurationInput(plan.targetDaySleepMaxMinutes),
    daySleepStart: formatDurationInput(plan.targetDaySleepMinMinutes),
    name,
    napCount: String(plan.napCount),
    wakeUpEnd: formatClockMinutes(plan.wakeUpEndMinutes),
    wakeUpStart: formatClockMinutes(plan.wakeUpStartMinutes),
  };
}

function createDraftFromTargetPlan(targetPlan: TargetDayPlan): PlanDraft {
  return createDraftFromPlan(targetPlan.plan, targetPlan.name);
}

function getDraftNameError(draft: PlanDraft): string | null {
  return draft.name.trim().length === 0 ? 'Укажите название плана' : null;
}

function createNextPlanName(plans: TargetDayPlan[]): string {
  const usedNames = new Set(plans.map((plan) => plan.name.trim()));
  const maxPlanNumber = plans.reduce((maxNumber, plan) => {
    const match = /^План (\d+)$/.exec(plan.name.trim());

    return match ? Math.max(maxNumber, Number(match[1])) : maxNumber;
  }, 1);
  let index = maxPlanNumber + 1;
  let candidate = `План ${index}`;

  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `План ${index}`;
  }

  return candidate;
}

function sortPlansForDisplay(plans: TargetDayPlan[]): TargetDayPlan[] {
  return [...plans].sort((first, second) => {
    if (first.isActive !== second.isActive) {
      return first.isActive ? -1 : 1;
    }

    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  });
}

function replacePlanInList(plans: TargetDayPlan[], updatedPlan: TargetDayPlan): TargetDayPlan[] {
  return sortPlansForDisplay(
    plans.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)),
  );
}

function markPlanActive(plans: TargetDayPlan[], activePlan: TargetDayPlan): TargetDayPlan[] {
  return sortPlansForDisplay(
    plans.map((plan) =>
      plan.id === activePlan.id ? activePlan : { ...plan, isActive: false },
    ),
  );
}

function isValidTimeParts(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
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

function parseClockInput(value: string): number | null {
  const parts = parseTimeInput(value);

  return parts ? parts.hours * 60 + parts.minutes : null;
}

function parseDurationInput(value: string): number | null {
  const parts = parseTimeInput(value);

  return parts ? parts.hours * 60 + parts.minutes : null;
}

function parseNapCountInput(value: string): number | null {
  const napCount = Number(value.trim());

  if (!Number.isInteger(napCount) || napCount < 1 || napCount > 5) {
    return null;
  }

  return napCount;
}

function parsePlanDraft(draft: PlanDraft): ParsedPlanDraft {
  const wakeUpStartMinutes = parseClockInput(draft.wakeUpStart);
  const wakeUpEndMinutes = parseClockInput(draft.wakeUpEnd);
  const targetAwakeMinMinutes = parseDurationInput(draft.awakeStart);
  const targetAwakeMaxMinutes = parseDurationInput(draft.awakeEnd);
  const napCount = parseNapCountInput(draft.napCount);
  const targetDaySleepMinMinutes = parseDurationInput(draft.daySleepStart);
  const targetDaySleepMaxMinutes = parseDurationInput(draft.daySleepEnd);

  if (wakeUpStartMinutes === null || wakeUpEndMinutes === null) {
    return { errorMessage: 'Проверьте время подъема', plan: null };
  }

  if (targetAwakeMinMinutes === null || targetAwakeMaxMinutes === null) {
    return { errorMessage: 'Проверьте время бодрствования', plan: null };
  }

  if (napCount === null) {
    return { errorMessage: 'Дневных снов может быть от 1 до 5', plan: null };
  }

  if (targetDaySleepMinMinutes === null || targetDaySleepMaxMinutes === null) {
    return { errorMessage: 'Проверьте суммарный дневной сон', plan: null };
  }

  if (wakeUpStartMinutes > wakeUpEndMinutes) {
    return { errorMessage: 'Время подъема «от» должно быть раньше «до»', plan: null };
  }

  if (targetAwakeMinMinutes > targetAwakeMaxMinutes) {
    return { errorMessage: 'Бодрствование «от» должно быть меньше «до»', plan: null };
  }

  if (targetDaySleepMinMinutes > targetDaySleepMaxMinutes) {
    return { errorMessage: 'Дневной сон «от» должен быть меньше «до»', plan: null };
  }

  if (targetAwakeMinMinutes === 0 || targetDaySleepMinMinutes === 0) {
    return { errorMessage: 'Укажите время больше нуля', plan: null };
  }

  return {
    errorMessage: null,
    plan: buildSleepPlanPreset({
      latestEveningNapEndMinutes: DEFAULT_SLEEP_PLAN.latestEveningNapEndMinutes,
      maxEveningNapMinutes: DEFAULT_SLEEP_PLAN.maxEveningNapMinutes,
      microNapMinutes: DEFAULT_SLEEP_PLAN.microNapMinutes,
      minNightSleepMinutes: DEFAULT_SLEEP_PLAN.minNightSleepMinutes,
      napCount,
      targetAwakeMaxMinutes,
      targetAwakeMinMinutes,
      targetDaySleepMaxMinutes,
      targetDaySleepMinMinutes,
      wakeUpEndMinutes,
      wakeUpStartMinutes,
    }),
  };
}

function arePlanFieldsEqual(first: SleepPlanPreset, second: SleepPlanPreset): boolean {
  return (
    first.wakeUpStartMinutes === second.wakeUpStartMinutes &&
    first.wakeUpEndMinutes === second.wakeUpEndMinutes &&
    first.targetAwakeMinMinutes === second.targetAwakeMinMinutes &&
    first.targetAwakeMaxMinutes === second.targetAwakeMaxMinutes &&
    first.napCount === second.napCount &&
    first.targetDaySleepMinMinutes === second.targetDaySleepMinMinutes &&
    first.targetDaySleepMaxMinutes === second.targetDaySleepMaxMinutes
  );
}

function MetricCard({ label, value, caption, disabled, onPress }: MetricCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        pressed && !disabled ? styles.metricCardPressed : null,
        disabled ? styles.disabledCard : null,
      ]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>
        {value}
      </Text>
      <Text numberOfLines={2} style={styles.metricCaption}>
        {caption}
      </Text>
    </Pressable>
  );
}

function PlanCard({ plan, isSelected, disabled, onPress }: PlanCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        isSelected ? styles.selectedPlanCard : null,
        pressed && !disabled ? styles.planCardPressed : null,
        disabled ? styles.disabledCard : null,
      ]}>
      <View style={styles.planCardHeader}>
        <Text numberOfLines={1} style={styles.planCardTitle}>
          {plan.name}
        </Text>
        {plan.isActive ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Активный</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.planCardMeta}>
        {formatClockRange(plan.plan.wakeUpStartMinutes, plan.plan.wakeUpEndMinutes)}
        {' · '}
        {formatDuration(plan.plan.targetAwakeMinutes)}
      </Text>
      <Text numberOfLines={1} style={styles.planCardMeta}>
        {plan.plan.napCount} сна · сон {formatDuration(plan.plan.targetDaySleepMinutes)}
      </Text>
    </Pressable>
  );
}

function IdealScheduleRow({ segment }: { segment: IdealSleepPlanSegment }) {
  const isSleep = segment.kind === 'sleep';

  return (
    <View style={styles.scheduleRow}>
      <View style={[styles.scheduleBadge, isSleep ? styles.sleepBadge : styles.awakeBadge]}>
        <Text style={[styles.scheduleBadgeText, isSleep ? styles.sleepBadgeText : null]}>
          {isSleep ? 'Сон' : 'ВБ'}
        </Text>
      </View>
      <View style={styles.scheduleTextBlock}>
        <Text style={styles.scheduleTitle}>
          {isSleep ? `Сон ${segment.order}` : `ВБ ${segment.order}`}
        </Text>
        <Text style={styles.scheduleCaption}>{formatDuration(segment.durationMinutes)}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.scheduleTime}>
        {formatClockRange(segment.startMinutes, segment.endMinutes)}
      </Text>
    </View>
  );
}

function RangeEditor({
  title,
  helper,
  startValue,
  endValue,
  startPlaceholder,
  endPlaceholder,
  onChangeStart,
  onChangeEnd,
}: RangeEditorProps) {
  return (
    <View style={styles.editorBlock}>
      <Text style={styles.editorTitle}>{title}</Text>
      <Text style={styles.editorHelper}>{helper}</Text>
      <View style={styles.editorInputRow}>
        <View style={styles.editorInputGroup}>
          <Text style={styles.compactLabel}>от</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(value) => onChangeStart(normalizeTimeInput(value))}
            placeholder={startPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.editorInput}
            underlineColorAndroid="transparent"
            value={startValue}
          />
        </View>
        <View style={styles.editorInputGroup}>
          <Text style={styles.compactLabel}>до</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(value) => onChangeEnd(normalizeTimeInput(value))}
            placeholder={endPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.editorInput}
            underlineColorAndroid="transparent"
            value={endValue}
          />
        </View>
      </View>
    </View>
  );
}

export default function SleepPlanScreen() {
  const db = useSQLiteContext();
  const [plans, setPlans] = useState<TargetDayPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(() => createDraftFromPlan(DEFAULT_SLEEP_PLAN));
  const [activeEditor, setActiveEditor] = useState<EditorType | null>(null);
  const [nameEditorMode, setNameEditorMode] = useState<NameEditorMode | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isNapDropdownOpen, setIsNapDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      setIsLoading(true);

      try {
        const loadedPlans = await listTargetDayPlans(db);
        const planToSelect =
          loadedPlans.find((targetPlan) => targetPlan.isActive) ?? loadedPlans[0] ?? null;

        if (isMounted) {
          setPlans(sortPlansForDisplay(loadedPlans));
          setSelectedPlanId(planToSelect?.id ?? null);
          setDraft(planToSelect ? createDraftFromTargetPlan(planToSelect) : createDraftFromPlan(DEFAULT_SLEEP_PLAN));
          setErrorMessage(null);
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Не удалось загрузить планы сна');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      isMounted = false;
    };
  }, [db]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const activePlanName = useMemo(
    () => plans.find((plan) => plan.isActive)?.name ?? DEFAULT_PLAN_NAME,
    [plans],
  );
  const parsedDraft = useMemo(() => parsePlanDraft(draft), [draft]);
  const draftNameError = useMemo(() => getDraftNameError(draft), [draft]);
  const bedtimeRange = useMemo(() => {
    if (!parsedDraft.plan) {
      return null;
    }

    return calculatePlanBedtimeRange(parsedDraft.plan);
  }, [parsedDraft.plan]);
  const idealScheduleSegments = useMemo(
    () => (parsedDraft.plan ? buildIdealSleepPlanSegments(parsedDraft.plan) : []),
    [parsedDraft.plan],
  );
  const bedtimeLabel = bedtimeRange
    ? formatClockRange(bedtimeRange.startMinutes, bedtimeRange.endMinutes)
    : '--:--';
  const hasPlanChanges =
    selectedPlan && parsedDraft.plan ? !arePlanFieldsEqual(parsedDraft.plan, selectedPlan.plan) : false;
  const hasNameChanges = selectedPlan ? draft.name.trim() !== selectedPlan.name : false;
  const hasChanges = hasPlanChanges || hasNameChanges;
  const visibleErrorMessage =
    errorMessage ??
    (nameEditorMode === 'edit' ? draftNameError : activeEditor ? parsedDraft.errorMessage : null);
  const isEditingDisabled = isLoading || isSaving || !selectedPlan;
  const isPlanDeleteDisabled = isLoading || isSaving || !selectedPlan || plans.length <= 1;
  const isEditorModalVisible = activeEditor !== null;
  const sheetTitle =
    nameEditorMode === 'create' ? 'Новый план' : nameEditorMode === 'edit' ? 'Название' : 'Изменить';
  const sheetActionLabel = isSaving
    ? nameEditorMode === 'create'
      ? 'Создаём...'
      : 'Сохраняем...'
    : nameEditorMode === 'create'
      ? 'Создать'
      : 'Готово';

  function updateDraft(field: keyof PlanDraft, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
    setErrorMessage(null);
  }

  function openEditor(editorType: EditorType) {
    setActiveEditor(editorType);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
  }

  function openNameEditor() {
    setActiveEditor(null);
    setNameEditorMode('edit');
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function openCreatePlanNamePrompt() {
    setActiveEditor(null);
    setNameEditorMode('create');
    setNewPlanName(createNextPlanName(plans));
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function closeEditorWithoutSaving() {
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
  }

  function selectPlan(plan: TargetDayPlan) {
    if (isSaving) {
      return;
    }

    setSelectedPlanId(plan.id);
    setDraft(createDraftFromTargetPlan(plan));
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsDeleteConfirmVisible(false);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  async function saveDraftPlan(nextDraft: PlanDraft, plan: SleepPlanPreset): Promise<boolean> {
    const planId = selectedPlanId;
    const nameError = getDraftNameError(nextDraft);

    if (!planId) {
      setErrorMessage('Выберите план сна');
      return false;
    }

    if (nameError) {
      setErrorMessage(nameError);
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedPlan = await updateTargetDayPlan(db, planId, {
        name: nextDraft.name.trim(),
        plan,
      });

      setPlans((currentPlans) => replacePlanInList(currentPlans, updatedPlan));
      setDraft(createDraftFromTargetPlan(updatedPlan));
      return true;
    } catch {
      setErrorMessage('Не удалось сохранить план сна');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCurrentDraft(): Promise<boolean> {
    if (!parsedDraft.plan) {
      setErrorMessage(parsedDraft.errorMessage ?? 'Проверьте план сна');
      return false;
    }

    return saveDraftPlan(draft, parsedDraft.plan);
  }

  async function createPlan(planName: string): Promise<boolean> {
    const sourcePlan = parsedDraft.plan ?? selectedPlan?.plan ?? DEFAULT_SLEEP_PLAN;
    const trimmedPlanName = planName.trim();

    if (trimmedPlanName.length === 0) {
      setErrorMessage('Укажите название плана');
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const createdPlan = await createTargetDayPlan(db, {
        name: trimmedPlanName,
        plan: sourcePlan,
      });

      setPlans((currentPlans) => sortPlansForDisplay([...currentPlans, createdPlan]));
      setSelectedPlanId(createdPlan.id);
      setDraft(createDraftFromTargetPlan(createdPlan));
      setActiveEditor(null);
      setIsNapDropdownOpen(false);
      return true;
    } catch {
      setErrorMessage('Не удалось создать план сна');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function activateSelectedPlan() {
    const planId = selectedPlanId;

    if (!planId || selectedPlan?.isActive) {
      return;
    }

    if (hasChanges) {
      const wasSaved = await saveCurrentDraft();

      if (!wasSaved) {
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const activePlan = await activateTargetDayPlan(db, planId);

      setPlans((currentPlans) => markPlanActive(currentPlans, activePlan));
      setDraft(createDraftFromTargetPlan(activePlan));
    } catch {
      setErrorMessage('Не удалось сделать план активным');
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteSelectedPlan() {
    if (isPlanDeleteDisabled) {
      return;
    }

    setIsDeleteConfirmVisible(true);
    setErrorMessage(null);
  }

  async function deleteSelectedPlan() {
    const planId = selectedPlanId;

    if (!planId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await deleteTargetDayPlan(db, planId);

      const loadedPlans = sortPlansForDisplay(await listTargetDayPlans(db));
      const planToSelect =
        loadedPlans.find((targetPlan) => targetPlan.isActive) ?? loadedPlans[0] ?? null;

      setPlans(loadedPlans);
      setSelectedPlanId(planToSelect?.id ?? null);
      setDraft(
        planToSelect ? createDraftFromTargetPlan(planToSelect) : createDraftFromPlan(DEFAULT_SLEEP_PLAN),
      );
      setIsDeleteConfirmVisible(false);
      setActiveEditor(null);
      setNameEditorMode(null);
      setIsNapDropdownOpen(false);
    } catch {
      setErrorMessage(
        plans.length <= 1 ? 'Нельзя удалить единственный план' : 'Не удалось удалить план сна',
      );
      setIsDeleteConfirmVisible(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditorDone() {
    if (nameEditorMode === 'create') {
      const wasCreated = await createPlan(newPlanName);

      if (wasCreated) {
        closeEditorWithoutSaving();
      }

      return;
    }

    if (nameEditorMode === 'edit') {
      const wasSaved = await saveCurrentDraft();

      if (wasSaved) {
        closeEditorWithoutSaving();
      } else {
        setErrorMessage(draftNameError ?? parsedDraft.errorMessage ?? 'Проверьте план сна');
      }

      return;
    }

    if (!activeEditor) {
      return;
    }

    const wasSaved = hasChanges ? await saveCurrentDraft() : parsedDraft.plan !== null;

    if (wasSaved) {
      closeEditorWithoutSaving();
    } else {
      setErrorMessage(draftNameError ?? parsedDraft.errorMessage ?? 'Проверьте план сна');
    }
  }

  function handleEditorRequestClose() {
    if (nameEditorMode === 'create') {
      closeEditorWithoutSaving();
      return;
    }

    void handleEditorDone();
  }

  async function selectNapCount(value: string) {
    const nextDraft = {
      ...draft,
      napCount: value,
    };
    const nextParsedDraft = parsePlanDraft(nextDraft);

    setDraft(nextDraft);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);

    if (!nextParsedDraft.plan) {
      setErrorMessage(nextParsedDraft.errorMessage ?? 'Проверьте план сна');
      return;
    }

    const wasSaved = await saveDraftPlan(nextDraft, nextParsedDraft.plan);

    if (wasSaved) {
      closeEditorWithoutSaving();
    }
  }

  function renderEditorContent() {
    if (activeEditor === 'wakeUp') {
      return (
        <RangeEditor
          endPlaceholder="0730"
          endValue={draft.wakeUpEnd}
          helper="Время подъема"
          onChangeEnd={(value) => updateDraft('wakeUpEnd', value)}
          onChangeStart={(value) => updateDraft('wakeUpStart', value)}
          startPlaceholder="0700"
          startValue={draft.wakeUpStart}
          title="Подъем"
        />
      );
    }

    if (activeEditor === 'awake') {
      return (
        <RangeEditor
          endPlaceholder="1030"
          endValue={draft.awakeEnd}
          helper="Суммарно за день"
          onChangeEnd={(value) => updateDraft('awakeEnd', value)}
          onChangeStart={(value) => updateDraft('awakeStart', value)}
          startPlaceholder="1000"
          startValue={draft.awakeStart}
          title="Бодрствование"
        />
      );
    }

    if (activeEditor === 'daySleep') {
      return (
        <RangeEditor
          endPlaceholder="330"
          endValue={draft.daySleepEnd}
          helper="Суммарно за день"
          onChangeEnd={(value) => updateDraft('daySleepEnd', value)}
          onChangeStart={(value) => updateDraft('daySleepStart', value)}
          startPlaceholder="300"
          startValue={draft.daySleepStart}
          title="Дневной сон"
        />
      );
    }

    return (
      <View style={styles.editorBlock}>
        <Text style={styles.editorTitle}>Дневных снов</Text>
        <Text style={styles.editorHelper}>Количество в плане</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsNapDropdownOpen((isOpen) => !isOpen)}
          style={({ pressed }) => [
            styles.dropdownButton,
            pressed ? styles.dropdownButtonPressed : null,
          ]}>
          <Text style={styles.dropdownValue}>{draft.napCount}</Text>
          <Text style={styles.dropdownArrow}>{isNapDropdownOpen ? '^' : 'v'}</Text>
        </Pressable>
        {isNapDropdownOpen ? (
          <View style={styles.dropdownList}>
            {NAP_COUNT_OPTIONS.map((option) => {
              const optionValue = String(option);
              const isSelected = draft.napCount === optionValue;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => {
                    void selectNapCount(optionValue);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    isSelected ? styles.selectedDropdownOption : null,
                    pressed ? styles.dropdownOptionPressed : null,
                  ]}>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      isSelected ? styles.selectedDropdownOptionText : null,
                    ]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  function renderNameInput() {
    if (!nameEditorMode) {
      return null;
    }

    return (
      <View style={styles.nameInputGroup}>
        <Text style={styles.compactLabel}>план</Text>
        <TextInput
          autoCapitalize="sentences"
          autoFocus
          maxLength={PLAN_NAME_MAX_LENGTH}
          onChangeText={(value) => {
            if (nameEditorMode === 'create') {
              setNewPlanName(value);
              setErrorMessage(null);
            } else {
              updateDraft('name', value);
            }
          }}
          placeholder="Основной"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          selectTextOnFocus
          style={styles.nameDialogInput}
          underlineColorAndroid="transparent"
          value={nameEditorMode === 'create' ? newPlanName : draft.name}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'План дня' }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {visibleErrorMessage ? <Text style={styles.errorText}>{visibleErrorMessage}</Text> : null}

          <View style={styles.planSection}>
            <View style={styles.planSectionHeader}>
              <View style={styles.planSectionTitleBlock}>
                <Text style={styles.sectionTitle}>Планы</Text>
                <Text numberOfLines={1} style={styles.planSectionMeta}>
                  Активный: {activePlanName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading || isSaving}
                onPress={() => {
                  openCreatePlanNamePrompt();
                }}
                style={({ pressed }) => [
                  styles.newPlanButton,
                  pressed && !isLoading && !isSaving ? styles.newPlanButtonPressed : null,
                  isLoading || isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.newPlanButtonText}>+ Новый</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              style={styles.planScroller}
              contentContainerStyle={styles.planScrollerContent}>
              {plans.length > 0 ? (
                plans.map((plan) => (
                  <PlanCard
                    disabled={isLoading || isSaving}
                    isSelected={plan.id === selectedPlanId}
                    key={plan.id}
                    onPress={() => selectPlan(plan)}
                    plan={plan}
                  />
                ))
              ) : (
                <Text style={styles.emptyScheduleText}>Загрузка планов</Text>
              )}
            </ScrollView>

            {selectedPlan?.isActive ? (
              <Text style={styles.activePlanNote}>Этот план используется для расчётов сегодня</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={isEditingDisabled}
                onPress={() => {
                  void activateSelectedPlan();
                }}
                style={({ pressed }) => [
                  styles.activatePlanButton,
                  pressed && !isEditingDisabled ? styles.activatePlanButtonPressed : null,
                  isEditingDisabled ? styles.disabledCard : null,
                ]}>
                <Text style={styles.activatePlanButtonText}>Сделать активным</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <SleepPlanIcon backgroundColor={colors.primarySoft} />
            </View>
            <View style={styles.heroTextBlock}>
              <View style={styles.heroTitleRow}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroTitle}>
                  {draft.name.trim() || 'План дня'}
                </Text>
                <Pressable
                  accessibilityLabel="Изменить название плана"
                  accessibilityRole="button"
                  disabled={isEditingDisabled}
                  hitSlop={8}
                  onPress={openNameEditor}
                  style={({ pressed }) => [
                    styles.editNameButton,
                    pressed && !isEditingDisabled ? styles.editNameButtonPressed : null,
                    isEditingDisabled ? styles.disabledCard : null,
                  ]}>
                  <Text style={styles.editNameIcon}>✎</Text>
                </Pressable>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroText}>
                Используется для расчётов и рекомендаций текущего дня.
              </Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard
              caption="ориентир утра"
              disabled={isEditingDisabled}
              label="Подъем"
              onPress={() => openEditor('wakeUp')}
              value={`${draft.wakeUpStart} - ${draft.wakeUpEnd}`}
            />
            <MetricCard
              caption={`Отбой ${bedtimeLabel}`}
              disabled={isEditingDisabled}
              label="Бодрствование"
              onPress={() => openEditor('awake')}
              value={
                parsedDraft.plan
                  ? formatDurationRange(
                      parsedDraft.plan.targetAwakeMinMinutes,
                      parsedDraft.plan.targetAwakeMaxMinutes,
                    )
                  : `${draft.awakeStart} - ${draft.awakeEnd}`
              }
            />
            <MetricCard
              caption="в день"
              disabled={isEditingDisabled}
              label="Дневных снов"
              onPress={() => openEditor('napCount')}
              value={draft.napCount}
            />
            <MetricCard
              caption="суммарно"
              disabled={isEditingDisabled}
              label="Дневной сон"
              onPress={() => openEditor('daySleep')}
              value={
                parsedDraft.plan
                  ? formatDurationRange(
                      parsedDraft.plan.targetDaySleepMinMinutes,
                      parsedDraft.plan.targetDaySleepMaxMinutes,
                    )
                  : `${draft.daySleepStart} - ${draft.daySleepEnd}`
              }
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Идеальный график</Text>
            <View style={styles.scheduleList}>
              {idealScheduleSegments.length > 0 ? (
                idealScheduleSegments.map((segment) => (
                  <IdealScheduleRow key={segment.id} segment={segment} />
                ))
              ) : (
                <Text style={styles.emptyScheduleText}>Проверьте параметры плана</Text>
              )}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isPlanDeleteDisabled}
            onPress={requestDeleteSelectedPlan}
            style={({ pressed }) => [
              styles.deletePlanButton,
              pressed && !isPlanDeleteDisabled ? styles.deletePlanButtonPressed : null,
              isPlanDeleteDisabled ? styles.disabledCard : null,
            ]}>
            <Text style={styles.deletePlanButtonText}>Удалить план</Text>
          </Pressable>

        </SafeAreaView>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={handleEditorRequestClose}
        transparent
        visible={isEditorModalVisible}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>
              {nameEditorMode === 'create' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={closeEditorWithoutSaving}
                  style={styles.closeButton}>
                  <Text style={styles.secondarySheetButtonText}>Отмена</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void handleEditorDone();
                }}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>{sheetActionLabel}</Text>
              </Pressable>
            </View>
            {renderEditorContent()}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeEditorWithoutSaving}
        transparent
        visible={nameEditorMode !== null}>
        <View style={styles.nameOverlay}>
          <View style={styles.nameDialog}>
            <Text style={styles.nameDialogTitle}>{sheetTitle}</Text>
            <Text style={styles.nameDialogText}>
              {nameEditorMode === 'create'
                ? 'Можно оставить предложенное название'
                : 'Коротко, чтобы быстро отличать планы'}
            </Text>
            {visibleErrorMessage ? <Text style={styles.nameDialogError}>{visibleErrorMessage}</Text> : null}
            {renderNameInput()}
            <View style={styles.nameDialogActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={closeEditorWithoutSaving}
                style={({ pressed }) => [
                  styles.nameSecondaryButton,
                  pressed && !isSaving ? styles.confirmButtonPressed : null,
                  isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.nameSecondaryButtonText}>Отмена</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void handleEditorDone();
                }}
                style={({ pressed }) => [
                  styles.namePrimaryButton,
                  pressed && !isSaving ? styles.namePrimaryButtonPressed : null,
                  isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.namePrimaryButtonText}>{sheetActionLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
        transparent
        visible={isDeleteConfirmVisible}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Удалить план?</Text>
            <Text style={styles.confirmText}>
              План «{selectedPlan?.name ?? 'План'}» исчезнет из списка. Активным станет другой
              сохранённый план.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setIsDeleteConfirmVisible(false)}
                style={({ pressed }) => [
                  styles.confirmSecondaryButton,
                  pressed && !isSaving ? styles.confirmButtonPressed : null,
                  isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.confirmSecondaryButtonText}>Отмена</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void deleteSelectedPlan();
                }}
                style={({ pressed }) => [
                  styles.confirmDangerButton,
                  pressed && !isSaving ? styles.confirmDangerButtonPressed : null,
                  isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.confirmDangerButtonText}>
                  {isSaving ? 'Удаляем...' : 'Удалить'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  planSection: {
    gap: spacing.sm,
  },
  planSectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planSectionTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  planSectionMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  newPlanButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  newPlanButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  newPlanButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  planScroller: {
    marginHorizontal: -spacing.lg,
  },
  planScrollerContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  planCard: {
    width: 184,
    minHeight: 96,
    justifyContent: 'space-between',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  selectedPlanCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  planCardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planCardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  activeBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  activeBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  planCardMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  activePlanNote: {
    minHeight: 36,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  activatePlanButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  activatePlanButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  activatePlanButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  hero: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  heroIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  heroTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  heroTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroTitleRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editNameButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editNameButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  editNameIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    minHeight: 118,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  metricCardPressed: {
    backgroundColor: colors.primarySoft,
  },
  disabledCard: {
    opacity: 0.6,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  metricCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  scheduleList: {
    gap: spacing.xs,
  },
  scheduleRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  scheduleBadge: {
    width: 42,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  awakeBadge: {
    backgroundColor: colors.primarySoft,
  },
  sleepBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  scheduleBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  sleepBadgeText: {
    color: colors.textMuted,
  },
  scheduleTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  scheduleTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  scheduleCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleTime: {
    maxWidth: 132,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyScheduleText: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  deletePlanButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  deletePlanButtonPressed: {
    backgroundColor: colors.dangerSoft,
  },
  deletePlanButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  confirmText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmSecondaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmDangerButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  confirmButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  confirmDangerButtonPressed: {
    opacity: 0.82,
  },
  confirmSecondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  confirmDangerButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  nameOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  nameDialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  nameDialogTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  nameDialogText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  nameDialogError: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  nameInputGroup: {
    minHeight: 74,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  nameDialogInput: {
    minHeight: 36,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  nameDialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameSecondaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  namePrimaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  namePrimaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  nameSecondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  namePrimaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetTitle: {
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
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  secondarySheetButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
  },
  editorBlock: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  editorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  editorHelper: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  editorInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorInputGroup: {
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
  editorInput: {
    minHeight: 30,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  nameInput: {
    minHeight: 34,
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 22,
    fontWeight: '900',
  },
  dropdownButton: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  dropdownButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  dropdownValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  dropdownArrow: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  dropdownList: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dropdownOption: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedDropdownOption: {
    backgroundColor: colors.primarySoft,
  },
  dropdownOptionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dropdownOptionText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  selectedDropdownOptionText: {
    color: colors.primary,
    fontWeight: '900',
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
