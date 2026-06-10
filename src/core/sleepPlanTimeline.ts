import type { SleepPlanPreset, WakeWindowPreset } from '@/types/sleep';
import { getFinalWakeWindowForPlan } from '@/core/sleepPlan';

export type SleepPlanTimelineItemKind = 'wakeUp' | 'wakeWindow' | 'nap' | 'night';

export interface SleepPlanTimelineItem {
  id: string;
  kind: SleepPlanTimelineItemKind;
  maxDurationMinutes: number | null;
  minDurationMinutes: number | null;
  number: number | null;
  rangeEndMinutes: number | null;
  rangeStartMinutes: number | null;
  startMinutes: number;
  targetDurationMinutes: number | null;
}

const DAY_MINUTES = 24 * 60;

function getClockMidpointMinutes(startMinutes: number, endMinutes: number): number {
  return Math.round((startMinutes + endMinutes) / 2);
}

function normalizePlanClockMinutes(minutes: number): number {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function buildNapSleepDurations(plan: SleepPlanPreset): number[] {
  if (plan.napCount <= 0) {
    return [];
  }

  const baseDuration = Math.floor(plan.targetDaySleepMinutes / plan.napCount);
  const extraMinutes = plan.targetDaySleepMinutes - baseDuration * plan.napCount;

  return Array.from({ length: plan.napCount }, (_, index) =>
    baseDuration + (index < extraMinutes ? 1 : 0),
  );
}

function getFallbackWakeWindowTarget(plan: SleepPlanPreset): number {
  return Math.max(1, Math.round(plan.targetAwakeMinutes / (plan.napCount + 1)));
}

function getDisplayWakeWindow(plan: SleepPlanPreset, index: number): WakeWindowPreset {
  const fallbackTarget = getFallbackWakeWindowTarget(plan);

  return plan.wakeWindows[index] ?? {
    maxWakeMinutes: fallbackTarget,
    minWakeMinutes: fallbackTarget,
    napNumber: index + 1,
    targetWakeMinutes: fallbackTarget,
  };
}

export function buildSleepPlanTimelineItems(plan: SleepPlanPreset): SleepPlanTimelineItem[] {
  const wakeUpMinutes = getClockMidpointMinutes(
    plan.wakeUpStartMinutes,
    plan.wakeUpEndMinutes,
  );
  const items: SleepPlanTimelineItem[] = [
    {
      id: 'wake-up',
      kind: 'wakeUp',
      maxDurationMinutes: null,
      minDurationMinutes: null,
      number: null,
      rangeEndMinutes: plan.wakeUpEndMinutes,
      rangeStartMinutes: plan.wakeUpStartMinutes,
      startMinutes: wakeUpMinutes,
      targetDurationMinutes: null,
    },
  ];
  const sleepDurations = buildNapSleepDurations(plan);
  let cursorMinutes = wakeUpMinutes;

  for (let index = 0; index < plan.napCount; index += 1) {
    const wakeWindow = getDisplayWakeWindow(plan, index);
    const sleepDurationMinutes = sleepDurations[index] ?? 0;
    const sleepStartMinutes = cursorMinutes + wakeWindow.targetWakeMinutes;
    const sleepEndMinutes = sleepStartMinutes + sleepDurationMinutes;

    items.push({
      id: `wake-window-${index + 1}`,
      kind: 'wakeWindow',
      maxDurationMinutes: wakeWindow.maxWakeMinutes,
      minDurationMinutes: wakeWindow.minWakeMinutes,
      number: index + 1,
      rangeEndMinutes: sleepStartMinutes,
      rangeStartMinutes: null,
      startMinutes: cursorMinutes,
      targetDurationMinutes: wakeWindow.targetWakeMinutes,
    });

    items.push({
      id: `nap-${index + 1}`,
      kind: 'nap',
      maxDurationMinutes: null,
      minDurationMinutes: null,
      number: index + 1,
      rangeEndMinutes: sleepEndMinutes,
      rangeStartMinutes: sleepStartMinutes,
      startMinutes: sleepStartMinutes,
      targetDurationMinutes: sleepDurationMinutes,
    });

    cursorMinutes = sleepEndMinutes;
  }

  const finalWakeWindow = getFinalWakeWindowForPlan(plan);
  const nightStartMinutes = normalizePlanClockMinutes(
    cursorMinutes + finalWakeWindow.targetWakeMinutes,
  );

  items.push({
    id: `wake-window-${plan.napCount + 1}`,
    kind: 'wakeWindow',
    maxDurationMinutes: finalWakeWindow.maxWakeMinutes,
    minDurationMinutes: finalWakeWindow.minWakeMinutes,
    number: plan.napCount + 1,
    rangeEndMinutes: nightStartMinutes,
    rangeStartMinutes: null,
    startMinutes: cursorMinutes,
    targetDurationMinutes: finalWakeWindow.targetWakeMinutes,
  });

  items.push({
    id: 'night',
    kind: 'night',
    maxDurationMinutes: null,
    minDurationMinutes: null,
    number: null,
    rangeEndMinutes: null,
    rangeStartMinutes: null,
    startMinutes: nightStartMinutes,
    targetDurationMinutes: null,
  });

  return items;
}
