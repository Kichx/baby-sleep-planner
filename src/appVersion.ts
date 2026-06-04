import * as Application from 'expo-application';
import Constants, { AppOwnership } from 'expo-constants';

export function buildApplicationVersionLine(): string {
  const configVersion = Constants.expoConfig?.version ?? 'dev';
  const isExpoGo = Constants.appOwnership === AppOwnership.Expo;
  const appVersion = isExpoGo
    ? configVersion
    : Application.nativeApplicationVersion ?? configVersion;
  const buildVersion = isExpoGo ? null : Application.nativeBuildVersion;

  if (buildVersion) {
    return `Версия ${appVersion} (${buildVersion})`;
  }

  return `Версия ${appVersion}`;
}
