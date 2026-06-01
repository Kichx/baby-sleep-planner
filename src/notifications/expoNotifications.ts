import Constants, { AppOwnership } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = typeof ExpoNotifications;

export type { NotificationsModule };

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let isNotificationHandlerConfigured = false;
let didRequestPermissions = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === AppOwnership.Expo;
}

export function canUseAndroidNativeNotifications(): boolean {
  return Platform.OS === 'android' && !isExpoGo();
}

function canUseExpoNotifications(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  // SDK 56 can crash Expo Go on Android when expo-notifications is imported.
  return !(Platform.OS === 'android' && isExpoGo());
}

export function loadExpoNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUseExpoNotifications()) {
    return Promise.resolve(null);
  }

  notificationsModulePromise ??= import('expo-notifications').catch(() => null);

  return notificationsModulePromise;
}

export async function ensureExpoNotificationHandlerConfigured(): Promise<NotificationsModule | null> {
  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return null;
  }

  if (!isNotificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const notificationType = notification.request.content.data?.type;
        const isSleepReminder = notificationType === 'sleepReminder';

        return {
          priority: isSleepReminder
            ? Notifications.AndroidNotificationPriority.DEFAULT
            : Notifications.AndroidNotificationPriority.LOW,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: isSleepReminder,
          shouldShowList: true,
        };
      },
    });

    isNotificationHandlerConfigured = true;
  }

  return Notifications;
}

export async function hasNotificationPermission(
  Notifications: NotificationsModule,
): Promise<boolean> {
  const existingPermissions = await Notifications.getPermissionsAsync();

  if (
    existingPermissions.granted ||
    existingPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  if (didRequestPermissions || existingPermissions.canAskAgain === false) {
    return false;
  }

  didRequestPermissions = true;
  const requestedPermissions = await Notifications.requestPermissionsAsync();

  return (
    requestedPermissions.granted ||
    requestedPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

