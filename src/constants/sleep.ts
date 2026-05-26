import type { SleepPlanPreset } from '@/types/sleep';
import { buildSleepPlanPreset } from '@/core/sleepPlan';

export const DEFAULT_CHILD_ID = 'default-child';

export const DEFAULT_CHILD_NAME = 'Ребёнок';

export const DEFAULT_SLEEP_PLAN: SleepPlanPreset = buildSleepPlanPreset({
  latestEveningNapEndMinutes: 20 * 60,
  maxEveningNapMinutes: 45,
  minNightSleepMinutes: 3 * 60,
  microNapMinutes: 20,
  napCount: 3,
  targetAwakeMaxMinutes: 10 * 60 + 30,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60 + 30,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: 7 * 60 + 30,
  wakeUpStartMinutes: 7 * 60,
});
