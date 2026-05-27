export type ISODateString = string;

export type SleepKind = 'nap' | 'night';

export type SleepState = 'awake' | 'sleeping';

export type RecommendationScenarioId =
  | 'normal'
  | 'microNap'
  | 'earlyBedtime'
  | 'stretchWakeWindow'
  | 'capLastNap';

export type ScenarioPriority = 'primary' | 'secondary' | 'caution';

export interface ChildProfile {
  id: string;
  name: string;
  birthDate: ISODateString | null;
  photoUri: string | null;
  createdAt: ISODateString;
}

export interface SleepSession {
  id: string;
  childId: string;
  kind: SleepKind;
  startedAt: ISODateString;
  endedAt: ISODateString | null;
}

export interface WakeWindowPreset {
  napNumber: number;
  minWakeMinutes: number;
  targetWakeMinutes: number;
  maxWakeMinutes: number;
}

export interface SleepPlanPreset {
  dayStartMinutes: number;
  wakeUpStartMinutes: number;
  wakeUpEndMinutes: number;
  targetAwakeMinMinutes: number;
  targetAwakeMaxMinutes: number;
  targetAwakeMinutes: number;
  napCount: number;
  targetDaySleepMinMinutes: number;
  targetDaySleepMaxMinutes: number;
  targetDaySleepMinutes: number;
  bedtimeTargetMinutes: number;
  earlyBedtimeMinutes: number;
  latestEveningNapEndMinutes: number;
  maxEveningNapMinutes: number;
  minNightSleepMinutes: number;
  microNapMinutes: number;
  wakeWindows: WakeWindowPreset[];
}

export interface TargetDayPlan {
  id: string;
  childId: string;
  name: string;
  isActive: boolean;
  plan: SleepPlanPreset;
  updatedAt: ISODateString;
}

export interface SleepDayPlanSnapshot {
  childId: string;
  sleepDayDate: string;
  sourcePlanId: string | null;
  sourcePlanName: string;
  plan: SleepPlanPreset;
  capturedAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SleepDayPlan {
  childId: string;
  sleepDayDate: string;
  sourcePlanId: string | null;
  sourcePlanName: string;
  plan: SleepPlanPreset;
  isSnapshot: boolean;
}

export interface RecommendationScenario {
  id: RecommendationScenarioId;
  title: string;
  detail: string;
  priority: ScenarioPriority;
}

export interface SleepSnapshot {
  state: SleepState;
  statusStartedAt: Date;
  currentDurationMinutes: number;
  nextSleepAt: Date;
  nextSleepKind: SleepKind;
  predictedBedtimeAt: Date;
  projectedRemainingDaySleepMinutes: number;
  totalAwakeMinutes: number;
  remainingAwakeMinutes: number;
  totalDaySleepMinutes: number;
  completedNaps: number;
  onTrackLabel: string;
  scenarios: RecommendationScenario[];
}

export interface SleepDaySummary {
  totalDaySleepMinutes: number;
  totalNightSleepMinutes: number;
  totalAwakeMinutes: number;
  sleepSessionCount: number;
  completedNaps: number;
  targetAwakeDeltaMinutes: number;
  targetDaySleepDeltaMinutes: number;
  napCountDelta: number;
  targetBedtimeDeltaMinutes: number | null;
  bedtimeAt: Date | null;
  wakeUpAt: Date | null;
  verdictLabel: string;
  feedbackLines: string[];
  onTrackLabel: string;
}

export interface SleepTimelineSegment {
  id: string;
  kind: SleepKind;
  startOffsetMinutes: number;
  durationMinutes: number;
  actualStartedAt: Date;
  actualEndedAt: Date | null;
  isClippedStart: boolean;
  isClippedEnd: boolean;
}
