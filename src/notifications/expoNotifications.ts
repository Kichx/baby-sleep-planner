import Constants, { AppOwnership } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = typeof ExpoNotifications;
type NotificationPresentationSuppressionHandler = (
  notification: ExpoNotifications.Notification,
) => boolean | Promise<boolean>;
type NotificationPermissionResponse =
  Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>;

export type { NotificationsModule };

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let isNotificationHandlerConfigured = false;
let didRequestPermissions = false;
let bottleFeedingReminderSuppressionHandler:
  | NotificationPresentationSuppressionHandler
  | null = null;

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

  // In SDK 56, importing expo-notifications in Android Expo Go can still execute
  // push-token setup code and crash before local notification calls run.
  return !(Platform.OS === 'android' && isExpoGo());
}

export function loadExpoNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUseExpoNotifications()) {
    return Promise.resolve(null);
  }

  notificationsModulePromise ??= import('expo-notifications').catch(() => null);

  return notificationsModulePromise;
}

export function setBottleFeedingReminderPresentationSuppressionHandler(
  handler: NotificationPresentationSuppressionHandler | null,
): void {
  bottleFeedingReminderSuppressionHandler = handler;
}

export function resetExpoNotificationRuntimeState(): void {
  didRequestPermissions = false;
  bottleFeedingReminderSuppressionHandler = null;
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
        const isBottleFeedingReminder = notificationType === 'bottleFeedingReminder';
        const shouldSuppressBottleFeedingReminder =
          isBottleFeedingReminder && bottleFeedingReminderSuppressionHandler
            ? await Promise.resolve(
                bottleFeedingReminderSuppressionHandler(notification),
              ).catch(() => false)
            : false;
        const shouldShowReminder =
          isSleepReminder || (isBottleFeedingReminder && !shouldSuppressBottleFeedingReminder);

        return {
          priority: isSleepReminder || isBottleFeedingReminder
            ? Notifications.AndroidNotificationPriority.DEFAULT
            : Notifications.AndroidNotificationPriority.LOW,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: shouldShowReminder,
          shouldShowList: !shouldSuppressBottleFeedingReminder,
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

  return isNotificationPermissionGranted(Notifications, existingPermissions);
}

function isNotificationPermissionGranted(
  Notifications: NotificationsModule,
  permissions: NotificationPermissionResponse,
): boolean {
  return (
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function canAskForNotificationPermission(): Promise<boolean> {
  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return false;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();

  return (
    !isNotificationPermissionGranted(Notifications, existingPermissions) &&
    existingPermissions.canAskAgain !== false
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadExpoNotificationsModule();

  if (!Notifications) {
    return false;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();

  if (
    isNotificationPermissionGranted(Notifications, existingPermissions)
  ) {
    return true;
  }

  if (didRequestPermissions || existingPermissions.canAskAgain === false) {
    return false;
  }

  didRequestPermissions = true;
  const requestedPermissions = await Notifications.requestPermissionsAsync();

  return isNotificationPermissionGranted(Notifications, requestedPermissions);
}
