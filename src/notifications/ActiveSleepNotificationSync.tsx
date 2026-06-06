import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { getOnboardingState } from '@/db';
import {
  ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS,
  configureActiveSleepNotificationHandler,
  syncActiveSleepNotificationFromDatabase,
} from '@/notifications/activeSleepNotification';
import { syncSleepNotificationsFromDatabase } from '@/notifications/sleepNotifications';

export function ActiveSleepNotificationSync() {
  const db = useSQLiteContext();

  const syncNotification = useCallback(() => {
    void syncSleepNotificationsFromDatabase(db);
  }, [db]);

  const configureNotificationHandler = useCallback(() => {
    void getOnboardingState(db)
      .then((onboardingState) => {
        if (onboardingState === 'plan_saved') {
          configureActiveSleepNotificationHandler();
        }
      })
      .catch(() => undefined);
  }, [db]);

  const refreshActiveSleepNotification = useCallback(() => {
    void syncActiveSleepNotificationFromDatabase(db);
  }, [db]);

  useEffect(() => {
    configureNotificationHandler();
    syncNotification();

    const timer = setInterval(
      refreshActiveSleepNotification,
      ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS,
    );
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNotification();
      }
    });

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [configureNotificationHandler, refreshActiveSleepNotification, syncNotification]);

  return null;
}
