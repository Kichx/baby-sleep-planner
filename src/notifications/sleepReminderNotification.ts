import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { buildNextSleepReminder } from '@/core/sleepReminders';
import { addMinutes, buildTodaySleepSnapshot, getDayStart } from '@/core/sleepCalculations';
import { getOnboardingState, getTargetDayPlan, listSleepSessionsInRange } from '@/db';
import {
  ensureExpoNotificationHandlerConfigured,
  hasNotificationPermission,
  loadExpoNotificationsModule,
  type NotificationsModule,
} from '@/notifications/expoNotifications';

const SLEEP_REMINDER_NOTIFICATION_ID = 'sleep-reminder-next';
const SLEEP_REMINDER_CHANNEL_ID = 'sleep-reminders';
const SLEEP_DAY_LOOKBACK_MINUTES = 24 * 60;
const SLEEP_DAY_MINUTES = 24 * 60;

let isReminderChannelConfigured = false;

async function ensureSleepReminderNotificationsReady(): Promise<NotificationsModule | null> {
  const Notifications = await ensureExpoNotificationHandlerConfigured();

  if (!Notifications) {
    return null;
  }

  if (Platform.OS !== 'android' || isReminderChannelConfigured) {
    return Notifications;
  }

  await Notifications.setNotificationChannelAsync(SLEEP_REMINDER_CHANNEL_ID, {
    description: 'Мягко напоминает о ближайшем дневном сне или отбое.',
    enableLights: false,
    enableVibrate: false,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: 'Напоминания о сне',
    showBadge: false,
    sound: null,
  });

  isReminderChannelConfigured = true;

  return Notifications;
}

async function cancelSleepReminder(Notifications: NotificationsModule): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(SLEEP_REMINDER_NOTIFICATION_ID);
  await Notifications.dismissNotificationAsync(SLEEP_REMINDER_NOTIFICATION_ID);
}

export async function hideSleepReminderNotification() {
  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    await cancelSleepReminder(Notifications);
  } catch {
    // Reminder state should never block sleep logging.
  }
}

export async function syncSleepReminderNotificationFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
) {
  try {
    const onboardingState = await getOnboardingState(db);

    if (onboardingState !== 'plan_saved') {
      return;
    }

    const Notifications = await ensureSleepReminderNotificationsReady();

    if (!Notifications) {
      return;
    }

    const plan = await getTargetDayPlan(db);
    const dayStart = getDayStart(now, plan);
    const dayEnd = addMinutes(dayStart, SLEEP_DAY_MINUTES);
    const sessions = await listSleepSessionsInRange(
      db,
      addMinutes(dayStart, -SLEEP_DAY_LOOKBACK_MINUTES),
      dayEnd,
    );
    const snapshot = buildTodaySleepSnapshot(sessions, now, plan);
    const reminder = buildNextSleepReminder({
      nextSleepAt: snapshot.nextSleepAt,
      nextSleepKind: snapshot.nextSleepKind,
      now,
      state: snapshot.state,
    });

    await cancelSleepReminder(Notifications);

    if (!reminder || !(await hasNotificationPermission(Notifications))) {
      return;
    }

    const secondsUntilTrigger = Math.max(
      1,
      Math.round((reminder.triggerAt.getTime() - now.getTime()) / 1_000),
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        body: reminder.body,
        color: colors.primary,
        data: {
          sleepAt: reminder.sleepAt.toISOString(),
          triggerAt: reminder.triggerAt.toISOString(),
          type: 'sleepReminder',
          variant: reminder.kind === 'night' ? 'bedtime' : 'nap',
        },
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        sound: false,
        title: reminder.title,
      },
      identifier: SLEEP_REMINDER_NOTIFICATION_ID,
      trigger: {
        channelId: SLEEP_REMINDER_CHANNEL_ID,
        seconds: secondsUntilTrigger,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  } catch {
    // Notification state should never block sleep logging.
  }
}
