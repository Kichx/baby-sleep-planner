import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import {
  buildBottleFeedingReminder,
  buildBottleFeedingReminderSuppressionState,
  EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
  resolveSuppressedBottleFeedingReminder,
  shouldSuppressBottleFeedingReminderPresentation,
  type BottleFeedingReminderDecision,
  type BottleFeedingReminderPlannerState,
} from '@/core/bottleFeedingReminders';
import {
  getActiveSleepSession,
  getChildProfile,
  getLatestBottleFeeding,
  getOnboardingState,
} from '@/db';
import {
  ensureExpoNotificationHandlerConfigured,
  hasNotificationPermission,
  loadExpoNotificationsModule,
  setBottleFeedingReminderPresentationSuppressionHandler,
  type NotificationsModule,
} from '@/notifications/expoNotifications';

const BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID = 'bottle-feeding-reminder';
const BOTTLE_FEEDING_REMINDER_CHANNEL_ID = 'bottle-feeding-reminders';

let isBottleFeedingReminderChannelConfigured = false;
let isBottleFeedingReminderPresentationGuardConfigured = false;
let bottleFeedingReminderPlannerState: BottleFeedingReminderPlannerState = {
  ...EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
};
let latestPresentationContext = {
  isSleeping: false,
  notifyDuringSleep: true,
};

function parseNotificationDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function clearBottleFeedingReminderSuppressionState(): void {
  bottleFeedingReminderPlannerState = {
    ...EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
  };
}

export function resetBottleFeedingReminderNotificationRuntimeState(): void {
  clearBottleFeedingReminderSuppressionState();
  latestPresentationContext = {
    isSleeping: false,
    notifyDuringSleep: true,
  };
}

function configureBottleFeedingReminderPresentationGuard(): void {
  if (isBottleFeedingReminderPresentationGuardConfigured) {
    return;
  }

  setBottleFeedingReminderPresentationSuppressionHandler((notification) => {
    const scheduledReminderAt = parseNotificationDate(
      notification.request.content.data?.triggerAt,
    );

    if (!scheduledReminderAt) {
      return false;
    }

    const shouldSuppress = shouldSuppressBottleFeedingReminderPresentation({
      isSleeping: latestPresentationContext.isSleeping,
      notifyDuringSleep: latestPresentationContext.notifyDuringSleep,
      scheduledReminderAt,
    });

    if (shouldSuppress) {
      bottleFeedingReminderPlannerState =
        buildBottleFeedingReminderSuppressionState(scheduledReminderAt);
    }

    return shouldSuppress;
  });

  isBottleFeedingReminderPresentationGuardConfigured = true;
}

async function ensureBottleFeedingReminderNotificationsReady(): Promise<NotificationsModule | null> {
  const Notifications = await ensureExpoNotificationHandlerConfigured();

  if (!Notifications) {
    return null;
  }

  configureBottleFeedingReminderPresentationGuard();

  if (Platform.OS !== 'android' || isBottleFeedingReminderChannelConfigured) {
    return Notifications;
  }

  await Notifications.setNotificationChannelAsync(BOTTLE_FEEDING_REMINDER_CHANNEL_ID, {
    description: 'Мягко напоминает о кормлении бутылочкой.',
    enableLights: false,
    enableVibrate: false,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: 'Кормление бутылочкой',
    showBadge: false,
    sound: null,
  });

  isBottleFeedingReminderChannelConfigured = true;

  return Notifications;
}

async function cancelBottleFeedingReminder(Notifications: NotificationsModule): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(
    BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID,
  ).catch(() => undefined);
  await Notifications.dismissNotificationAsync(BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID).catch(
    () => undefined,
  );
}

async function scheduleBottleFeedingReminder(
  Notifications: NotificationsModule,
  reminder: BottleFeedingReminderDecision,
  now: Date,
): Promise<void> {
  const trigger =
    reminder.kind === 'showNow'
      ? null
      : {
          channelId: BOTTLE_FEEDING_REMINDER_CHANNEL_ID,
          seconds: Math.max(
            1,
            Math.round((reminder.triggerAt.getTime() - now.getTime()) / 1_000),
          ),
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        };

  await Notifications.scheduleNotificationAsync({
    content: {
      body: reminder.body,
      color: colors.primary,
      data: {
        feedingId: reminder.latestFeedingId,
        feedingStartedAt: reminder.latestFeedingStartedAt.toISOString(),
        intervalMinutes: reminder.intervalMinutes,
        suppressedDueToSleep: reminder.suppressedDueToSleep,
        triggerAt: reminder.triggerAt.toISOString(),
        type: 'bottleFeedingReminder',
        volumeMl: reminder.volumeMl,
      },
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      sound: false,
      title: reminder.title,
    },
    identifier: BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID,
    trigger,
  });
}

export async function hideBottleFeedingReminderNotification() {
  clearBottleFeedingReminderSuppressionState();

  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    await cancelBottleFeedingReminder(Notifications);
  } catch {
    // Reminder cleanup should never block local data changes.
  }
}

export async function syncBottleFeedingReminderNotificationFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
  options: {
    showOverdueReminder?: boolean;
  } = {},
) {
  try {
    const onboardingState = await getOnboardingState(db);

    if (onboardingState !== 'plan_saved') {
      return;
    }

    const [profile, latestFeeding, activeSleepSession] = await Promise.all([
      getChildProfile(db),
      getLatestBottleFeeding(db),
      getActiveSleepSession(db),
    ]);
    const isSleeping = activeSleepSession !== null;
    const settings = {
      bottleFeedingEnabled: profile.bottleFeedingEnabled,
      notifyDuringSleep: profile.bottleFeedingNotifyDuringSleep,
      reminderIntervalMinutes: profile.bottleFeedingReminderIntervalMinutes,
      remindersEnabled: profile.bottleFeedingRemindersEnabled,
    };

    latestPresentationContext = {
      isSleeping,
      notifyDuringSleep: settings.notifyDuringSleep,
    };

    const Notifications = await ensureBottleFeedingReminderNotificationsReady();

    if (!Notifications) {
      if (!settings.bottleFeedingEnabled || !settings.remindersEnabled) {
        clearBottleFeedingReminderSuppressionState();
      }

      return;
    }

    await cancelBottleFeedingReminder(Notifications);

    const suppressedResolution = resolveSuppressedBottleFeedingReminder({
      isSleeping,
      latestFeeding,
      now,
      settings,
      state: bottleFeedingReminderPlannerState,
    });

    bottleFeedingReminderPlannerState = suppressedResolution.state;

    if (suppressedResolution.kind === 'keepSuppressed') {
      return;
    }

    if (suppressedResolution.kind === 'showSuppressedNow') {
      if (await hasNotificationPermission(Notifications)) {
        await scheduleBottleFeedingReminder(
          Notifications,
          suppressedResolution.reminder,
          now,
        );
      }

      return;
    }

    const reminder = buildBottleFeedingReminder({
      allowOverdue: options.showOverdueReminder === true,
      isSleeping,
      latestFeeding,
      now,
      settings,
    });

    if (!reminder) {
      if (!settings.bottleFeedingEnabled || !settings.remindersEnabled) {
        clearBottleFeedingReminderSuppressionState();
      }

      return;
    }

    if (reminder.kind === 'suppressUntilWake') {
      bottleFeedingReminderPlannerState = buildBottleFeedingReminderSuppressionState(
        reminder.triggerAt,
      );
      return;
    }

    clearBottleFeedingReminderSuppressionState();

    if (!(await hasNotificationPermission(Notifications))) {
      return;
    }

    await scheduleBottleFeedingReminder(Notifications, reminder, now);
  } catch {
    // Notification state should never block local sleep or feeding logging.
  }
}
