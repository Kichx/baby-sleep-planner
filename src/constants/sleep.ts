import type { SleepPlanPreset } from '@/types/sleep';

export const DEFAULT_CHILD_ID = 'default-child';

export const DEFAULT_CHILD_NAME = 'Ребёнок';

export const DEFAULT_SLEEP_PLAN: SleepPlanPreset = {
  dayStartMinutes: 7 * 60,
  targetAwakeMinutes: 10 * 60,
  targetDaySleepMinutes: 3 * 60,
  bedtimeTargetMinutes: 19 * 60 + 30,
  earlyBedtimeMinutes: 18 * 60 + 30,
  microNapMinutes: 20,
  wakeWindows: [
    {
      napNumber: 1,
      minWakeMinutes: 120,
      targetWakeMinutes: 135,
      maxWakeMinutes: 150,
    },
    {
      napNumber: 2,
      minWakeMinutes: 135,
      targetWakeMinutes: 150,
      maxWakeMinutes: 165,
    },
    {
      napNumber: 3,
      minWakeMinutes: 150,
      targetWakeMinutes: 165,
      maxWakeMinutes: 180,
    },
    {
      napNumber: 4,
      minWakeMinutes: 150,
      targetWakeMinutes: 180,
      maxWakeMinutes: 210,
    },
  ],
};
