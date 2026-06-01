import type { SQLiteDatabase } from 'expo-sqlite';

import { syncActiveSleepNotificationFromDatabase } from '@/notifications/activeSleepNotification';
import { syncSleepReminderNotificationFromDatabase } from '@/notifications/sleepReminderNotification';

export async function syncSleepNotificationsFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
) {
  await syncActiveSleepNotificationFromDatabase(db, now);
  await syncSleepReminderNotificationFromDatabase(db, now);
}

