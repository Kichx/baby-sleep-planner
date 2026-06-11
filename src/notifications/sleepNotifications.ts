import type { SQLiteDatabase } from 'expo-sqlite';

import { getOnboardingState } from '@/db';
import {
  hideActiveSleepNotification,
  syncActiveSleepNotificationFromDatabase,
} from '@/notifications/activeSleepNotification';
import {
  hideBottleFeedingReminderNotification,
  resetBottleFeedingReminderNotificationRuntimeState,
  syncBottleFeedingReminderNotificationFromDatabase,
} from '@/notifications/bottleFeedingReminderNotification';
import {
  loadExpoNotificationsModule,
  resetExpoNotificationRuntimeState,
} from '@/notifications/expoNotifications';
import {
  hideSleepReminderNotification,
  syncSleepReminderNotificationFromDatabase,
} from '@/notifications/sleepReminderNotification';
import { refreshSleepWidgetInBackground } from '@/widgets/sleepWidget';

export interface SleepNotificationSyncOptions {
  showOverdueBottleFeedingReminder?: boolean;
}

export async function syncSleepNotificationsFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
  options: SleepNotificationSyncOptions = {},
) {
  const onboardingState = await getOnboardingState(db).catch(() => null);
  refreshSleepWidgetInBackground();

  if (onboardingState !== 'plan_saved') {
    return;
  }

  await syncActiveSleepNotificationFromDatabase(db, now);
  await syncSleepReminderNotificationFromDatabase(db, now);
  await syncBottleFeedingReminderNotificationFromDatabase(db, now, {
    showOverdueReminder: options.showOverdueBottleFeedingReminder,
  });
}

export async function cancelAllLocalSleepNotifications(): Promise<void> {
  resetBottleFeedingReminderNotificationRuntimeState();
  resetExpoNotificationRuntimeState();
  refreshSleepWidgetInBackground();

  await Promise.allSettled([
    hideActiveSleepNotification(),
    hideSleepReminderNotification(),
    hideBottleFeedingReminderNotification(),
  ]);

  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return;
  }

  await Promise.allSettled([
    Notifications.cancelAllScheduledNotificationsAsync(),
    Notifications.dismissAllNotificationsAsync(),
  ]);
}
