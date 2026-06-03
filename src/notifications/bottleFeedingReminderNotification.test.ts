import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BottleFeeding } from '@/types/bottleFeeding';
import type { ChildProfile, SleepSession } from '@/types/sleep';

const dbMocks = vi.hoisted(() => ({
  getActiveSleepSession: vi.fn(),
  getChildProfile: vi.fn(),
  getLatestBottleFeeding: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => {
  const Notifications = {
    AndroidImportance: {
      DEFAULT: 'DEFAULT',
    },
    AndroidNotificationPriority: {
      DEFAULT: 'DEFAULT',
    },
    SchedulableTriggerInputTypes: {
      TIME_INTERVAL: 'TIME_INTERVAL',
    },
    cancelScheduledNotificationAsync: vi.fn(async (_identifier: string) => undefined),
    dismissNotificationAsync: vi.fn(async (_identifier: string) => undefined),
    scheduleNotificationAsync: vi.fn(async (_payload: {
      content: {
        data: Record<string, unknown>;
      };
      identifier: string;
      trigger: unknown;
    }) => undefined),
    setNotificationChannelAsync: vi.fn(
      async (_identifier: string, _channel: Record<string, unknown>) => undefined,
    ),
  };

  return {
    Notifications,
    ensureExpoNotificationHandlerConfigured: vi.fn(async () => Notifications),
    hasNotificationPermission: vi.fn(async () => true),
    loadExpoNotificationsModule: vi.fn(async () => Notifications),
    setBottleFeedingReminderPresentationSuppressionHandler: vi.fn(),
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

vi.mock('@/db', () => dbMocks);

vi.mock('@/notifications/expoNotifications', () => ({
  ensureExpoNotificationHandlerConfigured:
    notificationMocks.ensureExpoNotificationHandlerConfigured,
  hasNotificationPermission: notificationMocks.hasNotificationPermission,
  loadExpoNotificationsModule: notificationMocks.loadExpoNotificationsModule,
  setBottleFeedingReminderPresentationSuppressionHandler:
    notificationMocks.setBottleFeedingReminderPresentationSuppressionHandler,
}));

const db = {} as SQLiteDatabase;

function profile(overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
    birthDate: null,
    bottleFeedingDefaultVolumeMl: 180,
    bottleFeedingEnabled: true,
    bottleFeedingNotifyDuringSleep: true,
    bottleFeedingPromptDismissed: true,
    bottleFeedingReminderIntervalMinutes: 180,
    bottleFeedingRemindersEnabled: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    id: 'default-child',
    name: 'Baby',
    photoUri: null,
    ...overrides,
  };
}

function feeding(
  id: string,
  startedAt: string,
  volumeMl = 120,
): BottleFeeding {
  return {
    childId: 'default-child',
    createdAt: startedAt,
    id,
    startedAt,
    updatedAt: startedAt,
    volumeMl,
  };
}

function activeSleepSession(): SleepSession {
  return {
    childId: 'default-child',
    endedAt: null,
    id: 'active-sleep',
    kind: 'nap',
    startedAt: '2026-06-01T08:45:00.000Z',
  };
}

async function loadSubject() {
  vi.resetModules();

  return import('@/notifications/bottleFeedingReminderNotification');
}

function scheduledPayloadAt(index: number) {
  return notificationMocks.Notifications.scheduleNotificationAsync.mock.calls[index]?.[0];
}

describe('bottle feeding reminder notification sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMocks.ensureExpoNotificationHandlerConfigured.mockResolvedValue(
      notificationMocks.Notifications,
    );
    notificationMocks.hasNotificationPermission.mockResolvedValue(true);
    notificationMocks.loadExpoNotificationsModule.mockResolvedValue(
      notificationMocks.Notifications,
    );
    dbMocks.getChildProfile.mockResolvedValue(profile());
    dbMocks.getLatestBottleFeeding.mockResolvedValue(
      feeding('latest-feeding', '2026-06-01T06:00:00.000Z', 120),
    );
    dbMocks.getActiveSleepSession.mockResolvedValue(null);
  });

  it('does not schedule a reminder for a new user with bottle feeding disabled', async () => {
    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingEnabled: false,
        bottleFeedingRemindersEnabled: false,
      }),
    );
    dbMocks.getLatestBottleFeeding.mockResolvedValue(null);
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith('bottle-feeding-reminder');
    expect(notificationMocks.Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a reminder after bottle feeding reminders are enabled', async () => {
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    const payload = scheduledPayloadAt(0);

    expect(payload).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: {
        channelId: 'bottle-feeding-reminders',
        seconds: 3600,
        type: 'TIME_INTERVAL',
      },
    });
    expect(payload?.content.data).toMatchObject({
      feedingId: 'latest-feeding',
      suppressedDueToSleep: false,
      type: 'bottleFeedingReminder',
    });
  });

  it('does not show an overdue reminder during ordinary sync', async () => {
    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingReminderIntervalMinutes: 1,
      }),
    );
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T06:02:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith('bottle-feeding-reminder');
    expect(notificationMocks.Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('shows an overdue reminder after an explicit reminder settings save', async () => {
    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingReminderIntervalMinutes: 1,
      }),
    );
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T06:02:00.000Z'),
      { showOverdueReminder: true },
    );

    const payload = scheduledPayloadAt(0);

    expect(payload).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: null,
    });
    expect(payload?.content.data).toMatchObject({
      feedingId: 'latest-feeding',
      intervalMinutes: 1,
      suppressedDueToSleep: false,
      triggerAt: '2026-06-01T06:01:00.000Z',
      type: 'bottleFeedingReminder',
    });
  });

  it('cancels the old scheduled reminder before scheduling from a newer feeding', async () => {
    let latestFeeding = feeding('first-feeding', '2026-06-01T06:00:00.000Z', 120);

    dbMocks.getLatestBottleFeeding.mockImplementation(async () => latestFeeding);
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    latestFeeding = feeding('second-feeding', '2026-06-01T08:30:00.000Z', 90);

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T09:00:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(2);
    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(scheduledPayloadAt(0)?.content.data).toMatchObject({
      feedingId: 'first-feeding',
    });
    expect(scheduledPayloadAt(1)?.content.data).toMatchObject({
      feedingId: 'second-feeding',
    });
  });

  it('still schedules when clearing a previously displayed reminder fails', async () => {
    notificationMocks.Notifications.dismissNotificationAsync.mockRejectedValueOnce(
      new Error('not presented'),
    );
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith('bottle-feeding-reminder');
    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduledPayloadAt(0)).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: {
        channelId: 'bottle-feeding-reminders',
        seconds: 3600,
        type: 'TIME_INTERVAL',
      },
    });
  });

  it('cancels without scheduling when reminders are turned off', async () => {
    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingRemindersEnabled: false,
      }),
    );
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith('bottle-feeding-reminder');
    expect(notificationMocks.Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('shows a suppressed reminder after sleep ends when no newer feeding happened', async () => {
    let activeSleep: SleepSession | null = activeSleepSession();

    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingNotifyDuringSleep: false,
      }),
    );
    dbMocks.getActiveSleepSession.mockImplementation(async () => activeSleep);
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T09:15:00.000Z'),
    );

    expect(notificationMocks.Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    activeSleep = null;

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T09:20:00.000Z'),
    );

    const payload = scheduledPayloadAt(0);

    expect(payload).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: null,
    });
    expect(payload?.content.data).toMatchObject({
      feedingId: 'latest-feeding',
      suppressedDueToSleep: true,
    });
  });

  it('cancels a future reminder during sleep and reschedules it after early wake', async () => {
    let activeSleep: SleepSession | null = null;

    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingNotifyDuringSleep: false,
      }),
    );
    dbMocks.getActiveSleepSession.mockImplementation(async () => activeSleep);
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:00:00.000Z'),
    );

    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduledPayloadAt(0)).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: {
        channelId: 'bottle-feeding-reminders',
        seconds: 3600,
        type: 'TIME_INTERVAL',
      },
    });

    activeSleep = activeSleepSession();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:15:00.000Z'),
    );

    expect(
      notificationMocks.Notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(2);
    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    activeSleep = null;

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T08:30:00.000Z'),
    );

    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(scheduledPayloadAt(1)).toMatchObject({
      identifier: 'bottle-feeding-reminder',
      trigger: {
        channelId: 'bottle-feeding-reminders',
        seconds: 1800,
        type: 'TIME_INTERVAL',
      },
    });
    expect(scheduledPayloadAt(1)?.content.data).toMatchObject({
      feedingId: 'latest-feeding',
      suppressedDueToSleep: false,
      triggerAt: '2026-06-01T09:00:00.000Z',
    });
  });

  it('does not show a suppressed reminder after a newer feeding during sleep', async () => {
    let activeSleep: SleepSession | null = activeSleepSession();
    let latestFeeding = feeding('before-sleep', '2026-06-01T06:00:00.000Z', 120);

    dbMocks.getChildProfile.mockResolvedValue(
      profile({
        bottleFeedingNotifyDuringSleep: false,
      }),
    );
    dbMocks.getActiveSleepSession.mockImplementation(async () => activeSleep);
    dbMocks.getLatestBottleFeeding.mockImplementation(async () => latestFeeding);
    const { syncBottleFeedingReminderNotificationFromDatabase } = await loadSubject();

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T09:15:00.000Z'),
    );

    latestFeeding = feeding('during-sleep', '2026-06-01T09:30:00.000Z', 90);

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T09:40:00.000Z'),
    );

    activeSleep = null;

    await syncBottleFeedingReminderNotificationFromDatabase(
      db,
      new Date('2026-06-01T10:00:00.000Z'),
    );

    expect(notificationMocks.Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(
      notificationMocks.Notifications.scheduleNotificationAsync.mock.calls.some(
        ([payload]) => payload.trigger === null,
      ),
    ).toBe(false);
    expect(scheduledPayloadAt(0)?.content.data).toMatchObject({
      feedingId: 'during-sleep',
      suppressedDueToSleep: false,
    });
  });
});
