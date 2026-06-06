import type { SQLiteDatabase } from 'expo-sqlite';

import { getOnboardingState } from '@/db';
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
  const onboardingState = await getOnboardingState(db).catch(() => null);

  if (onboardingState !== 'plan_saved') {
    return;
  }

  await syncActiveSleepNotificationFromDatabase(db, now);
  await syncSleepReminderNotificationFromDatabase(db, now);
  await syncBottleFeedingReminderNotificationFromDatabase(db, now, {
    showOverdueReminder: options.showOverdueBottleFeedingReminder,
  });
}
