import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS,
  configureActiveSleepNotificationHandler,
  syncActiveSleepNotificationFromDatabase,
} from '@/notifications/activeSleepNotification';

export function ActiveSleepNotificationSync() {
  const db = useSQLiteContext();

  const syncNotification = useCallback(() => {
    void syncActiveSleepNotificationFromDatabase(db);
  }, [db]);

  useEffect(() => {
    configureActiveSleepNotificationHandler();
    syncNotification();

    const timer = setInterval(syncNotification, ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNotification();
      }
    });

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [syncNotification]);

  return null;
}
