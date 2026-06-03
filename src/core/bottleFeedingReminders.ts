import type { BottleFeeding } from '@/types/bottleFeeding';
import { formatBottleFeedingReminderBody } from '@/core/bottleFeeding';

export interface BottleFeedingReminderSettings {
  bottleFeedingEnabled: boolean;
  remindersEnabled: boolean;
  reminderIntervalMinutes: number;
  notifyDuringSleep: boolean;
}

export interface BottleFeedingReminderPlannerState {
  suppressedDueToSleep: boolean;
  suppressedReminderAt: Date | null;
}

export interface BottleFeedingReminderDecision {
  triggerAt: Date;
  kind: 'schedule' | 'showNow' | 'suppressUntilWake';
  suppressedDueToSleep: boolean;
  title: string;
  body: string;
  latestFeedingId: string;
  latestFeedingStartedAt: Date;
  intervalMinutes: number;
  volumeMl: number;
}

export type BottleFeedingSuppressedReminderResolution =
  | {
      kind: 'none' | 'keepSuppressed' | 'clearSuppressed';
      state: BottleFeedingReminderPlannerState;
    }
  | {
      kind: 'showSuppressedNow';
      reminder: BottleFeedingReminderDecision;
      state: BottleFeedingReminderPlannerState;
    };

export const EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE: BottleFeedingReminderPlannerState = {
  suppressedDueToSleep: false,
  suppressedReminderAt: null,
};

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

function formatReminderInterval(minutes: number): string {
  const wholeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(wholeMinutes / 60);
  const restMinutes = wholeMinutes % 60;

  if (hours === 0) {
    return formatCount(restMinutes, 'минута', 'минуты', 'минут');
  }

  const hoursText = formatCount(hours, 'час', 'часа', 'часов');

  if (restMinutes === 0) {
    return hoursText;
  }

  return `${hoursText} ${formatCount(restMinutes, 'минута', 'минуты', 'минут')}`;
}

function getValidLatestFeedingStartedAt(latestFeeding: BottleFeeding): Date | null {
  const latestFeedingStartedAt = new Date(latestFeeding.startedAt);

  return Number.isNaN(latestFeedingStartedAt.getTime()) ? null : latestFeedingStartedAt;
}

function areBottleFeedingReminderSettingsEnabled(
  settings: BottleFeedingReminderSettings,
): boolean {
  return (
    settings.bottleFeedingEnabled &&
    settings.remindersEnabled &&
    Number.isInteger(settings.reminderIntervalMinutes) &&
    settings.reminderIntervalMinutes > 0
  );
}

function buildBottleFeedingReminderDetails(params: {
  kind: BottleFeedingReminderDecision['kind'];
  latestFeeding: BottleFeeding;
  latestFeedingStartedAt: Date;
  reminderIntervalMinutes: number;
  suppressedDueToSleep?: boolean;
  triggerAt: Date;
}): BottleFeedingReminderDecision {
  const intervalText = formatReminderInterval(params.reminderIntervalMinutes);

  return {
    body: formatBottleFeedingReminderBody(params.latestFeeding),
    intervalMinutes: params.reminderIntervalMinutes,
    kind: params.kind,
    latestFeedingId: params.latestFeeding.id,
    latestFeedingStartedAt: params.latestFeedingStartedAt,
    suppressedDueToSleep: params.suppressedDueToSleep ?? false,
    title: `Прошло ${intervalText} с последнего кормления`,
    triggerAt: params.triggerAt,
    volumeMl: params.latestFeeding.volumeMl,
  };
}

export function buildBottleFeedingReminderSuppressionState(
  suppressedReminderAt: Date,
): BottleFeedingReminderPlannerState {
  if (Number.isNaN(suppressedReminderAt.getTime())) {
    return EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE;
  }

  return {
    suppressedDueToSleep: true,
    suppressedReminderAt,
  };
}

export function shouldSuppressBottleFeedingReminderPresentation(params: {
  isSleeping: boolean;
  notifyDuringSleep: boolean;
  scheduledReminderAt: Date;
}): boolean {
  return (
    params.isSleeping &&
    !params.notifyDuringSleep &&
    !Number.isNaN(params.scheduledReminderAt.getTime())
  );
}

export function resolveSuppressedBottleFeedingReminder(params: {
  latestFeeding: BottleFeeding | null;
  now: Date;
  settings: BottleFeedingReminderSettings;
  state: BottleFeedingReminderPlannerState;
  isSleeping: boolean;
}): BottleFeedingSuppressedReminderResolution {
  const { latestFeeding, now, settings, state, isSleeping } = params;

  if (!state.suppressedDueToSleep || !state.suppressedReminderAt) {
    return {
      kind: 'none',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    };
  }

  if (
    Number.isNaN(state.suppressedReminderAt.getTime()) ||
    Number.isNaN(now.getTime()) ||
    !areBottleFeedingReminderSettingsEnabled(settings) ||
    settings.notifyDuringSleep ||
    !latestFeeding
  ) {
    return {
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    };
  }

  const latestFeedingStartedAt = getValidLatestFeedingStartedAt(latestFeeding);

  if (!latestFeedingStartedAt) {
    return {
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    };
  }

  if (latestFeedingStartedAt.getTime() > state.suppressedReminderAt.getTime()) {
    return {
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    };
  }

  if (isSleeping) {
    return {
      kind: 'keepSuppressed',
      state,
    };
  }

  if (state.suppressedReminderAt.getTime() > now.getTime()) {
    return {
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    };
  }

  return {
    kind: 'showSuppressedNow',
    reminder: buildBottleFeedingReminderDetails({
      kind: 'showNow',
      latestFeeding,
      latestFeedingStartedAt,
      reminderIntervalMinutes: settings.reminderIntervalMinutes,
      suppressedDueToSleep: true,
      triggerAt: state.suppressedReminderAt,
    }),
    state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
  };
}

export function buildBottleFeedingReminder(params: {
  latestFeeding: BottleFeeding | null;
  now: Date;
  settings: BottleFeedingReminderSettings;
  isSleeping: boolean;
  allowOverdue?: boolean;
}): BottleFeedingReminderDecision | null {
  const { latestFeeding, now, settings, isSleeping, allowOverdue = false } = params;

  if (
    !areBottleFeedingReminderSettingsEnabled(settings) ||
    !latestFeeding ||
    Number.isNaN(now.getTime())
  ) {
    return null;
  }

  const latestFeedingStartedAt = getValidLatestFeedingStartedAt(latestFeeding);

  if (!latestFeedingStartedAt) {
    return null;
  }

  const triggerAt = new Date(
    latestFeedingStartedAt.getTime() + settings.reminderIntervalMinutes * 60_000,
  );

  if (Number.isNaN(triggerAt.getTime())) {
    return null;
  }

  if (isSleeping && !settings.notifyDuringSleep) {
    return buildBottleFeedingReminderDetails({
      kind: 'suppressUntilWake',
      latestFeeding,
      latestFeedingStartedAt,
      reminderIntervalMinutes: settings.reminderIntervalMinutes,
      triggerAt,
    });
  }

  if (triggerAt.getTime() < now.getTime()) {
    if (allowOverdue) {
      return buildBottleFeedingReminderDetails({
        kind: 'showNow',
        latestFeeding,
        latestFeedingStartedAt,
        reminderIntervalMinutes: settings.reminderIntervalMinutes,
        triggerAt,
      });
    }

    return null;
  }

  return buildBottleFeedingReminderDetails({
    kind: 'schedule',
    latestFeeding,
    latestFeedingStartedAt,
    reminderIntervalMinutes: settings.reminderIntervalMinutes,
    triggerAt,
  });
}
