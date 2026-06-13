import { requireOptionalNativeModule } from 'expo';
import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

interface SleepWidgetModule {
  refresh: () => boolean;
}

let sleepWidgetModule: SleepWidgetModule | null | undefined;

const ENABLE_ANDROID_SLEEP_WIDGET = false;

function canUseAndroidSleepWidget(): boolean {
  return (
    ENABLE_ANDROID_SLEEP_WIDGET &&
    Platform.OS === 'android' &&
    Constants.appOwnership !== AppOwnership.Expo
  );
}

function getSleepWidgetModule(): SleepWidgetModule | null {
  if (!canUseAndroidSleepWidget()) {
    return null;
  }

  sleepWidgetModule ??= requireOptionalNativeModule<SleepWidgetModule>('SleepWidget');

  return sleepWidgetModule;
}

export function refreshSleepWidgetInBackground(): void {
  try {
    getSleepWidgetModule()?.refresh();
  } catch {
    // Widget refresh should never block sleep logging or app startup.
  }
}
