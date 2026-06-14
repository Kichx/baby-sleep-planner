import { requireOptionalNativeModule } from 'expo';
import type { SQLiteDatabase } from 'expo-sqlite';

import { colors } from '@/constants/theme';
import { formatLocalClock } from '@/core/localDateTime';
import { getActiveSleepSession, getOnboardingState } from '@/db';
import {
  canUseAndroidNativeNotifications,
  ensureExpoNotificationHandlerConfigured,
  hasNotificationPermission,
  loadExpoNotificationsModule,
  type NotificationsModule,
} from '@/notifications/expoNotifications';
import type { OnboardingState } from '@/types/appSettings';
import type { SleepSession } from '@/types/sleep';

export const ACTIVE_SLEEP_NOTIFICATION_REFRESH_MS = 60_000;

const ACTIVE_SLEEP_NOTIFICATION_ID = 'active-sleep-notification';
const ACTIVE_SLEEP_NOTIFICATION_CHANNEL_ID = 'active-sleep';

interface ActiveSleepChronometerModule {
  hide: () => boolean;
  show: (startedAtMillis: number, startedAtLabel: string) => boolean;
}

let activeSleepChronometerModule: ActiveSleepChronometerModule | null | undefined;
let isAndroidChannelConfigured = false;

function getActiveSleepChronometerModule(): ActiveSleepChronometerModule | null {
  if (!canUseAndroidNativeNotifications()) {
    return null;
  }

  activeSleepChronometerModule ??=
    requireOptionalNativeModule<ActiveSleepChronometerModule>('ActiveSleepChronometer');

  return activeSleepChronometerModule;
}

function formatClock(date: Date): string {
  return formatLocalClock(date);
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

function showNativeActiveSleepNotification(
  startedAtMillis: number,
  startedAtLabel: string,
): boolean {
  try {
    return getActiveSleepChronometerModule()?.show(startedAtMillis, startedAtLabel) === true;
  } catch {
    return false;
  }
}

function hideNativeActiveSleepNotification(): void {
  try {
    getActiveSleepChronometerModule()?.hide();
  } catch {
    // Expo fallback cleanup below should still run.
  }
}

export function canSyncActiveSleepNotificationForOnboardingState(
  onboardingState: OnboardingState | null,
): boolean {
  return onboardingState === 'tracking_only' || onboardingState === 'plan_saved';
}

async function ensureActiveSleepNotificationsReady(): Promise<NotificationsModule | null> {
  if (!canUseAndroidNativeNotifications()) {
    return null;
  }

  const Notifications = await ensureExpoNotificationHandlerConfigured();

  if (!Notifications) {
    return null;
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
  if (!canUseAndroidNativeNotifications()) {
    return;
  }

  void ensureActiveSleepNotificationsReady();
}

async function getPermittedNotificationsModule(): Promise<NotificationsModule | null> {
  const Notifications = await ensureActiveSleepNotificationsReady();

  if (!Notifications) {
    return null;
  }

  return (await hasNotificationPermission(Notifications)) ? Notifications : null;
}

export async function showActiveSleepNotification(session: SleepSession, now = new Date()) {
  const Notifications = await getPermittedNotificationsModule();

  if (!Notifications) {
    return;
  }

  const startedAt = new Date(session.startedAt);
  const durationMinutes = getActiveSleepDurationMinutes(startedAt, now);

  if (showNativeActiveSleepNotification(startedAt.getTime(), formatClock(startedAt))) {
    return;
  }

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
  hideNativeActiveSleepNotification();

  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return;
  }

  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(ACTIVE_SLEEP_NOTIFICATION_ID),
    Notifications.dismissNotificationAsync(ACTIVE_SLEEP_NOTIFICATION_ID),
  ]);
}

export async function syncActiveSleepNotificationFromDatabase(
  db: SQLiteDatabase,
  now = new Date(),
) {
  try {
    const onboardingState = await getOnboardingState(db);

    if (!canSyncActiveSleepNotificationForOnboardingState(onboardingState)) {
      return;
    }

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
