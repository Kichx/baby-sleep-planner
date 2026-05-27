import Constants, { AppOwnership } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { getActiveSleepSession } from '@/db';
import type { SleepSession } from '@/types/sleep';

export const ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS = 60_000;

const ACTIVE_SLEEP_NOTIFICATION_ID = 'active-sleep-notification';
const ACTIVE_SLEEP_NOTIFICATION_CHANNEL_ID = 'active-sleep';

type NotificationsModule = typeof ExpoNotifications;

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let isNotificationHandlerConfigured = false;
let isAndroidChannelConfigured = false;
let didRequestPermissions = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === AppOwnership.Expo;
}

function canUseNativeNotifications(): boolean {
  return Platform.OS === 'android' && !isExpoGo();
}

function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUseNativeNotifications()) {
    return Promise.resolve(null);
  }

  notificationsModulePromise ??= import('expo-notifications').catch(() => null);

  return notificationsModulePromise;
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function getActiveSleepDurationMinutes(startedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
}

async function ensureNotificationsReady(): Promise<NotificationsModule | null> {
  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return null;
  }

  if (!isNotificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        priority: Notifications.AndroidNotificationPriority.LOW,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: true,
      }),
    });

    isNotificationHandlerConfigured = true;
  }

  if (isAndroidChannelConfigured) {
    return Notifications;
  }

  await Notifications.setNotificationChannelAsync(ACTIVE_SLEEP_NOTIFICATION_CHANNEL_ID, {
    description: 'Показывает активный сон и текущую длительность.',
    enableLights: false,
    enableVibrate: false,
    importance: Notifications.AndroidImportance.LOW,
    name: 'Идущий сон',
    showBadge: false,
    sound: null,
  });

  isAndroidChannelConfigured = true;

  return Notifications;
}

export function configureActiveSleepNotificationHandler() {
  if (!canUseNativeNotifications() || isNotificationHandlerConfigured) {
    return;
  }

  void ensureNotificationsReady();
}

async function getPermittedNotificationsModule(): Promise<NotificationsModule | null> {
  const Notifications = await ensureNotificationsReady();

  if (!Notifications) {
    return null;
  }
  const existingPermissions = await Notifications.getPermissionsAsync();

  if (existingPermissions.granted) {
    return Notifications;
  }

  if (didRequestPermissions || existingPermissions.canAskAgain === false) {
    return null;
  }

  didRequestPermissions = true;
  const requestedPermissions = await Notifications.requestPermissionsAsync();

  return requestedPermissions.granted ? Notifications : null;
}

export async function showActiveSleepNotification(session: SleepSession, now = new Date()) {
  const Notifications = await getPermittedNotificationsModule();

  if (!Notifications) {
    return;
  }

  const startedAt = new Date(session.startedAt);
  const durationMinutes = getActiveSleepDurationMinutes(startedAt, now);

  await Notifications.scheduleNotificationAsync({
    content: {
      autoDismiss: false,
      body: `Уже ${formatDuration(durationMinutes)} • с ${formatClock(startedAt)}`,
      color: colors.primary,
      data: {
        sessionId: session.id,
        startedAt: session.startedAt,
        type: 'activeSleep',
      },
      priority: Notifications.AndroidNotificationPriority.LOW,
      sound: false,
      sticky: true,
      title: 'Сон идёт',
    },
    identifier: ACTIVE_SLEEP_NOTIFICATION_ID,
    trigger: {
      channelId: ACTIVE_SLEEP_NOTIFICATION_CHANNEL_ID,
    },
  });
}

export async function hideActiveSleepNotification() {
  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return;
  }

  await Notifications.dismissNotificationAsync(ACTIVE_SLEEP_NOTIFICATION_ID);
}

export async function syncActiveSleepNotificationFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
) {
  try {
    const activeSession = await getActiveSleepSession(db);

    if (activeSession) {
      await showActiveSleepNotification(activeSession, now);
      return;
    }

    await hideActiveSleepNotification();
  } catch {
    // Notification state should never block sleep logging.
  }
}
