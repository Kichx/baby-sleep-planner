import { describe, expect, it } from 'vitest';

import { buildSleepPlanPreset } from '@/core/sleepPlan';
import { buildSleepPlanTimelineItems } from '@/core/sleepPlanTimeline';

describe('buildSleepPlanTimelineItems', () => {
  it('builds a full wake-window and sleep sequence from plan wake windows', () => {
    const plan = buildSleepPlanPreset({
      latestEveningNapEndMinutes: 20 * 60,
      maxEveningNapMinutes: 45,
      microNapMinutes: 20,
      minNightSleepMinutes: 3 * 60,
      napCount: 3,
      targetAwakeMaxMinutes: 10 * 60 + 30,
      targetAwakeMinMinutes: 10 * 60,
      targetDaySleepMaxMinutes: 3 * 60 + 30,
      targetDaySleepMinMinutes: 3 * 60,
      wakeUpEndMinutes: 7 * 60 + 30,
      wakeUpStartMinutes: 7 * 60,
    });

    const items = buildSleepPlanTimelineItems(plan);
    const firstWakeWindow = plan.wakeWindows[0];
    const napOne = items.find((item) => item.id === 'nap-1');
    const finalWakeWindow = items.find((item) => item.id === 'wake-window-4');
    const night = items.find((item) => item.id === 'night');

    expect(items.map((item) => item.kind)).toEqual([
      'wakeUp',
      'wakeWindow',
      'nap',
      'wakeWindow',
      'nap',
      'wakeWindow',
      'nap',
      'wakeWindow',
      'night',
    ]);
    expect(items[0]).toMatchObject({
      rangeEndMinutes: 7 * 60 + 30,
      rangeStartMinutes: 7 * 60,
      startMinutes: 7 * 60 + 15,
    });
    expect(items[1]).toMatchObject({
      maxDurationMinutes: firstWakeWindow.maxWakeMinutes,
      minDurationMinutes: firstWakeWindow.minWakeMinutes,
      number: 1,
      targetDurationMinutes: firstWakeWindow.targetWakeMinutes,
    });
    expect(napOne).toMatchObject({
      rangeStartMinutes: items[1].rangeEndMinutes,
      startMinutes: items[1].rangeEndMinutes,
      targetDurationMinutes: plan.targetDaySleepMinutes / plan.napCount,
    });
    expect(finalWakeWindow).toMatchObject({
      number: 4,
      targetDurationMinutes:
        plan.targetAwakeMinutes -
        plan.wakeWindows.reduce((total, wakeWindow) => total + wakeWindow.targetWakeMinutes, 0),
    });
    expect(night?.startMinutes).toBe(finalWakeWindow?.rangeEndMinutes);
  });
});
