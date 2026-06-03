import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Stack, type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectAllTextInput } from '@/components/SelectAllTextInput';
import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS,
  formatAgeSleepPlanPresetCustomPlanName,
  formatAgeSleepPlanPresetTargetPlanName,
  getAgeSleepPlanPresetTemplateCatalogForProfile,
  getAgeSleepPlanPresetTemplateOptions,
  type AgeSleepPlanPresetTemplate,
  type AgeSleepPlanPresetTemplateAgeBandId,
  type AgeSleepPlanPresetTemplateCatalog,
} from '@/core/ageSleepPlanPresetTemplates';
import {
  calculateTotalSleepRangeFromWakeRange,
  checkTotalSleepRangeAgainstOfficialGuideline,
  formatDurationRangeShort,
  getAgeInCompletedMonths,
  type SleepGuidelineRangeStatus,
} from '@/core/officialSleepGuidelines';
import {
  formatNapCountText,
  getNapCountStatusForPracticalPreset,
  getPracticalSleepPresetByAgeMonths,
  type PracticalNapCountStatus,
  type PracticalSleepPreset,
} from '@/core/practicalSleepPresets';
import {
  buildEffectiveSleepDayPlan,
  buildSleepPlanPreset,
  calculatePlanBedtimeRange,
  deriveEveningSleepRulesForPlan,
} from '@/core/sleepPlan';
import {
  PLAN_CHECK_AWAKE_DESCRIPTION,
  buildSleepPlanChecks,
  getPlanAwakeRange as getSleepPlanAwakeRange,
  type CompactPlanCheckTone,
  type PlanMinuteRange,
  type SleepPlanChecks,
} from '@/core/sleepPlanChecks';
import { getSleepDayDateKeyForDate } from '@/core/sleepDay';
import {
  activateTargetDayPlan,
  createTargetDayPlan,
  deleteTargetDayPlan,
  disableSleepDayTemporaryMode,
  enableSleepDayTemporaryMode,
  getChildProfile,
  listSleepDayTemporaryModes,
  listTargetDayPlans,
  updateTargetDayPlan,
} from '@/db';
import { syncSleepNotificationsFromDatabase } from '@/notifications/sleepNotifications';
import type {
  EveningSleepRulesMode,
  SleepDayTemporaryMode,
  SleepDayTemporaryModeType,
  SleepPlanPreset,
  TargetDayPlan,
  WakeWindowPreset,
} from '@/types/sleep';

type EditorType = 'wakeUp' | 'awake' | 'napCount' | 'daySleep' | 'evening';
type NameEditorMode = 'create' | 'edit';
type PresetFlowMode = 'select' | 'preview' | 'manual';

interface PlanDraft {
  name: string;
  wakeUpStart: string;
  wakeUpEnd: string;
  awakeStart: string;
  awakeEnd: string;
  napCount: string;
  daySleepStart: string;
  daySleepEnd: string;
  latestEveningNapEnd: string;
  maxEveningNap: string;
  microNap: string;
  eveningRulesMode: EveningSleepRulesMode;
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

interface EveningSettingsCardProps {
  disabled: boolean;
  eveningRulesMode: EveningSleepRulesMode;
  isExpanded: boolean;
  latestNapEndLabel: string;
  maxNapLabel: string;
  microNapLabel: string;
  onOpenInfo: () => void;
  onPress: () => void;
  onToggle: () => void;
}

interface PlanCardProps {
  ageMonths: number | null;
  plan: TargetDayPlan;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
}

interface BasePlanPresetFlowProps {
  agePresetCatalog: AgeSleepPlanPresetTemplateCatalog | null;
  canClose: boolean;
  disabled: boolean;
  flowMode: PresetFlowMode;
  hasBirthDate: boolean;
  manualAgeBandId: AgeSleepPlanPresetTemplateAgeBandId | null;
  manualDraft: PlanDraft;
  manualPlan: SleepPlanPreset | null;
  onBackToSelection: () => void;
  onClose: () => void;
  onOpenEditor: (editorType: EditorType) => void;
  onOpenProfile: () => void;
  onSelectManualAgeBand: (ageBandId: AgeSleepPlanPresetTemplateAgeBandId) => void;
  onSelectPreset: (preset: AgeSleepPlanPresetTemplate) => void;
  onStartManualEdit: (preset: AgeSleepPlanPresetTemplate) => void;
  onUseManualPlan: () => void;
  onUsePreset: (preset: AgeSleepPlanPresetTemplate) => void;
  selectedPreset: AgeSleepPlanPresetTemplate | null;
}

interface PresetTemplateCardProps {
  catalog: AgeSleepPlanPresetTemplateCatalog;
  disabled: boolean;
  onSelect: () => void;
  preset: AgeSleepPlanPresetTemplate;
}

interface PresetPreviewCardProps {
  disabled: boolean;
  onBack: () => void;
  onEditDetails: () => void;
  onUse: () => void;
  preset: AgeSleepPlanPresetTemplate;
}

interface ManualPresetDraftCardProps {
  disabled: boolean;
  draft: PlanDraft;
  onBack: () => void;
  onOpenEditor: (editorType: EditorType) => void;
  onUse: () => void;
  plan: SleepPlanPreset | null;
  preset: AgeSleepPlanPresetTemplate;
}

interface ActivePlanSummaryCardProps {
  plan: TargetDayPlan;
}

interface TemporaryModeCardProps {
  description: string;
  disabled: boolean;
  enabledText: string;
  isEnabled: boolean;
  onDisable: () => void;
  onEnable: () => void;
  title: string;
}

interface TodayModesSectionProps {
  disabled: boolean;
  isEarlyWakeEnabled: boolean;
  isSoftDayEnabled: boolean;
  onDisableMode: (mode: SleepDayTemporaryModeType) => void;
  onEnableMode: (mode: SleepDayTemporaryModeType) => void;
}

interface TodayPlanPoint {
  id: string;
  caption: string | null;
  timeLabel: string;
  title: string;
}

interface TodayPlanWakeWindow {
  id: string;
  rangeLabel: string;
  title: string;
}

interface TodayPlanSectionProps {
  isWakeWindowsExpanded: boolean;
  onToggleWakeWindows: () => void;
  plan: SleepPlanPreset;
}

interface PlanChecksSectionProps {
  baseAwakeRange: PlanMinuteRange | null;
  checks: SleepPlanChecks;
  isExpanded: boolean;
  onOpenOfficialInfo: () => void;
  onOpenPracticalInfo: () => void;
  onOpenWakeWindowInfo: () => void;
  onToggle: () => void;
  todayAwakeRange: PlanMinuteRange | null;
}

interface PlanCheckStatusRowProps {
  label: string;
  status: string;
  tone: CompactPlanCheckTone;
}

interface PlanCheckDetailBlockProps {
  children: ReactNode;
  infoAccessibilityLabel?: string;
  levelLabel?: string;
  onOpenInfo?: () => void;
  title: string;
}

interface PlanCheckDetailLineProps {
  label: string;
  value: string;
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
const OFFICIAL_SLEEP_INFO_ROUTE = '/info?article=official-sleep-guidelines' as Href;
const PRACTICAL_SLEEP_INFO_ROUTE = '/info?article=practical-sleep-guidelines' as Href;
const WAKE_WINDOW_INFO_ROUTE = '/info?article=wake-window-guidelines' as Href;
const EVENING_SLEEP_INFO_ROUTE = '/info?article=evening-sleep-rules' as Href;
const PROFILE_ROUTE = '/profile' as Href;
const PLAN_NAME_MAX_LENGTH = 40;
const MAX_MICRO_NAP_MINUTES = 60;
const MAX_EVENING_NAP_MINUTES = 120;
const WAKE_UP_TOLERANCE_MINUTES = 10;

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

function formatMinuteDurationOrOff(minutes: number): string {
  return minutes === 0 ? 'выкл' : formatDuration(minutes);
}

function formatDurationRange(startMinutes: number, endMinutes: number): string {
  const start = formatDuration(startMinutes);
  const end = formatDuration(endMinutes);

  return start === end ? start : `${start} - ${end}`;
}

function formatMinuteRangeShort(range: PlanMinuteRange | null): string {
  if (!range) {
    return 'не рассчитано';
  }

  return formatDurationRangeShort(range.minMinutes, range.maxMinutes);
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

function formatAgeMonthsLabel(ageMonths: number): string {
  const lastTwoDigits = ageMonths % 100;
  const lastDigit = ageMonths % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${ageMonths} месяцев`;
  }

  if (lastDigit === 1) {
    return `${ageMonths} месяц`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${ageMonths} месяца`;
  }

  return `${ageMonths} месяцев`;
}

function getPlanTotalSleepRange(plan: SleepPlanPreset): {
  minTotalSleepMinutes: number;
  maxTotalSleepMinutes: number;
} {
  return calculateTotalSleepRangeFromWakeRange({
    maxWakeMinutes: plan.targetAwakeMaxMinutes,
    minWakeMinutes: plan.targetAwakeMinMinutes,
  });
}

function getCompactGuidelineBadgeLabel(status: SleepGuidelineRangeStatus): string | null {
  switch (status) {
    case 'within_recommended':
      return 'В ориентире';
    case 'partially_within_recommended':
      return 'Частично';
    case 'below_recommended':
      return 'Ниже';
    case 'above_recommended':
      return 'Выше';
    case 'unknown':
      return null;
  }
}

function getPracticalNapCountCaption(status: PracticalNapCountStatus): string | null {
  switch (status) {
    case 'typical':
      return 'типично для возраста';
    case 'transition':
      return 'переходный вариант';
    case 'outside_typical':
      return 'отличается от ориентира';
    case 'unknown':
      return null;
  }
}

function getPracticalDaySleepCaption(
  preset: PracticalSleepPreset | null,
): string {
  return preset
    ? `ориентир: ${formatDurationRangeShort(
        preset.daySleepMinMinutes,
        preset.daySleepMaxMinutes,
      )}`
    : 'суммарно';
}

function formatPresetTemplateDaySleep(preset: AgeSleepPlanPresetTemplate): string {
  return formatDurationRangeShort(preset.daySleepMinMinutes, preset.daySleepMaxMinutes);
}

function formatPresetTemplateBedtime(preset: AgeSleepPlanPresetTemplate): string {
  return formatClockRange(
    preset.estimatedBedtimeStartMinutes,
    preset.estimatedBedtimeEndMinutes,
  );
}

function formatPresetTemplateNightSleep(preset: AgeSleepPlanPresetTemplate): string {
  return formatDurationRangeShort(
    preset.estimatedNightSleepMinMinutes,
    preset.estimatedNightSleepMaxMinutes,
  );
}

function formatPresetTemplateWakeUpAround(preset: AgeSleepPlanPresetTemplate): string {
  return formatClockMinutes(preset.plan.wakeUpStartMinutes);
}

function getPresetTemplateMeaningText(preset: AgeSleepPlanPresetTemplate): string {
  return preset.isRecommended
    ? 'Мягкий старт: больше дневных снов и короче промежутки бодрствования.'
    : 'Соседний вариант, если ребёнок уже спокойно бодрствует дольше.';
}

function getPresetTemplateWhyText(
  catalog: AgeSleepPlanPresetTemplateCatalog,
  preset: AgeSleepPlanPresetTemplate,
): string {
  if (preset.isRecommended) {
    return catalog.whyRecommendedText;
  }

  return 'Это близкий возрастной вариант. Он может подойти, если текущий режим уже устойчиво держится без перегруза.';
}

function formatPlanNapCount(napCount: number): string {
  if (napCount === 1) {
    return '1 сон';
  }

  if (napCount >= 2 && napCount <= 4) {
    return `${napCount} сна`;
  }

  return `${napCount} снов`;
}

function getGuidelineBadgeTone(status: SleepGuidelineRangeStatus): 'default' | 'warning' {
  return status === 'within_recommended' || status === 'partially_within_recommended'
    ? 'default'
    : 'warning';
}

function formatClockRange(startMinutes: number, endMinutes: number): string {
  const start = formatClockMinutes(startMinutes);
  const end = formatClockMinutes(endMinutes);

  return start === end ? start : `${start} - ${end}`;
}

function getClockMidpointMinutes(startMinutes: number, endMinutes: number): number {
  return Math.round((startMinutes + endMinutes) / 2);
}

function normalizePlanClockMinutes(minutes: number): number {
  const dayMinutes = 24 * 60;

  return ((minutes % dayMinutes) + dayMinutes) % dayMinutes;
}

function buildNapSleepDurations(plan: SleepPlanPreset): number[] {
  const baseDuration = Math.floor(plan.targetDaySleepMinutes / plan.napCount);
  const extraMinutes = plan.targetDaySleepMinutes - baseDuration * plan.napCount;

  return Array.from({ length: plan.napCount }, (_, index) =>
    baseDuration + (index < extraMinutes ? 1 : 0),
  );
}

function getFallbackWakeWindowTarget(plan: SleepPlanPreset): number {
  return Math.max(1, Math.round(plan.targetAwakeMinutes / (plan.napCount + 1)));
}

function getFinalWakeWindow(plan: SleepPlanPreset): WakeWindowPreset {
  const wakeWindowTargetsTotal = plan.wakeWindows.reduce(
    (total, wakeWindow) => total + wakeWindow.targetWakeMinutes,
    0,
  );
  const wakeWindowMinTotal = plan.wakeWindows.reduce(
    (total, wakeWindow) => total + wakeWindow.minWakeMinutes,
    0,
  );
  const wakeWindowMaxTotal = plan.wakeWindows.reduce(
    (total, wakeWindow) => total + wakeWindow.maxWakeMinutes,
    0,
  );
  const minWakeMinutes = Math.max(1, plan.targetAwakeMinMinutes - wakeWindowMinTotal);
  const maxWakeMinutes = Math.max(
    minWakeMinutes,
    plan.targetAwakeMaxMinutes - wakeWindowMaxTotal,
  );
  const targetWakeMinutes = Math.min(
    Math.max(plan.targetAwakeMinutes - wakeWindowTargetsTotal, minWakeMinutes),
    maxWakeMinutes,
  );

  return {
    maxWakeMinutes,
    minWakeMinutes,
    napNumber: plan.napCount + 1,
    targetWakeMinutes,
  };
}

function getDisplayWakeWindow(plan: SleepPlanPreset, index: number): WakeWindowPreset {
  return plan.wakeWindows[index] ?? {
    maxWakeMinutes: getFallbackWakeWindowTarget(plan),
    minWakeMinutes: getFallbackWakeWindowTarget(plan),
    napNumber: index + 1,
    targetWakeMinutes: getFallbackWakeWindowTarget(plan),
  };
}

function buildTodayPlanPoints(plan: SleepPlanPreset): TodayPlanPoint[] {
  const points: TodayPlanPoint[] = [
    {
      caption: null,
      id: 'wake-up',
      timeLabel: formatClockMinutes(getClockMidpointMinutes(
        plan.wakeUpStartMinutes,
        plan.wakeUpEndMinutes,
      )),
      title: 'Подъём',
    },
  ];
  const sleepDurations = buildNapSleepDurations(plan);
  let cursorMinutes = getClockMidpointMinutes(plan.wakeUpStartMinutes, plan.wakeUpEndMinutes);

  for (let index = 0; index < plan.napCount; index += 1) {
    const wakeWindow = getDisplayWakeWindow(plan, index);
    const sleepDurationMinutes = sleepDurations[index] ?? 0;
    const sleepStartMinutes = cursorMinutes + wakeWindow.targetWakeMinutes;
    const sleepEndMinutes = sleepStartMinutes + sleepDurationMinutes;

    points.push({
      caption: `${formatClockRange(sleepStartMinutes, sleepEndMinutes)} · ${formatDuration(
        sleepDurationMinutes,
      )}`,
      id: `nap-${index + 1}`,
      timeLabel: formatClockMinutes(sleepStartMinutes),
      title: `Сон ${index + 1}`,
    });

    cursorMinutes = sleepEndMinutes;
  }

  const finalWakeWindow = getFinalWakeWindow(plan);
  const nightStartMinutes = normalizePlanClockMinutes(
    cursorMinutes + finalWakeWindow.targetWakeMinutes,
  );

  points.push({
    caption: null,
    id: 'night',
    timeLabel: formatClockMinutes(nightStartMinutes),
    title: 'Ночь',
  });

  return points;
}

function buildTodayPlanWakeWindows(plan: SleepPlanPreset): TodayPlanWakeWindow[] {
  const wakeWindows = [...plan.wakeWindows, getFinalWakeWindow(plan)];

  return wakeWindows.map((wakeWindow, index) => ({
    id: `wake-window-${index + 1}`,
    rangeLabel: formatDurationRange(wakeWindow.minWakeMinutes, wakeWindow.maxWakeMinutes),
    title: `ВБ ${index + 1}`,
  }));
}

function getActiveTemporaryModes(
  temporaryModes: SleepDayTemporaryMode[],
): SleepDayTemporaryMode[] {
  return temporaryModes.filter((temporaryMode) => temporaryMode.disabledAt === null);
}

function hasActiveTemporaryMode(
  temporaryModes: SleepDayTemporaryMode[],
  mode: SleepDayTemporaryModeType,
): boolean {
  return temporaryModes.some(
    (temporaryMode) => temporaryMode.mode === mode && temporaryMode.disabledAt === null,
  );
}

function createDraftFromPlan(plan: SleepPlanPreset, name = DEFAULT_PLAN_NAME): PlanDraft {
  return {
    awakeEnd: formatDurationInput(plan.targetAwakeMaxMinutes),
    awakeStart: formatDurationInput(plan.targetAwakeMinMinutes),
    daySleepEnd: formatDurationInput(plan.targetDaySleepMaxMinutes),
    daySleepStart: formatDurationInput(plan.targetDaySleepMinMinutes),
    eveningRulesMode: 'auto',
    latestEveningNapEnd: formatClockMinutes(plan.latestEveningNapEndMinutes),
    maxEveningNap: String(plan.maxEveningNapMinutes),
    microNap: String(plan.microNapMinutes),
    name,
    napCount: String(plan.napCount),
    wakeUpEnd: formatClockMinutes(plan.wakeUpEndMinutes),
    wakeUpStart: formatClockMinutes(plan.wakeUpStartMinutes),
  };
}

function createDraftFromTargetPlan(targetPlan: TargetDayPlan): PlanDraft {
  return {
    ...createDraftFromPlan(targetPlan.plan, targetPlan.name),
    eveningRulesMode: targetPlan.eveningRulesMode,
  };
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

function normalizeMinuteInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

function parseMinuteInput(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{1,3}$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
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

  const basePlanInput = {
    napCount,
    targetAwakeMaxMinutes,
    targetAwakeMinMinutes,
    targetDaySleepMaxMinutes,
    targetDaySleepMinMinutes,
    wakeUpEndMinutes,
    wakeUpStartMinutes,
  };
  const eveningRules =
    draft.eveningRulesMode === 'auto' ? deriveEveningSleepRulesForPlan(basePlanInput) : null;
  const latestEveningNapEndMinutes =
    eveningRules?.latestEveningNapEndMinutes ?? parseClockInput(draft.latestEveningNapEnd);
  const maxEveningNapMinutes =
    eveningRules?.maxEveningNapMinutes ?? parseMinuteInput(draft.maxEveningNap);
  const microNapMinutes = eveningRules?.microNapMinutes ?? parseMinuteInput(draft.microNap);

  if (latestEveningNapEndMinutes === null) {
    return { errorMessage: 'Проверьте время вечернего ограничения', plan: null };
  }

  if (microNapMinutes === null || microNapMinutes > MAX_MICRO_NAP_MINUTES) {
    return { errorMessage: 'Микро-сон может быть от 0 до 60 минут', plan: null };
  }

  if (
    maxEveningNapMinutes === null ||
    maxEveningNapMinutes < 1 ||
    maxEveningNapMinutes > MAX_EVENING_NAP_MINUTES
  ) {
    return { errorMessage: 'Короткий вечерний сон может быть от 1 до 120 минут', plan: null };
  }

  if (microNapMinutes > maxEveningNapMinutes) {
    return { errorMessage: 'Микро-сон должен быть короче вечернего ограничения', plan: null };
  }

  return {
    errorMessage: null,
    plan: buildSleepPlanPreset({
      ...basePlanInput,
      latestEveningNapEndMinutes,
      maxEveningNapMinutes,
      microNapMinutes,
      minNightSleepMinutes: DEFAULT_SLEEP_PLAN.minNightSleepMinutes,
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
    first.targetDaySleepMaxMinutes === second.targetDaySleepMaxMinutes &&
    first.latestEveningNapEndMinutes === second.latestEveningNapEndMinutes &&
    first.maxEveningNapMinutes === second.maxEveningNapMinutes &&
    first.microNapMinutes === second.microNapMinutes
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

function PlanCard({ ageMonths, plan, isSelected, disabled, onPress }: PlanCardProps) {
  const totalSleepRange = getPlanTotalSleepRange(plan.plan);
  const guidelineCheck = checkTotalSleepRangeAgainstOfficialGuideline({
    ageMonths,
    maxTotalSleepMinutes: totalSleepRange.maxTotalSleepMinutes,
    minTotalSleepMinutes: totalSleepRange.minTotalSleepMinutes,
  });
  const compactBadgeLabel = getCompactGuidelineBadgeLabel(guidelineCheck.status);

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
            <Text style={styles.activeBadgeText}>✓</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.planCardSleepBlock}>
        <Text style={styles.planCardLabel}>Сон за сутки</Text>
        <Text numberOfLines={2} style={styles.planCardSleepValue}>
          {formatDurationRangeShort(
            totalSleepRange.minTotalSleepMinutes,
            totalSleepRange.maxTotalSleepMinutes,
          )}
        </Text>
      </View>
      <View style={styles.planCardFooter}>
        <View style={styles.planCardChip}>
          <Text numberOfLines={1} style={styles.planCardChipText}>
            {formatPlanNapCount(plan.plan.napCount)}
          </Text>
        </View>
        {compactBadgeLabel ? (
          <View
            style={[
              styles.compactGuidelineBadge,
              getGuidelineBadgeTone(guidelineCheck.status) === 'warning'
                ? styles.compactGuidelineBadgeWarning
                : null,
            ]}>
            <Text
              numberOfLines={1}
              style={[
                styles.compactGuidelineBadgeText,
                getGuidelineBadgeTone(guidelineCheck.status) === 'warning'
                  ? styles.compactGuidelineBadgeTextWarning
                  : null,
              ]}>
              {compactBadgeLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ActivePlanSummaryCard({ plan }: ActivePlanSummaryCardProps) {
  const wakeUpAroundLabel = formatClockMinutes(
    getClockMidpointMinutes(plan.plan.wakeUpStartMinutes, plan.plan.wakeUpEndMinutes),
  );

  return (
    <View style={styles.activeSummaryCard}>
      <View style={styles.activeSummaryHeader}>
        <View style={styles.heroIcon}>
          <SleepPlanIcon backgroundColor={colors.primarySoft} />
        </View>
        <View style={styles.activeSummaryTitleBlock}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.activeSummaryTitle}>
            {plan.name}
          </Text>
          <Text style={styles.activeSummaryMeta}>Подъём около {wakeUpAroundLabel}</Text>
        </View>
      </View>
      <View style={styles.activeSummaryPills}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillText}>{formatPlanNapCount(plan.plan.napCount)}</Text>
        </View>
        <View style={[styles.summaryPill, styles.summaryPillActive]}>
          <Text style={[styles.summaryPillText, styles.summaryPillActiveText]}>Активен</Text>
        </View>
      </View>
      <Text style={styles.activeSummaryHint}>
        Допуск ±{WAKE_UP_TOLERANCE_MINUTES} минут — нормально.
      </Text>
    </View>
  );
}

function TemporaryModeCard({
  description,
  disabled,
  enabledText,
  isEnabled,
  onDisable,
  onEnable,
  title,
}: TemporaryModeCardProps) {
  return (
    <View style={styles.temporaryModeCard}>
      <View style={styles.temporaryModeTextBlock}>
        <Text style={styles.temporaryModeTitle}>{title}</Text>
        <Text style={styles.temporaryModeDescription}>{description}</Text>
        {isEnabled ? <Text style={styles.temporaryModeEnabledText}>{enabledText}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={isEnabled ? onDisable : onEnable}
        style={({ pressed }) => [
          isEnabled ? styles.temporaryModeSecondaryButton : styles.temporaryModePrimaryButton,
          pressed && !disabled
            ? isEnabled
              ? styles.guidelineSecondaryButtonPressed
              : styles.guidelinePrimaryButtonPressed
            : null,
          disabled ? styles.disabledCard : null,
        ]}>
        <Text
          style={
            isEnabled
              ? styles.temporaryModeSecondaryButtonText
              : styles.temporaryModePrimaryButtonText
          }>
          {isEnabled ? 'Выключить' : 'Включить на сегодня'}
        </Text>
      </Pressable>
    </View>
  );
}

function TodayModesSection({
  disabled,
  isEarlyWakeEnabled,
  isSoftDayEnabled,
  onDisableMode,
  onEnableMode,
}: TodayModesSectionProps) {
  const isScheduleAdjusted = isEarlyWakeEnabled && isSoftDayEnabled;

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionTitle}>Сегодня</Text>
        <Text style={styles.sectionCaption}>
          Временные режимы меняют только сегодняшний день. Основной план не изменится.
        </Text>
      </View>

      {isScheduleAdjusted ? (
        <View style={styles.todayAdjustedBanner}>
          <Text style={styles.todayAdjustedTitle}>Сегодня график скорректирован</Text>
          <Text style={styles.todayAdjustedText}>
            Похоже, сегодня нужен более мягкий расчёт: включены мягкий день и ранний подъём.
          </Text>
        </View>
      ) : null}

      <View style={styles.temporaryModeList}>
        <TemporaryModeCard
          description="Можно немного снизить цель бодрствования и спокойнее отнестись к дневному сну."
          disabled={disabled}
          enabledText="Сегодня включён мягкий день"
          isEnabled={isSoftDayEnabled}
          onDisable={() => onDisableMode('soft_day')}
          onEnable={() => onEnableMode('soft_day')}
          title="Мягкий день"
        />
        <TemporaryModeCard
          description="Если день начался раньше обычного, можно бережно укоротить первое окно бодрствования."
          disabled={disabled}
          enabledText="Сегодня ранний подъём"
          isEnabled={isEarlyWakeEnabled}
          onDisable={() => onDisableMode('early_wake')}
          onEnable={() => onEnableMode('early_wake')}
          title="Ранний подъём"
        />
      </View>
    </View>
  );
}

function TodayPlanPointRow({ point }: { point: TodayPlanPoint }) {
  return (
    <View style={styles.todayPlanPointRow}>
      <Text style={styles.todayPlanPointTime}>{point.timeLabel}</Text>
      <View style={styles.todayPlanPointTextBlock}>
        <Text style={styles.todayPlanPointTitle}>{point.title}</Text>
        {point.caption ? (
          <Text numberOfLines={2} style={styles.todayPlanPointCaption}>
            {point.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TodayPlanSection({
  isWakeWindowsExpanded,
  onToggleWakeWindows,
  plan,
}: TodayPlanSectionProps) {
  const points = buildTodayPlanPoints(plan);
  const wakeWindows = buildTodayPlanWakeWindows(plan);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>План на сегодня</Text>
      <View style={styles.todayPlanList}>
        {points.map((point) => (
          <TodayPlanPointRow key={point.id} point={point} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isWakeWindowsExpanded }}
        onPress={onToggleWakeWindows}
        style={({ pressed }) => [
          styles.wakeWindowsToggleButton,
          pressed ? styles.guidelineSecondaryButtonPressed : null,
        ]}>
        <Text style={styles.wakeWindowsToggleButtonText}>
          {isWakeWindowsExpanded ? 'Скрыть окна бодрствования' : 'Показать окна бодрствования'}
        </Text>
      </Pressable>
      {isWakeWindowsExpanded ? (
        <View style={styles.wakeWindowList}>
          {wakeWindows.map((wakeWindow) => (
            <View key={wakeWindow.id} style={styles.wakeWindowRow}>
              <Text style={styles.wakeWindowTitle}>{wakeWindow.title}</Text>
              <Text style={styles.wakeWindowRange}>{wakeWindow.rangeLabel}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PlanCheckStatusRow({ label, status, tone }: PlanCheckStatusRowProps) {
  return (
    <View style={styles.planCheckStatusRow}>
      <Text style={styles.planCheckStatusLabel}>{label}</Text>
      <View
        style={[
          styles.planCheckStatusBadge,
          tone === 'warning' ? styles.planCheckStatusBadgeWarning : null,
          tone === 'muted' ? styles.planCheckStatusBadgeMuted : null,
        ]}>
        <Text
          style={[
            styles.planCheckStatusText,
            tone === 'warning' ? styles.planCheckStatusTextWarning : null,
            tone === 'muted' ? styles.planCheckStatusTextMuted : null,
          ]}>
          {status}
        </Text>
      </View>
    </View>
  );
}

function PlanCheckDetailLine({ label, value }: PlanCheckDetailLineProps) {
  return (
    <View style={styles.planCheckDetailLine}>
      <Text style={styles.planCheckDetailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.planCheckDetailValue}>
        {value}
      </Text>
    </View>
  );
}

function PlanCheckDetailBlock({
  children,
  infoAccessibilityLabel,
  levelLabel,
  onOpenInfo,
  title,
}: PlanCheckDetailBlockProps) {
  return (
    <View style={styles.planCheckDetailBlock}>
      <View style={styles.planCheckDetailHeader}>
        <View style={styles.planCheckDetailTitleBlock}>
          <Text style={styles.planCheckDetailTitle}>{title}</Text>
          {levelLabel ? <Text style={styles.planCheckDetailLevel}>{levelLabel}</Text> : null}
        </View>
        {onOpenInfo ? (
          <Pressable
            accessibilityLabel={infoAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenInfo}
            style={({ pressed }) => [
              styles.guidelineInfoButton,
              pressed ? styles.guidelineInfoButtonPressed : null,
            ]}>
            <Text style={styles.guidelineInfoButtonText}>i</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.planCheckDetailBody}>{children}</View>
    </View>
  );
}

function PlanChecksSection({
  baseAwakeRange,
  checks,
  isExpanded,
  onOpenOfficialInfo,
  onOpenPracticalInfo,
  onOpenWakeWindowInfo,
  onToggle,
  todayAwakeRange,
}: PlanChecksSectionProps) {
  const hasTodayAwakeComparison = baseAwakeRange !== null && todayAwakeRange !== null;

  return (
    <View style={styles.section}>
      <View style={styles.planChecksPanel}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionTitle}>Проверка и расчёт</Text>
        </View>

        <View style={styles.planCheckStatusList}>
          <PlanCheckStatusRow
            label="Сон за сутки"
            status={checks.officialSleep.summaryLabel}
            tone={checks.officialSleep.tone}
          />
          <PlanCheckStatusRow
            label="Дневной сон"
            status={checks.daySleep.summaryLabel}
            tone={checks.daySleep.tone}
          />
          <PlanCheckStatusRow
            label="Бодрствование"
            status={checks.wakeWindows.summaryLabel}
            tone={checks.wakeWindows.tone}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.checksToggleButton,
            pressed ? styles.guidelineSecondaryButtonPressed : null,
          ]}>
          <Text style={styles.checksToggleButtonText}>
            {isExpanded ? 'Скрыть расчёт' : 'Подробнее о расчёте'}
          </Text>
        </Pressable>

        {isExpanded ? (
          <View style={styles.checksContent}>
            <PlanCheckDetailBlock
              infoAccessibilityLabel="Открыть справку про нормы сна"
              levelLabel="Уровень A · официальный ориентир"
              onOpenInfo={onOpenOfficialInfo}
              title="Сон за 24 часа">
              <PlanCheckDetailLine
                label="План"
                value={formatMinuteRangeShort(checks.officialSleep.planRange)}
              />
              <PlanCheckDetailLine
                label="Официальный ориентир"
                value={formatMinuteRangeShort(checks.officialSleep.guidelineRange)}
              />
              <Text style={styles.planCheckDetailNote}>
                Сверяется только суммарный сон за 24 часа.
              </Text>
            </PlanCheckDetailBlock>

            <PlanCheckDetailBlock title="Бодрствование за 24 часа (ВБ)">
              <Text style={styles.planCheckDetailNote}>{PLAN_CHECK_AWAKE_DESCRIPTION}</Text>
              {hasTodayAwakeComparison ? (
                <>
                  <PlanCheckDetailLine
                    label="Обычный план"
                    value={formatMinuteRangeShort(baseAwakeRange)}
                  />
                  <PlanCheckDetailLine
                    label="Сегодня"
                    value={formatMinuteRangeShort(todayAwakeRange)}
                  />
                </>
              ) : (
                <PlanCheckDetailLine
                  label="План"
                  value={formatMinuteRangeShort(checks.awakeRange)}
                />
              )}
            </PlanCheckDetailBlock>

            <PlanCheckDetailBlock
              infoAccessibilityLabel="Открыть справку про дневной сон"
              levelLabel="Уровень B · практический ориентир"
              onOpenInfo={onOpenPracticalInfo}
              title="Дневной сон">
              <PlanCheckDetailLine
                label="План"
                value={formatMinuteRangeShort(checks.daySleep.planRange)}
              />
              <PlanCheckDetailLine
                label="Ориентир Уровня B"
                value={formatMinuteRangeShort(checks.daySleep.guidelineRange)}
              />
              <Text style={styles.planCheckDetailNote}>
                Практический ориентир, а не официальная медицинская норма.
              </Text>
            </PlanCheckDetailBlock>

            <PlanCheckDetailBlock
              infoAccessibilityLabel="Открыть справку про окна бодрствования"
              levelLabel="Уровень C · практический ориентир"
              onOpenInfo={onOpenWakeWindowInfo}
              title="Окна бодрствования">
              <PlanCheckDetailLine
                label="План"
                value={formatMinuteRangeShort(checks.wakeWindows.planRange)}
              />
              <PlanCheckDetailLine
                label="Ориентир Уровня C"
                value={formatMinuteRangeShort(checks.wakeWindows.guidelineRange)}
              />
              <Text style={styles.planCheckDetailNote}>
                Практический ориентир между снами, а не официальная медицинская норма.
              </Text>
            </PlanCheckDetailBlock>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EveningSettingsCard({
  disabled,
  eveningRulesMode,
  isExpanded,
  latestNapEndLabel,
  maxNapLabel,
  microNapLabel,
  onOpenInfo,
  onPress,
  onToggle,
}: EveningSettingsCardProps) {
  return (
    <View style={styles.eveningPanel}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.eveningToggle,
          pressed && !disabled ? styles.metricCardPressed : null,
          disabled ? styles.disabledCard : null,
        ]}>
        <View style={styles.eveningCardTextBlock}>
          <Text style={styles.metricLabel}>Дополнительно</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.eveningCardValue}>
            Вечерние сны
          </Text>
          <Text numberOfLines={2} style={styles.metricCaption}>
            {eveningRulesMode === 'auto' ? 'авто · ' : 'ручные · '}микро-сон {microNapLabel} ·
            не позже {latestNapEndLabel}
          </Text>
        </View>
        <Text style={styles.eveningCardArrow}>{isExpanded ? 'v' : '>'}</Text>
      </Pressable>

      {isExpanded ? (
        <View style={styles.eveningExpandedBody}>
          <Text style={styles.eveningExplanation}>
            {eveningRulesMode === 'auto'
              ? 'Сейчас правила считаются автоматически из отбоя и числа дневных снов.'
              : 'Сейчас используются ручные вечерние правила для этого плана.'}{' '}
            Они помогают вечером выбрать: короткий сон, микро-сон или ранний отбой.
          </Text>
          <View style={styles.eveningRuleList}>
            <Text style={styles.eveningRuleText}>Микро-сон: {microNapLabel}</Text>
            <Text style={styles.eveningRuleText}>Последний вечерний сон: до {latestNapEndLabel}</Text>
            <Text style={styles.eveningRuleText}>Короткий вечерний сон: до {maxNapLabel}</Text>
          </View>
          <View style={styles.eveningActions}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onPress}
              style={({ pressed }) => [
                styles.eveningEditButton,
                pressed && !disabled ? styles.guidelineSecondaryButtonPressed : null,
                disabled ? styles.disabledCard : null,
              ]}>
              <Text style={styles.eveningEditButtonText}>Изменить</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={onOpenInfo}
              style={({ pressed }) => [
                styles.eveningInfoLink,
                pressed ? styles.scientificEvidenceLinkPressed : null,
              ]}>
              <Text style={styles.eveningInfoLinkText}>Как это работает</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PresetTemplateCard({
  catalog,
  disabled,
  onSelect,
  preset,
}: PresetTemplateCardProps) {
  return (
    <View
      style={[
        styles.presetTemplateCard,
        preset.isRecommended ? styles.presetTemplateCardRecommended : null,
      ]}>
      <View style={styles.presetTemplateHeader}>
        <Text style={styles.presetTemplateTitle}>{preset.title}</Text>
        {preset.isRecommended ? (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedBadgeText}>Рекомендуем</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.presetTemplateMeaning}>{getPresetTemplateMeaningText(preset)}</Text>

      <View style={styles.presetTemplateFacts}>
        <Text style={styles.presetTemplateFact}>
          Дневных снов: {formatNapCountText(preset.napCount)}
        </Text>
        <Text style={styles.presetTemplateFact}>
          Дневной сон: {formatPresetTemplateDaySleep(preset)}
        </Text>
        <Text style={styles.presetTemplateFact}>
          Ориентир ночи: {formatPresetTemplateNightSleep(preset)}, отбой{' '}
          {formatPresetTemplateBedtime(preset)}
        </Text>
      </View>

      <View style={styles.presetWhyBlock}>
        <Text style={styles.presetWhyTitle}>Почему мы это советуем</Text>
        <Text style={styles.presetWhyText}>{getPresetTemplateWhyText(catalog, preset)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSelect}
        style={({ pressed }) => [
          styles.presetPrimaryButton,
          pressed && !disabled ? styles.guidelinePrimaryButtonPressed : null,
          disabled ? styles.disabledCard : null,
        ]}>
        <Text style={styles.presetPrimaryButtonText}>Выбрать этот план</Text>
      </Pressable>
    </View>
  );
}

function PresetPreviewCard({
  disabled,
  onBack,
  onEditDetails,
  onUse,
  preset,
}: PresetPreviewCardProps) {
  return (
    <View style={styles.presetPreviewCard}>
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionTitle}>Ваш базовый план</Text>
        <Text style={styles.sectionCaption}>
          Проверьте спокойный стартовый режим. Он сохранится только после нажатия кнопки.
        </Text>
      </View>

      <View style={styles.presetPreviewList}>
        <Text style={styles.presetPreviewRow}>
          Подъём около {formatPresetTemplateWakeUpAround(preset)}
        </Text>
        <Text style={styles.presetPreviewRow}>{formatPlanNapCount(preset.napCount)}</Text>
        <Text style={styles.presetPreviewRow}>
          Дневной сон {formatPresetTemplateDaySleep(preset)}
        </Text>
        <Text style={styles.presetPreviewRow}>
          Ночь примерно {formatPresetTemplateNightSleep(preset)}, отбой{' '}
          {formatPresetTemplateBedtime(preset)}
        </Text>
      </View>

      <View style={styles.presetActions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onUse}
          style={({ pressed }) => [
            styles.presetPrimaryButton,
            pressed && !disabled ? styles.guidelinePrimaryButtonPressed : null,
            disabled ? styles.disabledCard : null,
          ]}>
          <Text style={styles.presetPrimaryButtonText}>Использовать этот план</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onEditDetails}
          style={({ pressed }) => [
            styles.presetSecondaryButton,
            pressed && !disabled ? styles.guidelineSecondaryButtonPressed : null,
            disabled ? styles.disabledCard : null,
          ]}>
          <Text style={styles.presetSecondaryButtonText}>Изменить детали</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onBack}
        style={({ pressed }) => [
          styles.presetPlainButton,
          pressed && !disabled ? styles.scientificEvidenceLinkPressed : null,
          disabled ? styles.disabledCard : null,
        ]}>
        <Text style={styles.presetPlainButtonText}>Назад к вариантам</Text>
      </Pressable>
    </View>
  );
}

function ManualPresetDraftCard({
  disabled,
  draft,
  onBack,
  onOpenEditor,
  onUse,
  plan,
  preset,
}: ManualPresetDraftCardProps) {
  return (
    <View style={styles.presetPreviewCard}>
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionTitle}>Ваш базовый план</Text>
        <Text style={styles.sectionCaption}>
          Стартуем от «{preset.title}». Изменения сохранятся как пользовательский план.
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          caption="ориентир утра"
          disabled={disabled}
          label="Подъем"
          onPress={() => onOpenEditor('wakeUp')}
          value={`${draft.wakeUpStart} - ${draft.wakeUpEnd}`}
        />
        <MetricCard
          caption={
            plan
              ? `Отбой ${formatClockRange(plan.bedtimeTargetMinutes, plan.bedtimeTargetMinutes)}`
              : 'отбой'
          }
          disabled={disabled}
          label="Бодрствование"
          onPress={() => onOpenEditor('awake')}
          value={
            plan
              ? formatDurationRange(plan.targetAwakeMinMinutes, plan.targetAwakeMaxMinutes)
              : `${draft.awakeStart} - ${draft.awakeEnd}`
          }
        />
        <MetricCard
          caption="в день"
          disabled={disabled}
          label="Дневных снов"
          onPress={() => onOpenEditor('napCount')}
          value={draft.napCount}
        />
        <MetricCard
          caption="суммарно"
          disabled={disabled}
          label="Дневной сон"
          onPress={() => onOpenEditor('daySleep')}
          value={
            plan
              ? formatDurationRange(plan.targetDaySleepMinMinutes, plan.targetDaySleepMaxMinutes)
              : `${draft.daySleepStart} - ${draft.daySleepEnd}`
          }
        />
      </View>

      {!plan ? <Text style={styles.presetErrorText}>Проверьте параметры плана</Text> : null}

      <View style={styles.presetActions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || !plan}
          onPress={onUse}
          style={({ pressed }) => [
            styles.presetPrimaryButton,
            pressed && !disabled && plan ? styles.guidelinePrimaryButtonPressed : null,
            disabled || !plan ? styles.disabledCard : null,
          ]}>
          <Text style={styles.presetPrimaryButtonText}>Сохранить как свой план</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onBack}
          style={({ pressed }) => [
            styles.presetSecondaryButton,
            pressed && !disabled ? styles.guidelineSecondaryButtonPressed : null,
            disabled ? styles.disabledCard : null,
          ]}>
          <Text style={styles.presetSecondaryButtonText}>Назад к вариантам</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BasePlanPresetFlow({
  agePresetCatalog,
  canClose,
  disabled,
  flowMode,
  hasBirthDate,
  manualAgeBandId,
  manualDraft,
  manualPlan,
  onBackToSelection,
  onClose,
  onOpenEditor,
  onOpenProfile,
  onSelectManualAgeBand,
  onSelectPreset,
  onStartManualEdit,
  onUseManualPlan,
  onUsePreset,
  selectedPreset,
}: BasePlanPresetFlowProps) {
  const presetOptions = getAgeSleepPlanPresetTemplateOptions(agePresetCatalog);
  const recommendedPreset = agePresetCatalog?.recommendedPreset ?? null;
  const sourceText = hasBirthDate
    ? agePresetCatalog?.ageMonths !== null && agePresetCatalog?.ageMonths !== undefined
      ? `Возраст из профиля: ${formatAgeMonthsLabel(agePresetCatalog.ageMonths)}`
      : 'Для этого возраста базовый шаблон пока не задан.'
    : 'Дата рождения не указана. Можно выбрать возраст вручную и не заполнять профиль сейчас.';

  return (
    <View style={styles.presetFlow}>
      <View style={styles.presetFlowHeader}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.presetFlowTitle}>
            {canClose ? 'Сменить шаблон' : 'Выберите базовый план'}
          </Text>
          <Text style={styles.sectionCaption}>{sourceText}</Text>
        </View>
        {canClose ? (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.presetCloseButton,
              pressed && !disabled ? styles.guidelineSecondaryButtonPressed : null,
              disabled ? styles.disabledCard : null,
            ]}>
            <Text style={styles.presetCloseButtonText}>Назад</Text>
          </Pressable>
        ) : null}
      </View>

      {!hasBirthDate ? (
        <View style={styles.presetBirthDateBlock}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.presetSecondaryButton,
              pressed && !disabled ? styles.guidelineSecondaryButtonPressed : null,
              disabled ? styles.disabledCard : null,
            ]}>
            <Text style={styles.presetSecondaryButtonText}>Указать дату рождения</Text>
          </Pressable>
          <View style={styles.ageBandSelector}>
            {AGE_SLEEP_PLAN_PRESET_TEMPLATE_BANDS.map((ageBand) => {
              const isSelected = manualAgeBandId === ageBand.id;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disabled={disabled}
                  key={ageBand.id}
                  onPress={() => onSelectManualAgeBand(ageBand.id)}
                  style={({ pressed }) => [
                    styles.ageBandChip,
                    isSelected ? styles.ageBandChipSelected : null,
                    pressed && !disabled ? styles.ageBandChipPressed : null,
                    disabled ? styles.disabledCard : null,
                  ]}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.ageBandChipText,
                      isSelected ? styles.ageBandChipTextSelected : null,
                    ]}>
                    {ageBand.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {flowMode === 'select' ? (
        <>
          {agePresetCatalog ? (
            <View style={styles.presetList}>
              {presetOptions.map((preset) => (
                <PresetTemplateCard
                  catalog={agePresetCatalog}
                  disabled={disabled}
                  key={preset.id}
                  onSelect={() => onSelectPreset(preset)}
                  preset={preset}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.presetEmptyText}>
              Выберите возрастную группу, чтобы увидеть мягкий стартовый план.
            </Text>
          )}

          {recommendedPreset ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onStartManualEdit(recommendedPreset)}
              style={({ pressed }) => [
                styles.presetPlainButton,
                pressed && !disabled ? styles.scientificEvidenceLinkPressed : null,
                disabled ? styles.disabledCard : null,
              ]}>
              <Text style={styles.presetPlainButtonText}>Настроить вручную</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {flowMode === 'preview' && selectedPreset ? (
        <PresetPreviewCard
          disabled={disabled}
          onBack={onBackToSelection}
          onEditDetails={() => onStartManualEdit(selectedPreset)}
          onUse={() => onUsePreset(selectedPreset)}
          preset={selectedPreset}
        />
      ) : null}

      {flowMode === 'manual' && selectedPreset ? (
        <ManualPresetDraftCard
          disabled={disabled}
          draft={manualDraft}
          onBack={onBackToSelection}
          onOpenEditor={onOpenEditor}
          onUse={onUseManualPlan}
          plan={manualPlan}
          preset={selectedPreset}
        />
      ) : null}
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
          <SelectAllTextInput
            keyboardType="number-pad"
            maxLength={5}
            normalizeText={normalizeTimeInput}
            onChangeText={onChangeStart}
            placeholder={startPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={styles.editorInput}
            underlineColorAndroid="transparent"
            value={startValue}
          />
        </View>
        <View style={styles.editorInputGroup}>
          <Text style={styles.compactLabel}>до</Text>
          <SelectAllTextInput
            keyboardType="number-pad"
            maxLength={5}
            normalizeText={normalizeTimeInput}
            onChangeText={onChangeEnd}
            placeholder={endPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
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
  const router = useRouter();
  const [plans, setPlans] = useState<TargetDayPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(() => createDraftFromPlan(DEFAULT_SLEEP_PLAN));
  const [activeEditor, setActiveEditor] = useState<EditorType | null>(null);
  const [nameEditorMode, setNameEditorMode] = useState<NameEditorMode | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState<string | null>(null);
  const [manualAgeBandId, setManualAgeBandId] =
    useState<AgeSleepPlanPresetTemplateAgeBandId | null>(null);
  const [isPresetFlowOpen, setIsPresetFlowOpen] = useState(false);
  const [presetFlowMode, setPresetFlowMode] = useState<PresetFlowMode>('select');
  const [selectedPresetForPreview, setSelectedPresetForPreview] =
    useState<AgeSleepPlanPresetTemplate | null>(null);
  const [draftBeforePresetFlow, setDraftBeforePresetFlow] = useState<PlanDraft | null>(null);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isNapDropdownOpen, setIsNapDropdownOpen] = useState(false);
  const [isEveningSettingsExpanded, setIsEveningSettingsExpanded] = useState(false);
  const [isChecksExpanded, setIsChecksExpanded] = useState(false);
  const [isWakeWindowsExpanded, setIsWakeWindowsExpanded] = useState(false);
  const [temporaryModes, setTemporaryModes] = useState<SleepDayTemporaryMode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemporaryModeSaving, setIsTemporaryModeSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      setIsLoading(true);

      try {
        const loadedPlans = await listTargetDayPlans(db);
        const profile = await getChildProfile(db);
        const planToSelect =
          loadedPlans.find((targetPlan) => targetPlan.isActive) ?? loadedPlans[0] ?? null;

        if (isMounted) {
          setChildBirthDate(profile.birthDate);
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
  const activePlan = useMemo(() => plans.find((plan) => plan.isActive) ?? null, [plans]);
  const isPresetFlowVisible = !activePlan || isPresetFlowOpen;
  const isPresetManualMode = isPresetFlowVisible && presetFlowMode === 'manual';
  const todaySleepDayKey = useMemo(
    () => (activePlan ? getSleepDayDateKeyForDate(new Date(), activePlan.plan) : null),
    [activePlan],
  );
  const activeTemporaryModes = useMemo(
    () => getActiveTemporaryModes(temporaryModes),
    [temporaryModes],
  );
  const isSoftDayEnabled = hasActiveTemporaryMode(temporaryModes, 'soft_day');
  const isEarlyWakeEnabled = hasActiveTemporaryMode(temporaryModes, 'early_wake');
  const effectiveTodayPlan = useMemo(
    () =>
      activePlan
        ? buildEffectiveSleepDayPlan(activePlan, activeTemporaryModes, {
            actualWakeTime: null,
          })
        : null,
    [activePlan, activeTemporaryModes],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTemporaryModesForToday() {
      if (!activePlan || !todaySleepDayKey) {
        setTemporaryModes([]);
        return;
      }

      try {
        const loadedTemporaryModes = await listSleepDayTemporaryModes(
          db,
          activePlan.childId,
          todaySleepDayKey,
        );

        if (isMounted) {
          setTemporaryModes(loadedTemporaryModes);
        }
      } catch {
        if (isMounted) {
          setTemporaryModes([]);
          setErrorMessage('Не удалось загрузить режимы на сегодня');
        }
      }
    }

    loadTemporaryModesForToday();

    return () => {
      isMounted = false;
    };
  }, [activePlan, db, todaySleepDayKey]);

  const childBirthDateValue = useMemo(
    () => parseBirthDateValue(childBirthDate),
    [childBirthDate],
  );
  const childAgeMonths = useMemo(
    () => (childBirthDateValue ? getAgeInCompletedMonths(childBirthDateValue, new Date()) : null),
    [childBirthDateValue],
  );
  const agePresetCatalog = useMemo(
    () =>
      getAgeSleepPlanPresetTemplateCatalogForProfile({
        birthDate: childBirthDateValue,
        manualAgeBandId,
        now: new Date(),
      }),
    [childBirthDateValue, manualAgeBandId],
  );
  const activePlanName = useMemo(
    () => activePlan?.name ?? DEFAULT_PLAN_NAME,
    [activePlan],
  );
  const parsedDraft = useMemo(() => parsePlanDraft(draft), [draft]);
  const draftNameError = useMemo(() => getDraftNameError(draft), [draft]);
  const practicalPreset = useMemo(
    () => agePresetCatalog?.practicalPreset ?? getPracticalSleepPresetByAgeMonths(childAgeMonths),
    [agePresetCatalog, childAgeMonths],
  );
  const practicalAgeMonths = childAgeMonths ?? agePresetCatalog?.ageBand.ageFromMonths ?? null;
  const checksUseActivePlanDraft = selectedPlan?.id === activePlan?.id;
  const hasActiveTemporaryModes = activeTemporaryModes.length > 0;
  const effectiveDraftPlanForChecks = useMemo(() => {
    if (!activePlan || !parsedDraft.plan || !checksUseActivePlanDraft || !hasActiveTemporaryModes) {
      return null;
    }

    return buildEffectiveSleepDayPlan(
      {
        ...activePlan,
        plan: parsedDraft.plan,
      },
      activeTemporaryModes,
      {
        actualWakeTime: null,
      },
    );
  }, [
    activePlan,
    activeTemporaryModes,
    checksUseActivePlanDraft,
    hasActiveTemporaryModes,
    parsedDraft.plan,
  ]);
  const planForChecks = effectiveDraftPlanForChecks?.plan ?? parsedDraft.plan;
  const planChecks = useMemo(
    () =>
      buildSleepPlanChecks({
        ageMonths: childAgeMonths,
        plan: planForChecks,
      }),
    [childAgeMonths, planForChecks],
  );
  const baseAwakeRangeForChecks =
    checksUseActivePlanDraft && hasActiveTemporaryModes
      ? getSleepPlanAwakeRange(parsedDraft.plan)
      : null;
  const todayAwakeRangeForChecks =
    checksUseActivePlanDraft && hasActiveTemporaryModes
      ? getSleepPlanAwakeRange(planForChecks)
      : null;
  const practicalNapCountStatus = useMemo(
    () =>
      getNapCountStatusForPracticalPreset({
        ageMonths: practicalAgeMonths,
        napCount: parsedDraft.plan?.napCount,
      }),
    [practicalAgeMonths, parsedDraft.plan?.napCount],
  );
  const bedtimeRange = useMemo(() => {
    if (!parsedDraft.plan) {
      return null;
    }

    return calculatePlanBedtimeRange(parsedDraft.plan);
  }, [parsedDraft.plan]);
  const bedtimeLabel = bedtimeRange
    ? formatClockRange(bedtimeRange.startMinutes, bedtimeRange.endMinutes)
    : '--:--';
  const eveningLatestNapEndLabel = parsedDraft.plan
    ? formatClockMinutes(parsedDraft.plan.latestEveningNapEndMinutes)
    : draft.latestEveningNapEnd;
  const eveningMaxNapLabel = parsedDraft.plan
    ? formatMinuteDurationOrOff(parsedDraft.plan.maxEveningNapMinutes)
    : `${draft.maxEveningNap} мин`;
  const eveningMicroNapLabel = parsedDraft.plan
    ? formatMinuteDurationOrOff(parsedDraft.plan.microNapMinutes)
    : `${draft.microNap} мин`;
  const hasPlanChanges =
    selectedPlan && parsedDraft.plan ? !arePlanFieldsEqual(parsedDraft.plan, selectedPlan.plan) : false;
  const hasEveningRulesModeChanges = selectedPlan
    ? draft.eveningRulesMode !== selectedPlan.eveningRulesMode
    : false;
  const hasNameChanges = selectedPlan ? draft.name.trim() !== selectedPlan.name : false;
  const hasChanges = hasPlanChanges || hasEveningRulesModeChanges || hasNameChanges;
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

  function updateEveningRulesMode(eveningRulesMode: EveningSleepRulesMode) {
    const nextDraftBase = {
      ...draft,
      eveningRulesMode,
    };
    const sourcePlan =
      eveningRulesMode === 'custom'
        ? parsedDraft.plan
        : parsePlanDraft(nextDraftBase).plan ?? parsedDraft.plan;

    setDraft({
      ...nextDraftBase,
      latestEveningNapEnd: sourcePlan
        ? formatClockMinutes(sourcePlan.latestEveningNapEndMinutes)
        : nextDraftBase.latestEveningNapEnd,
      maxEveningNap: sourcePlan
        ? String(sourcePlan.maxEveningNapMinutes)
        : nextDraftBase.maxEveningNap,
      microNap: sourcePlan ? String(sourcePlan.microNapMinutes) : nextDraftBase.microNap,
    });
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

  function openPresetSelectionFlow() {
    if (isSaving) {
      return;
    }

    setDraftBeforePresetFlow(draft);
    setIsPresetFlowOpen(true);
    setPresetFlowMode('select');
    setSelectedPresetForPreview(null);
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function closePresetSelectionFlow() {
    if (!activePlan || isSaving) {
      return;
    }

    if (draftBeforePresetFlow) {
      setDraft(draftBeforePresetFlow);
    }

    setIsPresetFlowOpen(false);
    setPresetFlowMode('select');
    setSelectedPresetForPreview(null);
    setDraftBeforePresetFlow(null);
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function backToPresetSelection() {
    if (draftBeforePresetFlow) {
      setDraft(draftBeforePresetFlow);
    } else {
      setDraft(createDraftFromPlan(DEFAULT_SLEEP_PLAN));
    }

    setPresetFlowMode('select');
    setSelectedPresetForPreview(null);
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function selectPresetForPreview(preset: AgeSleepPlanPresetTemplate) {
    if (isSaving) {
      return;
    }

    setSelectedPresetForPreview(preset);
    setPresetFlowMode('preview');
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  function startPresetManualEdit(preset: AgeSleepPlanPresetTemplate) {
    if (isSaving) {
      return;
    }

    if (!draftBeforePresetFlow && activePlan) {
      setDraftBeforePresetFlow(draft);
    }

    setSelectedPresetForPreview(preset);
    setPresetFlowMode('manual');
    setDraft(createDraftFromPlan(preset.plan, formatAgeSleepPlanPresetCustomPlanName(preset)));
    setActiveEditor(null);
    setNameEditorMode(null);
    setIsNapDropdownOpen(false);
    setErrorMessage(null);
  }

  async function createAndActivatePresetPlan(input: {
    name: string;
    plan: SleepPlanPreset;
  }): Promise<boolean> {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const createdPlan = await createTargetDayPlan(db, {
        eveningRulesMode: 'auto',
        name: input.name,
        plan: input.plan,
      });
      const activePresetPlan = await activateTargetDayPlan(db, createdPlan.id);
      const loadedPlans = sortPlansForDisplay(await listTargetDayPlans(db));

      setPlans(loadedPlans);
      setSelectedPlanId(activePresetPlan.id);
      setDraft(createDraftFromTargetPlan(activePresetPlan));
      setIsPresetFlowOpen(false);
      setPresetFlowMode('select');
      setSelectedPresetForPreview(null);
      setDraftBeforePresetFlow(null);
      setActiveEditor(null);
      setNameEditorMode(null);
      setIsNapDropdownOpen(false);

      try {
        await syncSleepNotificationsFromDatabase(db);
      } catch {
        // Notification sync is best-effort; plan selection should stay local and usable.
      }

      return true;
    } catch {
      setErrorMessage('Не удалось создать базовый план');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function usePresetTemplate(preset: AgeSleepPlanPresetTemplate) {
    if (isSaving) {
      return;
    }

    await createAndActivatePresetPlan({
      name: formatAgeSleepPlanPresetTargetPlanName(preset),
      plan: preset.plan,
    });
  }

  async function useManualPresetPlan() {
    if (!selectedPresetForPreview || isSaving) {
      return;
    }

    if (!parsedDraft.plan) {
      setErrorMessage(parsedDraft.errorMessage ?? 'Проверьте план сна');
      return;
    }

    await createAndActivatePresetPlan({
      name: formatAgeSleepPlanPresetCustomPlanName(selectedPresetForPreview),
      plan: parsedDraft.plan,
    });
  }

  async function reloadTodayTemporaryModes() {
    if (!activePlan || !todaySleepDayKey) {
      setTemporaryModes([]);
      return;
    }

    const loadedTemporaryModes = await listSleepDayTemporaryModes(
      db,
      activePlan.childId,
      todaySleepDayKey,
    );

    setTemporaryModes(loadedTemporaryModes);
  }

  async function updateTodayTemporaryMode(
    mode: SleepDayTemporaryModeType,
    shouldEnable: boolean,
  ) {
    if (!activePlan || !todaySleepDayKey || isTemporaryModeSaving) {
      return;
    }

    setIsTemporaryModeSaving(true);
    setErrorMessage(null);

    try {
      if (shouldEnable) {
        await enableSleepDayTemporaryMode(
          db,
          activePlan.childId,
          todaySleepDayKey,
          mode,
          activePlan.id,
        );
      } else {
        await disableSleepDayTemporaryMode(db, activePlan.childId, todaySleepDayKey, mode);
      }

      await reloadTodayTemporaryModes();

      try {
        await syncSleepNotificationsFromDatabase(db);
      } catch {
        // Notification sync is best-effort; plan editing should stay local and usable.
      }
    } catch {
      setErrorMessage(
        shouldEnable
          ? 'Не удалось включить режим на сегодня'
          : 'Не удалось выключить режим на сегодня',
      );
    } finally {
      setIsTemporaryModeSaving(false);
    }
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
        eveningRulesMode: nextDraft.eveningRulesMode,
        name: nextDraft.name.trim(),
        plan,
      });

      setPlans((currentPlans) => replacePlanInList(currentPlans, updatedPlan));
      setDraft(createDraftFromTargetPlan(updatedPlan));

      if (updatedPlan.isActive) {
        await syncSleepNotificationsFromDatabase(db);
      }

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
        eveningRulesMode: draft.eveningRulesMode,
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
      await syncSleepNotificationsFromDatabase(db);
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
      await syncSleepNotificationsFromDatabase(db);
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
    if (isPresetManualMode && activeEditor) {
      if (!parsedDraft.plan) {
        setErrorMessage(parsedDraft.errorMessage ?? 'Проверьте план сна');
        return;
      }

      closeEditorWithoutSaving();
      return;
    }

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

    if (isPresetManualMode) {
      closeEditorWithoutSaving();
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

    if (activeEditor === 'evening') {
      return (
        <View style={styles.editorBlock}>
          <Text style={styles.editorTitle}>Вечерние сны</Text>
          <Text style={styles.editorHelper}>
            Эти параметры не меняют записи сна. Они помогают рекомендациям понять, когда вечером
            ещё уместен короткий сон, а когда спокойнее вести к отбою.
          </Text>
          {draft.eveningRulesMode === 'auto' ? (
            <>
              <View style={styles.autoEveningSummary}>
                <Text style={styles.eveningRuleText}>Авто из текущего плана:</Text>
                <Text style={styles.eveningRuleText}>Микро-сон: {eveningMicroNapLabel}</Text>
                <Text style={styles.eveningRuleText}>
                  Последний вечерний сон: до {eveningLatestNapEndLabel}
                </Text>
                <Text style={styles.eveningRuleText}>
                  Короткий вечерний сон: до {eveningMaxNapLabel}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => updateEveningRulesMode('custom')}
                style={({ pressed }) => [
                  styles.eveningEditButton,
                  pressed ? styles.guidelineSecondaryButtonPressed : null,
                ]}>
                <Text style={styles.eveningEditButtonText}>Настроить вручную</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => updateEveningRulesMode('auto')}
                style={({ pressed }) => [
                  styles.eveningEditButton,
                  pressed ? styles.guidelineSecondaryButtonPressed : null,
                ]}>
                <Text style={styles.eveningEditButtonText}>Вернуть авто</Text>
              </Pressable>
              <View style={styles.editorInputRow}>
                <View style={styles.editorInputGroup}>
                  <Text style={styles.compactLabel}>микро-сон, мин</Text>
                  <SelectAllTextInput
                    keyboardType="number-pad"
                    maxLength={3}
                    normalizeText={normalizeMinuteInput}
                    onChangeText={(value) => updateDraft('microNap', value)}
                    placeholder="20"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    style={styles.editorInput}
                    underlineColorAndroid="transparent"
                    value={draft.microNap}
                  />
                </View>
                <View style={styles.editorInputGroup}>
                  <Text style={styles.compactLabel}>сон до, мин</Text>
                  <SelectAllTextInput
                    keyboardType="number-pad"
                    maxLength={3}
                    normalizeText={normalizeMinuteInput}
                    onChangeText={(value) => updateDraft('maxEveningNap', value)}
                    placeholder="45"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    style={styles.editorInput}
                    underlineColorAndroid="transparent"
                    value={draft.maxEveningNap}
                  />
                </View>
              </View>
              <View style={styles.editorInputGroup}>
                <Text style={styles.compactLabel}>не позже</Text>
                <SelectAllTextInput
                  keyboardType="number-pad"
                  maxLength={5}
                  normalizeText={normalizeTimeInput}
                  onChangeText={(value) => updateDraft('latestEveningNapEnd', value)}
                  placeholder="2000"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.editorInput}
                  underlineColorAndroid="transparent"
                  value={draft.latestEveningNapEnd}
                />
              </View>
            </>
          )}
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push(EVENING_SLEEP_INFO_ROUTE)}
            style={({ pressed }) => [
              styles.eveningInfoLink,
              pressed ? styles.scientificEvidenceLinkPressed : null,
            ]}>
            <Text style={styles.eveningInfoLinkText}>Открыть объяснение в справке</Text>
          </Pressable>
        </View>
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
        <SelectAllTextInput
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

          {isPresetFlowVisible ? (
            <BasePlanPresetFlow
              agePresetCatalog={agePresetCatalog}
              canClose={activePlan !== null}
              disabled={isLoading || isSaving}
              flowMode={presetFlowMode}
              hasBirthDate={childBirthDateValue !== null}
              manualAgeBandId={manualAgeBandId}
              manualDraft={draft}
              manualPlan={parsedDraft.plan}
              onBackToSelection={backToPresetSelection}
              onClose={closePresetSelectionFlow}
              onOpenEditor={openEditor}
              onOpenProfile={() => router.push(PROFILE_ROUTE)}
              onSelectManualAgeBand={setManualAgeBandId}
              onSelectPreset={selectPresetForPreview}
              onStartManualEdit={startPresetManualEdit}
              onUseManualPlan={() => {
                void useManualPresetPlan();
              }}
              onUsePreset={(preset) => {
                void usePresetTemplate(preset);
              }}
              selectedPreset={selectedPresetForPreview}
            />
          ) : activePlan ? (
            <>
              <ActivePlanSummaryCard plan={activePlan} />
              <Pressable
                accessibilityRole="button"
                disabled={isLoading || isSaving}
                onPress={openPresetSelectionFlow}
                style={({ pressed }) => [
                  styles.changeTemplateButton,
                  pressed && !isLoading && !isSaving ? styles.guidelineSecondaryButtonPressed : null,
                  isLoading || isSaving ? styles.disabledCard : null,
                ]}>
                <Text style={styles.changeTemplateButtonText}>Сменить шаблон</Text>
              </Pressable>
              <TodayModesSection
                disabled={isLoading || isSaving || isTemporaryModeSaving}
                isEarlyWakeEnabled={isEarlyWakeEnabled}
                isSoftDayEnabled={isSoftDayEnabled}
                onDisableMode={(mode) => {
                  void updateTodayTemporaryMode(mode, false);
                }}
                onEnableMode={(mode) => {
                  void updateTodayTemporaryMode(mode, true);
                }}
              />
              {effectiveTodayPlan ? (
                <TodayPlanSection
                  isWakeWindowsExpanded={isWakeWindowsExpanded}
                  onToggleWakeWindows={() =>
                    setIsWakeWindowsExpanded((isExpanded) => !isExpanded)
                  }
                  plan={effectiveTodayPlan.plan}
                />
              ) : null}
            </>
          ) : null}

          {!isPresetFlowVisible ? (
            <>
              <PlanChecksSection
                baseAwakeRange={baseAwakeRangeForChecks}
                checks={planChecks}
                isExpanded={isChecksExpanded}
                onOpenOfficialInfo={() => router.push(OFFICIAL_SLEEP_INFO_ROUTE)}
                onOpenPracticalInfo={() => router.push(PRACTICAL_SLEEP_INFO_ROUTE)}
                onOpenWakeWindowInfo={() => router.push(WAKE_WINDOW_INFO_ROUTE)}
                onToggle={() => setIsChecksExpanded((isExpanded) => !isExpanded)}
                todayAwakeRange={todayAwakeRangeForChecks}
              />

              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <View style={styles.planSectionTitleBlock}>
                    <Text style={styles.sectionTitle}>Управлять планами</Text>
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
                        ageMonths={childAgeMonths}
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

                {selectedPlan?.isActive ? null : (
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

            <View style={[styles.hero, !selectedPlan?.isActive ? styles.heroCompact : null]}>
              <View style={styles.heroIcon}>
                <SleepPlanIcon backgroundColor={colors.primarySoft} />
              </View>
              <View style={styles.heroTextBlock}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroTitle}>
                  {draft.name.trim() || 'План дня'}
                </Text>
                {selectedPlan?.isActive ? (
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroText}>
                    Основной план
                  </Text>
                ) : null}
              </View>
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
                caption={getPracticalNapCountCaption(practicalNapCountStatus.status) ?? 'в день'}
                disabled={isEditingDisabled}
                label="Дневных снов"
                onPress={() => openEditor('napCount')}
                value={draft.napCount}
              />
              <MetricCard
                caption={getPracticalDaySleepCaption(practicalPreset)}
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

            <EveningSettingsCard
              disabled={isEditingDisabled}
              eveningRulesMode={draft.eveningRulesMode}
              isExpanded={isEveningSettingsExpanded}
              latestNapEndLabel={eveningLatestNapEndLabel}
              maxNapLabel={eveningMaxNapLabel}
              microNapLabel={eveningMicroNapLabel}
              onOpenInfo={() => router.push(EVENING_SLEEP_INFO_ROUTE)}
              onPress={() => openEditor('evening')}
              onToggle={() => setIsEveningSettingsExpanded((isExpanded) => !isExpanded)}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isPlanDeleteDisabled}
              onPress={requestDeleteSelectedPlan}
              style={({ pressed }) => [
                styles.deletePlanButton,
                pressed && !isPlanDeleteDisabled ? styles.deletePlanButtonPressed : null,
                isPlanDeleteDisabled ? styles.disabledCard : null,
              ]}>
              <Text style={styles.deletePlanButtonText}>Удалить выбранный план</Text>
            </Pressable>
          </View>
            </>
          ) : null}

        </SafeAreaView>
      </ScrollView>

      <Modal
        animationType="slide"
        navigationBarTranslucent
        onRequestClose={handleEditorRequestClose}
        statusBarTranslucent
        transparent
        visible={isEditorModalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}>
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
              <ScrollView
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}>
                {renderEditorContent()}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={closeEditorWithoutSaving}
        statusBarTranslucent
        transparent
        visible={nameEditorMode !== null}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}>
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
        statusBarTranslucent
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
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  presetFlow: {
    gap: spacing.md,
  },
  presetFlowHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  presetFlowTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  presetCloseButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  presetCloseButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  presetBirthDateBlock: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  presetList: {
    gap: spacing.md,
  },
  presetTemplateCard: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  presetTemplateCardRecommended: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  presetTemplateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetTemplateTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  presetTemplateMeaning: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  presetTemplateFacts: {
    gap: spacing.xs,
  },
  presetTemplateFact: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  presetWhyBlock: {
    gap: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  presetWhyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  presetWhyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  presetPrimaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  presetPrimaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  presetSecondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  presetSecondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  presetPlainButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  presetPlainButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  presetPreviewCard: {
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  presetPreviewList: {
    gap: spacing.xs,
  },
  presetPreviewRow: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  presetActions: {
    gap: spacing.sm,
  },
  presetEmptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  presetErrorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  changeTemplateButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  changeTemplateButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  activeSummaryCard: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  activeSummaryHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeSummaryTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  activeSummaryTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  activeSummaryMeta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  activeSummaryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  summaryPill: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  summaryPillActive: {
    backgroundColor: colors.primarySoft,
  },
  summaryPillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  summaryPillActiveText: {
    color: colors.primary,
  },
  activeSummaryHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sectionTitleBlock: {
    gap: spacing.xs,
  },
  sectionCaption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  todayAdjustedBanner: {
    gap: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  todayAdjustedTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  todayAdjustedText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  temporaryModeList: {
    gap: spacing.sm,
  },
  temporaryModeCard: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  temporaryModeTextBlock: {
    gap: 4,
  },
  temporaryModeTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  temporaryModeDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  temporaryModeEnabledText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  temporaryModePrimaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  temporaryModePrimaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  temporaryModeSecondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  temporaryModeSecondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  todayPlanList: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  todayPlanPointRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  todayPlanPointTime: {
    width: 56,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  todayPlanPointTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  todayPlanPointTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  todayPlanPointCaption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  wakeWindowsToggleButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  wakeWindowsToggleButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  wakeWindowList: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wakeWindowRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wakeWindowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  wakeWindowRange: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  planChecksPanel: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  planCheckStatusList: {
    gap: spacing.xs,
  },
  planCheckStatusRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planCheckStatusLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  planCheckStatusBadge: {
    maxWidth: '52%',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft,
  },
  planCheckStatusBadgeWarning: {
    backgroundColor: colors.warningSoft,
  },
  planCheckStatusBadgeMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  planCheckStatusText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  planCheckStatusTextWarning: {
    color: colors.warning,
  },
  planCheckStatusTextMuted: {
    color: colors.textMuted,
  },
  checksToggleButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  checksToggleButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  checksContent: {
    gap: spacing.sm,
  },
  planCheckDetailBlock: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  planCheckDetailHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planCheckDetailTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  planCheckDetailTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  planCheckDetailLevel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  planCheckDetailBody: {
    gap: spacing.xs,
  },
  planCheckDetailLine: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planCheckDetailLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  planCheckDetailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  planCheckDetailNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
    width: 172,
    minHeight: 132,
    justifyContent: 'space-between',
    gap: spacing.sm,
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
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  activeBadgeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  planCardSleepBlock: {
    gap: 2,
  },
  planCardLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  planCardSleepValue: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  planCardFooter: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  planCardChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.surfaceMuted,
  },
  planCardChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  compactGuidelineBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  compactGuidelineBadgeWarning: {
    backgroundColor: colors.warningSoft,
  },
  compactGuidelineBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  compactGuidelineBadgeTextWarning: {
    color: colors.warning,
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
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySoft,
  },
  heroCompact: {
    minHeight: 52,
  },
  heroIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  heroTextBlock: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  editNameButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editNameButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  editNameIcon: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 15,
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
  eveningPanel: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  eveningToggle: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eveningCardTextBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  eveningCardValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  eveningCardArrow: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  eveningExpandedBody: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  eveningExplanation: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  eveningRuleList: {
    gap: spacing.xs,
  },
  autoEveningSummary: {
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  eveningRuleText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  eveningActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eveningEditButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  eveningEditButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  eveningInfoLink: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  eveningInfoLinkText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  guidelineInfoButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  guidelineInfoButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  guidelineInfoButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
  },
  ageBandSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  ageBandChip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  ageBandChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  ageBandChipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  ageBandChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  ageBandChipTextSelected: {
    color: colors.primary,
  },
  recommendedBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.primarySoft,
  },
  recommendedBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  guidelinePrimaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  guidelineSecondaryButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  scientificEvidenceLinkPressed: {
    opacity: 0.72,
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
    maxHeight: '92%',
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
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
