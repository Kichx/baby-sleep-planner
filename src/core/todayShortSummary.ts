import { formatBottleFeedingElapsed } from '@/core/bottleFeeding';
import {
  addMinutes,
  getWakeWindowForNextNap,
  minutesBetween,
} from '@/core/sleepCalculations';
import { formatLocalClock } from '@/core/localDateTime';
import type { BottleFeeding } from '@/types/bottleFeeding';
import type { SleepDaySummary, SleepPlanPreset, SleepSnapshot } from '@/types/sleep';

export type TodayShortSummaryRowId =
  | 'activeSleepNextWindow'
  | 'bedtime'
  | 'daySleep'
  | 'feeding'
  | 'nextSleep';

export type TodayShortSummaryRowTone = 'primary' | 'secondary';

export type TodayShortSummaryRowVm = {
  id: TodayShortSummaryRowId;
  text: string;
  tone: TodayShortSummaryRowTone;
};

export type TodayShortSummaryVm = {
  visible: boolean;
  title: string;
  rows: TodayShortSummaryRowVm[];
  hasDetails: boolean;
  detailsLabel: string;
};

type TodayShortSummarySourceViewState = {
  hasActiveTargetPlan: boolean;
  isTodaySelected: boolean;
  isTrackingOnlyWithoutPlan: boolean;
  showPlanBasedPredictions: boolean;
  showPlanStartNoDataHint: boolean;
};

export type BuildTodayShortSummaryVmInput = {
  bottleFeedingEnabled: boolean;
  daySummary: SleepDaySummary | null;
  hasDetails: boolean;
  latestBottleFeeding: Pick<BottleFeeding, 'startedAt'> | null;
  now: Date;
  plan: SleepPlanPreset | null;
  snapshot: SleepSnapshot | null;
  viewState: TodayShortSummarySourceViewState;
};

const TITLE = 'Сегодня коротко';
const DETAILS_LABEL = 'Подробнее';
const ACTIVE_SLEEP_NEXT_WINDOW_TEXT = 'После пробуждения покажем следующее окно';

const HIDDEN_TODAY_SHORT_SUMMARY_VM: TodayShortSummaryVm = {
  visible: false,
  title: TITLE,
  rows: [],
  hasDetails: false,
  detailsLabel: DETAILS_LABEL,
};

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

function formatDuration(minutes: number): string | null {
  if (!isValidFiniteNumber(minutes)) {
    return null;
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const restMinutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function normalizeLine(line: string | null | undefined): string | null {
  const trimmedLine = line?.trim();

  if (!trimmedLine || /undefined|null|NaN/.test(trimmedLine)) {
    return null;
  }

  return trimmedLine;
}

function canShowPlanRows(
  input: Pick<BuildTodayShortSummaryVmInput, 'plan' | 'snapshot' | 'viewState'>,
): input is BuildTodayShortSummaryVmInput & {
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
} {
  return (
    input.viewState.isTodaySelected &&
    input.viewState.hasActiveTargetPlan &&
    !input.viewState.isTrackingOnlyWithoutPlan &&
    !input.viewState.showPlanStartNoDataHint &&
    input.viewState.showPlanBasedPredictions &&
    input.plan !== null &&
    input.snapshot !== null
  );
}

function formatNextSleepWaitRange(input: {
  now: Date;
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
}): string | null {
  if (
    input.snapshot.state !== 'awake' ||
    input.snapshot.nextSleepKind === 'night' ||
    !isValidDate(input.now) ||
    !isValidDate(input.snapshot.statusStartedAt) ||
    !isValidFiniteNumber(input.snapshot.completedNaps)
  ) {
    return null;
  }

  const completedNaps = Math.max(0, Math.round(input.snapshot.completedNaps));
  const wakeWindow = getWakeWindowForNextNap(completedNaps, input.plan);

  if (
    !wakeWindow ||
    !isValidFiniteNumber(wakeWindow.minWakeMinutes) ||
    !isValidFiniteNumber(wakeWindow.maxWakeMinutes)
  ) {
    return null;
  }

  const startAt = addMinutes(input.snapshot.statusStartedAt, wakeWindow.minWakeMinutes);
  const endAt = addMinutes(input.snapshot.statusStartedAt, wakeWindow.maxWakeMinutes);

  if (!isValidDate(startAt) || !isValidDate(endAt) || endAt.getTime() < startAt.getTime()) {
    return null;
  }

  const minMinutes = minutesBetween(input.now, startAt);
  const maxMinutes = Math.max(minMinutes, minutesBetween(input.now, endAt));

  if (maxMinutes <= 0) {
    return 'уже пора';
  }

  if (minMinutes <= 0) {
    return `примерно в ближайшие ${maxMinutes} мин`;
  }

  if (minMinutes === maxMinutes) {
    return `примерно через ${minMinutes} мин`;
  }

  return `примерно через ${minMinutes}–${maxMinutes} мин`;
}

function buildNextSleepRow(input: {
  now: Date;
  plan: SleepPlanPreset;
  snapshot: SleepSnapshot;
}): TodayShortSummaryRowVm | null {
  const waitLabel = formatNextSleepWaitRange(input);
  const text = normalizeLine(waitLabel ? `Следующий сон: ${waitLabel}` : null);

  return text ? { id: 'nextSleep', text, tone: 'primary' } : null;
}

function buildActiveSleepNextWindowRow(
  snapshot: SleepSnapshot,
): TodayShortSummaryRowVm | null {
  if (snapshot.state !== 'sleeping') {
    return null;
  }

  return {
    id: 'activeSleepNextWindow',
    text: ACTIVE_SLEEP_NEXT_WINDOW_TEXT,
    tone: 'primary',
  };
}

function buildBedtimeRow(snapshot: SleepSnapshot): TodayShortSummaryRowVm | null {
  if (!isValidDate(snapshot.predictedBedtimeAt)) {
    return null;
  }

  return {
    id: 'bedtime',
    text: `Отбой: около ${formatLocalClock(snapshot.predictedBedtimeAt)}`,
    tone: 'primary',
  };
}

function buildDaySleepRow(
  daySummary: SleepDaySummary | null,
): TodayShortSummaryRowVm | null {
  if (
    !daySummary ||
    !isValidFiniteNumber(daySummary.sleepSessionCount) ||
    daySummary.sleepSessionCount <= 0 ||
    !isValidFiniteNumber(daySummary.totalDaySleepMinutes)
  ) {
    return null;
  }

  const duration = formatDuration(daySummary.totalDaySleepMinutes);
  const text = normalizeLine(duration ? `Дневной сон: ${duration}` : null);

  return text ? { id: 'daySleep', text, tone: 'primary' } : null;
}

function buildFeedingRow(input: {
  bottleFeedingEnabled: boolean;
  latestBottleFeeding: Pick<BottleFeeding, 'startedAt'> | null;
  now: Date;
}): TodayShortSummaryRowVm | null {
  if (!input.bottleFeedingEnabled || !input.latestBottleFeeding || !isValidDate(input.now)) {
    return null;
  }

  const startedAt = new Date(input.latestBottleFeeding.startedAt);

  if (!isValidDate(startedAt)) {
    return null;
  }

  const text = normalizeLine(`Кормление: ${formatBottleFeedingElapsed(startedAt, input.now)}`);

  return text ? { id: 'feeding', text, tone: 'secondary' } : null;
}

function compactRows(
  rows: Array<TodayShortSummaryRowVm | null>,
): TodayShortSummaryRowVm[] {
  return rows.filter((row): row is TodayShortSummaryRowVm => row !== null);
}

export function buildTodayShortSummaryVm(
  input: BuildTodayShortSummaryVmInput,
): TodayShortSummaryVm {
  if (!input.viewState.isTodaySelected) {
    return HIDDEN_TODAY_SHORT_SUMMARY_VM;
  }

  const planRows = canShowPlanRows(input)
    ? compactRows([
        buildNextSleepRow({
          now: input.now,
          plan: input.plan,
          snapshot: input.snapshot,
        }),
        buildActiveSleepNextWindowRow(input.snapshot),
        buildBedtimeRow(input.snapshot),
      ])
    : [];
  const rows = compactRows([
    ...planRows,
    buildDaySleepRow(input.daySummary),
    buildFeedingRow({
      bottleFeedingEnabled: input.bottleFeedingEnabled,
      latestBottleFeeding: input.latestBottleFeeding,
      now: input.now,
    }),
  ]);

  if (rows.length === 0) {
    return HIDDEN_TODAY_SHORT_SUMMARY_VM;
  }

  return {
    visible: true,
    title: TITLE,
    rows,
    hasDetails: input.hasDetails,
    detailsLabel: DETAILS_LABEL,
  };
}
