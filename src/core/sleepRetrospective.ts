import type {
  SleepDaySummary,
  SleepDayTemporaryMode,
  SleepDayTemporaryModeType,
} from '@/types/sleep';

export type SleepRetrospectiveStatus = 'empty' | 'onTrack' | 'shifted' | 'stronglyShifted';

type RetrospectiveReason =
  | 'earlyBedtime'
  | 'lateBedtime'
  | 'lessAwake'
  | 'longDaySleep'
  | 'moreAwake'
  | 'napCount'
  | 'shortDaySleep';

export interface SleepRetrospectiveDayInput {
  date: Date;
  summary: SleepDaySummary;
  temporaryModes?: SleepDayTemporaryMode[];
}

export interface SleepRetrospectiveDay {
  awakeDeltaMinutes: number;
  bedtimeAt: Date | null;
  completedNaps: number;
  date: Date;
  hasRecords: boolean;
  hint: string;
  reason: RetrospectiveReason | null;
  status: SleepRetrospectiveStatus;
  statusLabel: string;
  napCountDelta: number;
  temporaryModeBadges: SleepRetrospectiveTemporaryModeBadge[];
  targetBedtimeDeltaMinutes: number | null;
  targetDaySleepDeltaMinutes: number;
  totalAwakeMinutes: number;
  totalDaySleepMinutes: number;
  totalNightSleepMinutes: number;
  wakeUpAt: Date | null;
}

export type SleepRetrospectiveTemporaryModeBadgeLabel = 'Мягкий день' | 'Ранний подъём';

export interface SleepRetrospectiveTemporaryModeBadge {
  label: SleepRetrospectiveTemporaryModeBadgeLabel;
  mode: SleepDayTemporaryModeType;
}

export interface SleepRetrospectivePeriodSummary {
  detailLine: string;
  periodLabel: string;
  primaryLine: string;
  quietLine: string;
}

export interface SleepRetrospectiveMetricCard {
  detail: string;
  label: string;
  value: string;
}

export interface SleepRetrospectiveSleepTrendPoint {
  date: Date;
  hasRecords: boolean;
  totalDaySleepMinutes: number;
  totalNightSleepMinutes: number;
  totalSleepMinutes: number;
}

export interface SleepRetrospectiveAwakeTrendPoint {
  awakeDeltaMinutes: number;
  date: Date;
  hasRecords: boolean;
  status: SleepRetrospectiveStatus;
}

export interface SleepRetrospectivePeriodStats {
  averageAwakeMinutes: number | null;
  averageDaySleepMinutes: number | null;
  averageNapsPerDay: number | null;
  averageNightSleepMinutes: number | null;
  averageTotalSleepMinutes: number | null;
  averageWakeWindowMinutes: number | null;
  awakeTrend: SleepRetrospectiveAwakeTrendPoint[];
  detailLine: string;
  headline: string;
  metricCards: SleepRetrospectiveMetricCard[];
  periodLabel: string;
  recordedDays: number;
  sleepTrend: SleepRetrospectiveSleepTrendPoint[];
}

const SHIFT_TOLERANCE_MINUTES = 30;
const STRONG_SHIFT_MINUTES = 90;

function formatDayCount(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? 'день'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'дня'
        : 'дней';

  return `${value} ${suffix}`;
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatAverageCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(1).replace('.', ',');
}

function formatShiftedDayLine(value: number, reason: string): string {
  return `${formatDayCount(value)} ${value === 1 ? 'сдвинулся' : 'сдвинулись'} из-за ${reason}.`;
}

function isOffPlan(deltaMinutes: number): boolean {
  return Math.abs(deltaMinutes) > SHIFT_TOLERANCE_MINUTES;
}

function getBedtimeDelta(summary: SleepDaySummary): number {
  return summary.targetBedtimeDeltaMinutes ?? 0;
}

function countNoticeableShifts(summary: SleepDaySummary): number {
  let count = 0;

  if (isOffPlan(summary.targetAwakeDeltaMinutes)) {
    count += 1;
  }

  if (isOffPlan(summary.targetDaySleepDeltaMinutes)) {
    count += 1;
  }

  if (summary.targetBedtimeDeltaMinutes !== null && isOffPlan(summary.targetBedtimeDeltaMinutes)) {
    count += 1;
  }

  if (summary.napCountDelta !== 0) {
    count += 1;
  }

  return count;
}

function getStatus(summary: SleepDaySummary): SleepRetrospectiveStatus {
  if (summary.sleepSessionCount === 0) {
    return 'empty';
  }

  const biggestShiftMinutes = Math.max(
    Math.abs(summary.targetAwakeDeltaMinutes),
    Math.abs(summary.targetDaySleepDeltaMinutes),
    Math.abs(getBedtimeDelta(summary)),
  );

  if (biggestShiftMinutes > STRONG_SHIFT_MINUTES || countNoticeableShifts(summary) >= 2) {
    return 'stronglyShifted';
  }

  if (countNoticeableShifts(summary) > 0) {
    return 'shifted';
  }

  return 'onTrack';
}

function getStatusLabel(status: SleepRetrospectiveStatus): string {
  switch (status) {
    case 'empty':
      return 'Нет записей';
    case 'onTrack':
      return 'Близко к плану';
    case 'shifted':
      return 'Немного сдвинулся';
    case 'stronglyShifted':
      return 'Сильно сдвинулся';
  }
}

function getPrimaryReason(summary: SleepDaySummary): RetrospectiveReason | null {
  const bedtimeDeltaMinutes = summary.targetBedtimeDeltaMinutes;
  const candidates: { reason: RetrospectiveReason; weight: number }[] = [
    {
      reason: summary.targetDaySleepDeltaMinutes < 0 ? 'shortDaySleep' : 'longDaySleep',
      weight: Math.abs(summary.targetDaySleepDeltaMinutes),
    },
    {
      reason: summary.targetAwakeDeltaMinutes > 0 ? 'moreAwake' : 'lessAwake',
      weight: Math.abs(summary.targetAwakeDeltaMinutes),
    },
    {
      reason:
        bedtimeDeltaMinutes !== null && bedtimeDeltaMinutes < 0 ? 'earlyBedtime' : 'lateBedtime',
      weight: bedtimeDeltaMinutes === null ? 0 : Math.abs(bedtimeDeltaMinutes),
    },
    {
      reason: 'napCount',
      weight: summary.napCountDelta === 0 ? 0 : SHIFT_TOLERANCE_MINUTES + 1,
    },
  ];

  const noticeableCandidates = candidates
    .filter((candidate) => candidate.weight > SHIFT_TOLERANCE_MINUTES)
    .sort((first, second) => second.weight - first.weight);

  return noticeableCandidates[0]?.reason ?? null;
}

function buildHint(
  status: SleepRetrospectiveStatus,
  reason: RetrospectiveReason | null,
  temporaryModeContext: { hasEarlyWake: boolean; hasSoftDay: boolean },
): string {
  if (status === 'empty') {
    return 'Нет записей за день. Можно открыть день и добавить сон.';
  }

  if (temporaryModeContext.hasSoftDay && temporaryModeContext.hasEarlyWake) {
    return 'День был мягче обычного после раннего подъёма. Можно вернуться к основному плану.';
  }

  if (temporaryModeContext.hasSoftDay) {
    return 'День был мягче обычного после сложной ночи. Можно вернуться к основному плану.';
  }

  if (temporaryModeContext.hasEarlyWake) {
    return 'День начался раньше обычного, поэтому первый сон был сдвинут мягче.';
  }

  if (status === 'onTrack') {
    return 'День ровный. Можно держать обычный план.';
  }

  switch (reason) {
    case 'shortDaySleep':
      return 'Дневного сна было меньше. В похожий день лучше не тянуть первый сон.';
    case 'longDaySleep':
      return 'Дневного сна было больше. Можно мягко держать привычный отбой.';
    case 'moreAwake':
      return 'Бодрствования было больше. В следующий раз лучше не затягивать окна.';
    case 'lessAwake':
      return 'Бодрствования было меньше. Можно спокойно вернуться к обычному плану.';
    case 'lateBedtime':
      return 'Отбой ушёл позже. В похожий день поможет более ранний вечер.';
    case 'earlyBedtime':
      return 'Отбой был раньше. Это может быть нормальным после сложного дня.';
    case 'napCount':
      return 'Количество снов отличалось от плана. Смотрите по длине следующего дня.';
    case null:
      return 'День немного отличался от плана. Главное - общий спокойный ритм.';
  }
}

function getReasonSummary(reason: RetrospectiveReason): string {
  switch (reason) {
    case 'shortDaySleep':
      return 'короткого дневного сна';
    case 'longDaySleep':
      return 'длинного дневного сна';
    case 'moreAwake':
      return 'лишнего бодрствования';
    case 'lessAwake':
      return 'меньшего бодрствования';
    case 'lateBedtime':
      return 'позднего отбоя';
    case 'earlyBedtime':
      return 'раннего отбоя';
    case 'napCount':
      return 'другого количества снов';
  }
}

function hasActiveTemporaryMode(
  temporaryModes: SleepDayTemporaryMode[],
  mode: SleepDayTemporaryModeType,
): boolean {
  return temporaryModes.some(
    (temporaryMode) => temporaryMode.mode === mode && temporaryMode.disabledAt === null,
  );
}

export function getSleepRetrospectiveTemporaryModeBadges(
  temporaryModes: SleepDayTemporaryMode[] = [],
): SleepRetrospectiveTemporaryModeBadge[] {
  const badges: SleepRetrospectiveTemporaryModeBadge[] = [];

  if (hasActiveTemporaryMode(temporaryModes, 'soft_day')) {
    badges.push({ label: 'Мягкий день', mode: 'soft_day' });
  }

  if (hasActiveTemporaryMode(temporaryModes, 'early_wake')) {
    badges.push({ label: 'Ранний подъём', mode: 'early_wake' });
  }

  return badges;
}

function getTopReason(days: SleepRetrospectiveDay[]): RetrospectiveReason | null {
  const counts = new Map<RetrospectiveReason, number>();

  days.forEach((day) => {
    if (day.reason && day.status !== 'onTrack') {
      counts.set(day.reason, (counts.get(day.reason) ?? 0) + 1);
    }
  });

  return [...counts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;
}

export function buildSleepRetrospectiveDay(
  input: SleepRetrospectiveDayInput,
): SleepRetrospectiveDay {
  const status = getStatus(input.summary);
  const reason = status === 'empty' || status === 'onTrack' ? null : getPrimaryReason(input.summary);
  const temporaryModeBadges = getSleepRetrospectiveTemporaryModeBadges(input.temporaryModes);
  const hasSoftDay = temporaryModeBadges.some((badge) => badge.mode === 'soft_day');
  const hasEarlyWake = temporaryModeBadges.some((badge) => badge.mode === 'early_wake');

  return {
    awakeDeltaMinutes: input.summary.targetAwakeDeltaMinutes,
    bedtimeAt: input.summary.bedtimeAt,
    completedNaps: input.summary.completedNaps,
    date: input.date,
    hasRecords: input.summary.sleepSessionCount > 0,
    hint: buildHint(status, reason, { hasEarlyWake, hasSoftDay }),
    napCountDelta: input.summary.napCountDelta,
    reason,
    status,
    statusLabel: getStatusLabel(status),
    targetBedtimeDeltaMinutes: input.summary.targetBedtimeDeltaMinutes,
    targetDaySleepDeltaMinutes: input.summary.targetDaySleepDeltaMinutes,
    temporaryModeBadges,
    totalAwakeMinutes: input.summary.totalAwakeMinutes,
    totalDaySleepMinutes: input.summary.totalDaySleepMinutes,
    totalNightSleepMinutes: input.summary.totalNightSleepMinutes,
    wakeUpAt: input.summary.wakeUpAt,
  };
}

export function buildSleepRetrospectivePeriodSummary(
  days: SleepRetrospectiveDay[],
  periodDays: number,
): SleepRetrospectivePeriodSummary {
  const daysWithRecords = days.filter((day) => day.hasRecords);
  const onTrackCount = daysWithRecords.filter((day) => day.status === 'onTrack').length;
  const shiftedDays = daysWithRecords.filter(
    (day) => day.status === 'shifted' || day.status === 'stronglyShifted',
  );
  const strongCount = shiftedDays.filter((day) => day.status === 'stronglyShifted').length;
  const topReason = getTopReason(shiftedDays);

  if (daysWithRecords.length === 0) {
    return {
      detailLine: 'Добавьте несколько дней сна, чтобы увидеть картину режима.',
      periodLabel: `За ${periodDays} дней`,
      primaryLine: 'Пока нет завершённых дней с записями',
      quietLine: 'История сна появится без дополнительных настроек.',
    };
  }

  return {
    detailLine:
      shiftedDays.length === 0
        ? 'Заметных сдвигов по режиму не видно.'
        : formatShiftedDayLine(
            shiftedDays.length,
            topReason ? getReasonSummary(topReason) : 'отклонения от плана',
          ),
    periodLabel: `За ${periodDays} дней`,
    primaryLine: `${formatDayCount(onTrackCount)} близко к плану`,
    quietLine:
      shiftedDays.length === 0
        ? 'Режим выглядит ровно. Можно держать текущий ориентир.'
        : strongCount > 0
          ? 'Главное - смотреть на повторяющиеся дни, а не на один сложный вечер.'
          : 'Один неровный день не ломает режим. Важнее повторяющийся рисунок.',
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getAverageNapsPerDay(days: SleepRetrospectiveDay[]): number | null {
  if (days.length === 0) {
    return null;
  }

  return days.reduce((total, day) => total + day.completedNaps, 0) / days.length;
}

function getApproximateWakeWindowMinutes(day: SleepRetrospectiveDay): number {
  const hasEveningWindow = day.bedtimeAt !== null;
  const wakeWindowCount = Math.max(1, day.completedNaps + (hasEveningWindow ? 1 : 0));

  return Math.round(day.totalAwakeMinutes / wakeWindowCount);
}

function buildMetricCards(input: {
  averageAwakeMinutes: number | null;
  averageDaySleepMinutes: number | null;
  averageNapsPerDay: number | null;
  averageNightSleepMinutes: number | null;
  averageTotalSleepMinutes: number | null;
  averageWakeWindowMinutes: number | null;
}): SleepRetrospectiveMetricCard[] {
  if (
    input.averageAwakeMinutes === null ||
    input.averageDaySleepMinutes === null ||
    input.averageNapsPerDay === null ||
    input.averageNightSleepMinutes === null ||
    input.averageTotalSleepMinutes === null ||
    input.averageWakeWindowMinutes === null
  ) {
    return [
      { detail: 'после записей', label: 'Сон за сутки', value: '--' },
      { detail: 'днём', label: 'Дневной сон', value: '--' },
      { detail: 'ночью', label: 'Ночной сон', value: '--' },
      { detail: 'примерно', label: 'Среднее ВБ', value: '--' },
    ];
  }

  return [
    {
      detail: 'в среднем',
      label: 'Сон за сутки',
      value: formatDuration(input.averageTotalSleepMinutes),
    },
    {
      detail: `${formatAverageCount(input.averageNapsPerDay)} сна/день`,
      label: 'Дневной сон',
      value: formatDuration(input.averageDaySleepMinutes),
    },
    {
      detail: 'в среднем',
      label: 'Ночной сон',
      value: formatDuration(input.averageNightSleepMinutes),
    },
    {
      detail: `бодрств. ${formatDuration(input.averageAwakeMinutes)}`,
      label: 'Среднее ВБ',
      value: formatDuration(input.averageWakeWindowMinutes),
    },
  ];
}

export function buildSleepRetrospectivePeriodStats(
  days: SleepRetrospectiveDay[],
  periodDays: number,
): SleepRetrospectivePeriodStats {
  const daysWithRecords = days.filter((day) => day.hasRecords);
  const chronologicalDays = [...days].sort(
    (first, second) => first.date.getTime() - second.date.getTime(),
  );
  const averageDaySleepMinutes = average(
    daysWithRecords.map((day) => day.totalDaySleepMinutes),
  );
  const averageNightSleepMinutes = average(
    daysWithRecords.map((day) => day.totalNightSleepMinutes),
  );
  const averageTotalSleepMinutes = average(
    daysWithRecords.map((day) => day.totalDaySleepMinutes + day.totalNightSleepMinutes),
  );
  const averageAwakeMinutes = average(daysWithRecords.map((day) => day.totalAwakeMinutes));
  const averageWakeWindowMinutes = average(
    daysWithRecords.map(getApproximateWakeWindowMinutes),
  );
  const averageNapsPerDay = getAverageNapsPerDay(daysWithRecords);
  const periodLabel = `За ${periodDays} дней`;
  const metricCards = buildMetricCards({
    averageAwakeMinutes,
    averageDaySleepMinutes,
    averageNapsPerDay,
    averageNightSleepMinutes,
    averageTotalSleepMinutes,
    averageWakeWindowMinutes,
  });

  return {
    averageAwakeMinutes,
    averageDaySleepMinutes,
    averageNapsPerDay,
    averageNightSleepMinutes,
    averageTotalSleepMinutes,
    averageWakeWindowMinutes,
    awakeTrend: chronologicalDays.map((day) => ({
      awakeDeltaMinutes: day.awakeDeltaMinutes,
      date: day.date,
      hasRecords: day.hasRecords,
      status: day.status,
    })),
    detailLine:
      daysWithRecords.length === 0
        ? 'Сводка появится после нескольких записанных дней.'
        : `Есть данные за ${formatDayCount(daysWithRecords.length)} из ${periodDays}.`,
    headline:
      averageTotalSleepMinutes === null
        ? 'Пока мало данных'
        : `В среднем ${formatDuration(averageTotalSleepMinutes)} сна за сутки`,
    metricCards,
    periodLabel,
    recordedDays: daysWithRecords.length,
    sleepTrend: chronologicalDays.map((day) => ({
      date: day.date,
      hasRecords: day.hasRecords,
      totalDaySleepMinutes: day.totalDaySleepMinutes,
      totalNightSleepMinutes: day.totalNightSleepMinutes,
      totalSleepMinutes: day.totalDaySleepMinutes + day.totalNightSleepMinutes,
    })),
  };
}
