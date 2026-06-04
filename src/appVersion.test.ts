import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSubject({
  appOwnership,
  buildVersion,
  configVersion,
  nativeVersion,
}: {
  appOwnership: 'expo' | 'standalone';
  buildVersion: string | null;
  configVersion: string;
  nativeVersion: string | null;
}) {
  vi.resetModules();
  vi.doMock('expo-application', () => ({
    nativeApplicationVersion: nativeVersion,
    nativeBuildVersion: buildVersion,
  }));
  vi.doMock('expo-constants', () => ({
    AppOwnership: {
      Expo: 'expo',
    },
    default: {
      appOwnership,
      expoConfig: {
        version: configVersion,
      },
    },
  }));

  return import('@/appVersion');
}

describe('application version line', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses native version and build number in an installed APK', async () => {
    const { buildApplicationVersionLine } = await loadSubject({
      appOwnership: 'standalone',
      buildVersion: '12',
      configVersion: '1.0.2',
      nativeVersion: '1.0.2',
    });

    expect(buildApplicationVersionLine()).toBe('Версия 1.0.2 (12)');
  });

  it('uses config version without build number in Expo Go', async () => {
    const { buildApplicationVersionLine } = await loadSubject({
      appOwnership: 'expo',
      buildVersion: '12',
      configVersion: '1.0.2',
      nativeVersion: '1.0.2',
    });

    expect(buildApplicationVersionLine()).toBe('Версия 1.0.2');
  });
});
