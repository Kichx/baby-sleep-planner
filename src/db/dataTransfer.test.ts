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
    childProfiles: [
      {
        birth_date: '2025-12-10',
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
    targetDayPlans: [
      {
        bedtime_target_minutes: 1170,
        child_id: 'default-child',
        id: 'default-target-day-plan',
        is_active: 1,
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
    expect(parsedBackup.data.sleepSessions).toHaveLength(1);
    expect(parsedBackup.data.sleepDayPlanSnapshots[0].sleep_day_date).toBe('2026-05-26');
    expect(parsedBackup.data.targetDayPlans[0].is_active).toBe(1);
  });

  it('parses an old backup without sleep day plan snapshots', () => {
    const oldBackup = {
      ...validBackup,
      data: {
        childProfiles: validBackup.data.childProfiles,
        sleepSessions: validBackup.data.sleepSessions,
        targetDayPlans: validBackup.data.targetDayPlans,
      },
      formatVersion: 1,
    };
    const parsedBackup = parseAppDataBackup(JSON.stringify(oldBackup));

    expect(parsedBackup.data.sleepDayPlanSnapshots).toEqual([]);
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
});
