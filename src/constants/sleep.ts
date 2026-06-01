import type { SleepPlanPreset } from '@/types/sleep';
import { buildSleepPlanPreset, deriveEveningSleepRulesForPlan } from '@/core/sleepPlan';

export const DEFAULT_CHILD_ID = 'default-child';

export const DEFAULT_CHILD_NAME = 'Ребёнок';

const DEFAULT_SLEEP_PLAN_BASE = {
  minNightSleepMinutes: 3 * 60,
  napCount: 3,
  targetAwakeMaxMinutes: 10 * 60 + 30,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60 + 30,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: 7 * 60 + 30,
  wakeUpStartMinutes: 7 * 60,
};

export const DEFAULT_SLEEP_PLAN: SleepPlanPreset = buildSleepPlanPreset({
  ...DEFAULT_SLEEP_PLAN_BASE,
  ...deriveEveningSleepRulesForPlan(DEFAULT_SLEEP_PLAN_BASE),
});
