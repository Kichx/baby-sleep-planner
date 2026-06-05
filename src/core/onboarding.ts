import type { AppSettings, OnboardingState } from '@/types/appSettings';

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
