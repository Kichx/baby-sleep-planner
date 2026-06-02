import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { buildBottleFeedingReminder } from '@/core/bottleFeedingReminders';
import { getActiveSleepSession, getChildProfile, getLatestBottleFeeding } from '@/db';
import {
  ensureExpoNotificationHandlerConfigured,
  hasNotificationPermission,
  loadExpoNotificationsModule,
  type NotificationsModule,
} from '@/notifications/expoNotifications';

const BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID = 'bottle-feeding-reminder';
const BOTTLE_FEEDING_REMINDER_CHANNEL_ID = 'bottle-feeding-reminders';

let isBottleFeedingReminderChannelConfigured = false;
let suppressedBottleFeedingReminderAt: string | null = null;

async function ensureBottleFeedingReminderNotificationsReady(): Promise<NotificationsModule | null> {
  const Notifications = await ensureExpoNotificationHandlerConfigured();

  if (!Notifications) {
    return null;
  }

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
  await Notifications.cancelScheduledNotificationAsync(BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID);
  await Notifications.dismissNotificationAsync(BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID);
}

export async function hideBottleFeedingReminderNotification() {
  suppressedBottleFeedingReminderAt = null;

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
) {
  try {
    const Notifications = await ensureBottleFeedingReminderNotificationsReady();

    if (!Notifications) {
      return;
    }

    const [profile, latestFeeding, activeSleepSession] = await Promise.all([
      getChildProfile(db),
      getLatestBottleFeeding(db),
      getActiveSleepSession(db),
    ]);
    const reminder = buildBottleFeedingReminder({
      isSleeping: activeSleepSession !== null,
      latestFeeding,
      now,
      settings: {
        bottleFeedingEnabled: profile.bottleFeedingEnabled,
        notifyDuringSleep: profile.bottleFeedingNotifyDuringSleep,
        reminderIntervalMinutes: profile.bottleFeedingReminderIntervalMinutes,
        remindersEnabled: profile.bottleFeedingRemindersEnabled,
      },
    });

    await cancelBottleFeedingReminder(Notifications);

    if (!reminder) {
      suppressedBottleFeedingReminderAt = null;
      return;
    }

    if (reminder.kind === 'suppressUntilWake') {
      suppressedBottleFeedingReminderAt = reminder.triggerAt.toISOString();
      return;
    }

    suppressedBottleFeedingReminderAt = null;

    if (!(await hasNotificationPermission(Notifications))) {
      return;
    }

    const secondsUntilTrigger = Math.max(
      1,
      Math.round((reminder.triggerAt.getTime() - now.getTime()) / 1_000),
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        body: 'Прошло больше выбранного времени с последнего кормления.',
        color: colors.primary,
        data: {
          suppressedAt: suppressedBottleFeedingReminderAt,
          triggerAt: reminder.triggerAt.toISOString(),
          type: 'bottleFeedingReminder',
        },
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        sound: false,
        title: 'Напоминание о кормлении',
      },
      identifier: BOTTLE_FEEDING_REMINDER_NOTIFICATION_ID,
      trigger: {
        channelId: BOTTLE_FEEDING_REMINDER_CHANNEL_ID,
        seconds: secondsUntilTrigger,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  } catch {
    // Notification state should never block local sleep or feeding logging.
  }
}
