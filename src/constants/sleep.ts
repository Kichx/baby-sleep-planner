import type { SleepPlanPreset } from '@/types/sleep';
import { buildSleepPlanPreset, deriveEveningSleepRulesForPlan } from '@/core/sleepPlan';
import {
  DEFAULT_MIN_NIGHT_SLEEP_MINUTES,
  DEFAULT_WAKE_UP_END_MINUTES,
  DEFAULT_WAKE_UP_START_MINUTES,
} from '@/core/sleepPlanDefaults';

export const DEFAULT_CHILD_ID = 'default-child';

export const DEFAULT_CHILD_NAME = 'Ребёнок';

const DEFAULT_SLEEP_PLAN_BASE = {
  minNightSleepMinutes: DEFAULT_MIN_NIGHT_SLEEP_MINUTES,
  napCount: 3,
  targetAwakeMaxMinutes: 10 * 60 + 30,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60 + 30,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: DEFAULT_WAKE_UP_END_MINUTES,
  wakeUpStartMinutes: DEFAULT_WAKE_UP_START_MINUTES,
};

export const DEFAULT_SLEEP_PLAN: SleepPlanPreset = buildSleepPlanPreset({
  ...DEFAULT_SLEEP_PLAN_BASE,
  ...deriveEveningSleepRulesForPlan(DEFAULT_SLEEP_PLAN_BASE),
});
