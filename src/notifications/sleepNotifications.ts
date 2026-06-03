import type { SQLiteDatabase } from 'expo-sqlite';

import { syncActiveSleepNotificationFromDatabase } from '@/notifications/activeSleepNotification';
import { syncBottleFeedingReminderNotificationFromDatabase } from '@/notifications/bottleFeedingReminderNotification';
import { syncSleepReminderNotificationFromDatabase } from '@/notifications/sleepReminderNotification';

export interface SleepNotificationSyncOptions {
  showOverdueBottleFeedingReminder?: boolean;
}

export async function syncSleepNotificationsFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
  options: SleepNotificationSyncOptions = {},
) {
  await syncActiveSleepNotificationFromDatabase(db, now);
  await syncSleepReminderNotificationFromDatabase(db, now);
  await syncBottleFeedingReminderNotificationFromDatabase(db, now, {
    showOverdueReminder: options.showOverdueBottleFeedingReminder,
  });
}
