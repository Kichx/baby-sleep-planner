import { describe, expect, it } from 'vitest';

import {
  APP_DATA_BACKUP_FORMAT,
  APP_DATA_BACKUP_FORMAT_VERSION,
  DataTransferError,
  type AppDataBackup,
  parseAppDataBackup,
  serializeAppDataBackup,
} from '@/db/dataTransfer';

const validBackup: AppDataBackup = {
  data: {
    bottleFeedings: [
      {
        child_id: 'default-child',
        created_at: '2026-05-26T07:45:00.000Z',
        id: 'bottle-feeding-1',
        started_at: '2026-05-26T07:40:00.000Z',
        updated_at: '2026-05-26T07:45:00.000Z',
        volume_ml: 120,
      },
    ],
    childProfiles: [
      {
        birth_date: '2025-12-10',
        bottle_feeding_enabled: 1,
        bottle_feeding_prompt_dismissed: 1,
        bottle_feeding_default_volume_ml: 180,
        bottle_feeding_reminder_interval_minutes: 180,
        bottle_feeding_reminders_enabled: 1,
        bottle_feeding_notify_during_sleep: 1,
        created_at: '2026-05-20T08:00:00.000Z',
        id: 'default-child',
        name: 'Малыш',
      },
    ],
    sleepSessions: [
      {
        child_id: 'default-child',
        ended_at: '2026-05-26T08:30:00.000Z',
        id: 'sleep-1',
        kind: 'nap',
        started_at: '2026-05-26T08:00:00.000Z',
      },
    ],
    sleepDayPlanSnapshots: [
      {
        bedtime_target_minutes: 1170,
        captured_at: '2026-05-26T20:00:00.000Z',
        child_id: 'default-child',
        day_start_minutes: 420,
        early_bedtime_minutes: 1110,
        latest_evening_nap_end_minutes: 1200,
        max_evening_nap_minutes: 45,
        micro_nap_minutes: 20,
        min_night_sleep_minutes: 180,
        nap_count: 3,
        sleep_day_date: '2026-05-26',
        source_plan_id: 'default-target-day-plan',
        source_plan_name: 'Основной',
        target_awake_max_minutes: 540,
        target_awake_min_minutes: 480,
        target_awake_minutes: 510,
        target_day_sleep_max_minutes: 270,
        target_day_sleep_min_minutes: 210,
        target_day_sleep_minutes: 240,
        updated_at: '2026-05-26T20:00:00.000Z',
        wake_up_end_minutes: 450,
        wake_up_start_minutes: 420,
      },
    ],
    sleepDayTemporaryModes: [
      {
        base_plan_id: 'default-target-day-plan',
        child_id: 'default-child',
        created_at: '2026-05-26T05:00:00.000Z',
        disabled_at: null,
        dismissed_at: '2026-05-26T05:10:00.000Z',
        id: 'temporary-mode-1',
        mode: 'early_wake',
        sleep_day_date_key: '2026-05-26',
      },
    ],
    targetDayPlans: [
      {
        bedtime_target_minutes: 1170,
        child_id: 'default-child',
        evening_rules_mode: 'auto',
        id: 'default-target-day-plan',
        is_active: 1,
        latest_evening_nap_end_minutes: 1200,
        max_evening_nap_minutes: 45,
        micro_nap_minutes: 20,
        name: 'Основной',
        nap_count: 3,
        target_awake_max_minutes: 540,
        target_awake_min_minutes: 480,
        target_awake_minutes: 510,
        target_day_sleep_max_minutes: 270,
        target_day_sleep_min_minutes: 210,
        target_day_sleep_minutes: 240,
        updated_at: '2026-05-20T08:00:00.000Z',
        wake_up_end_minutes: 450,
        wake_up_start_minutes: 420,
      },
    ],
  },
  databaseVersion: 4,
  exportedAt: '2026-05-27T00:00:00.000Z',
  format: APP_DATA_BACKUP_FORMAT,
  formatVersion: APP_DATA_BACKUP_FORMAT_VERSION,
};

describe('data transfer backup parsing', () => {
  it('parses a valid app backup', () => {
    const parsedBackup = parseAppDataBackup(serializeAppDataBackup(validBackup));

    expect(parsedBackup.data.childProfiles[0].name).toBe('Малыш');
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_enabled).toBe(1);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_prompt_dismissed).toBe(1);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_default_volume_ml).toBe(180);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_reminders_enabled).toBe(1);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_reminder_interval_minutes).toBe(180);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_notify_during_sleep).toBe(1);
    expect(parsedBackup.data.bottleFeedings[0].volume_ml).toBe(120);
    expect(parsedBackup.data.sleepSessions).toHaveLength(1);
    expect(parsedBackup.data.sleepDayPlanSnapshots[0].sleep_day_date).toBe('2026-05-26');
    expect(parsedBackup.data.sleepDayTemporaryModes[0]).toMatchObject({
      dismissed_at: '2026-05-26T05:10:00.000Z',
      mode: 'early_wake',
      sleep_day_date_key: '2026-05-26',
    });
    expect(parsedBackup.data.targetDayPlans[0].is_active).toBe(1);
  });

  it('parses an old backup without sleep day plan snapshots', () => {
    const {
      bottle_feeding_enabled,
      bottle_feeding_default_volume_ml,
      bottle_feeding_notify_during_sleep,
      bottle_feeding_prompt_dismissed,
      bottle_feeding_reminder_interval_minutes,
      bottle_feeding_reminders_enabled,
      ...oldProfile
    } = validBackup.data.childProfiles[0];
    const oldBackup = {
      ...validBackup,
      data: {
        childProfiles: [oldProfile],
        sleepSessions: validBackup.data.sleepSessions,
        targetDayPlans: validBackup.data.targetDayPlans,
      },
      formatVersion: 1,
    };
    const parsedBackup = parseAppDataBackup(JSON.stringify(oldBackup));

    expect(parsedBackup.data.sleepDayPlanSnapshots).toEqual([]);
    expect(parsedBackup.data.sleepDayTemporaryModes).toEqual([]);
    expect(parsedBackup.data.bottleFeedings).toEqual([]);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_enabled).toBe(0);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_prompt_dismissed).toBe(0);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_default_volume_ml).toBe(180);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_reminders_enabled).toBe(0);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_reminder_interval_minutes).toBe(180);
    expect(parsedBackup.data.childProfiles[0].bottle_feeding_notify_during_sleep).toBe(1);
  });

  it('uses default evening settings for an old target day plan backup', () => {
    const { latest_evening_nap_end_minutes, max_evening_nap_minutes, micro_nap_minutes, ...oldPlan } =
      validBackup.data.targetDayPlans[0];
    const oldBackup = {
      ...validBackup,
      data: {
        ...validBackup.data,
        targetDayPlans: [oldPlan],
      },
      formatVersion: 2,
    };
    const parsedBackup = parseAppDataBackup(JSON.stringify(oldBackup));

    expect(parsedBackup.data.targetDayPlans[0]).toMatchObject({
      evening_rules_mode: 'auto',
      latest_evening_nap_end_minutes: 1200,
      max_evening_nap_minutes: 45,
      micro_nap_minutes: 20,
    });
  });

  it('rejects files from another format', () => {
    expect(() => parseAppDataBackup(JSON.stringify({ format: 'other' }))).toThrow(
      DataTransferError,
    );
  });

  it('rejects sleep sessions that reference an unknown child profile', () => {
    const brokenBackup: AppDataBackup = {
      ...validBackup,
      data: {
        ...validBackup.data,
        sleepSessions: [
          {
            ...validBackup.data.sleepSessions[0],
            child_id: 'missing-child',
          },
        ],
      },
    };

    expect(() => parseAppDataBackup(serializeAppDataBackup(brokenBackup))).toThrow(
      DataTransferError,
    );
  });

  it('rejects bottle feedings that reference an unknown child profile', () => {
    const brokenBackup: AppDataBackup = {
      ...validBackup,
      data: {
        ...validBackup.data,
        bottleFeedings: [
          {
            ...validBackup.data.bottleFeedings[0],
            child_id: 'missing-child',
          },
        ],
      },
    };

    expect(() => parseAppDataBackup(serializeAppDataBackup(brokenBackup))).toThrow(
      DataTransferError,
    );
  });
});
