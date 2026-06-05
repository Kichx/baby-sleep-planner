import type { ISODateString } from '@/types/sleep';

export type OnboardingMode = 'tracking_only' | 'plan_saved';

export type OnboardingState = 'not_started' | OnboardingMode;

export interface AppSettings {
  eveningPlanPromptDismissedDateKey: string | null;
  onboardingCompletedAt: ISODateString | null;
  onboardingMode: OnboardingMode | null;
}
