import type { AppSettings, OnboardingMode, OnboardingState } from '@/types/appSettings';

export const EVENING_PLAN_PROMPT_START_MINUTES = 18 * 60;

interface DeriveOnboardingStateInput {
  appSettings: Pick<AppSettings, 'onboardingMode'> | null;
  hasActiveTargetDayPlan: boolean;
}

export function deriveOnboardingState({
  appSettings,
  hasActiveTargetDayPlan,
}: DeriveOnboardingStateInput): OnboardingState {
  if (hasActiveTargetDayPlan || appSettings?.onboardingMode === 'plan_saved') {
    return 'plan_saved';
  }

  if (appSettings?.onboardingMode === 'tracking_only') {
    return 'tracking_only';
  }

  return 'not_started';
}

interface ShouldShowEveningPlanPromptInput {
  dismissedDateKey: string | null;
  hasActiveTargetDayPlan: boolean;
  isSelectedDateToday: boolean;
  nowMinutesFromMidnight: number;
  onboardingMode: OnboardingMode | null;
  sleepDayDateKey: string | null;
  sleepSessionCount: number;
}

export function shouldShowEveningPlanPrompt({
  dismissedDateKey,
  hasActiveTargetDayPlan,
  isSelectedDateToday,
  nowMinutesFromMidnight,
  onboardingMode,
  sleepDayDateKey,
  sleepSessionCount,
}: ShouldShowEveningPlanPromptInput): boolean {
  return (
    onboardingMode === 'tracking_only' &&
    !hasActiveTargetDayPlan &&
    isSelectedDateToday &&
    sleepSessionCount > 0 &&
    nowMinutesFromMidnight >= EVENING_PLAN_PROMPT_START_MINUTES &&
    sleepDayDateKey !== null &&
    dismissedDateKey !== sleepDayDateKey
  );
}
