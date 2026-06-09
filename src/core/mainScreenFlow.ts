import type { OnboardingMode } from '@/types/appSettings';

import { shouldShowEveningPlanPrompt } from './onboarding';

type MainScreenSelectedDayType = 'past' | 'today' | 'future';

interface MainScreenSleepUiStateInput {
  eveningPlanPromptDismissedDateKey: string | null;
  hasActiveTargetPlan: boolean;
  nowMinutesFromMidnight: number;
  onboardingMode: OnboardingMode | null;
  selectedDayType: MainScreenSelectedDayType;
  selectedSleepSessionCount: number;
  sleepDayDateKey: string | null;
}

interface MainScreenSleepUiState {
  canShowCoachBlocks: boolean;
  canShowEveningPlanPrompt: boolean;
  canShowPlanBasedBlocks: boolean;
  canShowTemporaryModeBadges: boolean;
  hasActualSleepRecords: boolean;
  hasActiveTargetPlan: boolean;
  isFutureSelected: boolean;
  isPastSelected: boolean;
  isTodaySelected: boolean;
  isTrackingOnlyWithoutPlan: boolean;
  onboardingMode: OnboardingMode | null;
  showActualRecordsTimeline: boolean;
  showManualSleepAction: boolean;
  showPlanStartNoDataHint: boolean;
  showPlanBasedPredictions: boolean;
  showStartStopSleepAction: boolean;
  showTrackingOnlyEmptyHint: boolean;
}

export function deriveMainScreenSleepUiState({
  eveningPlanPromptDismissedDateKey,
  hasActiveTargetPlan,
  nowMinutesFromMidnight,
  onboardingMode,
  selectedDayType,
  selectedSleepSessionCount,
  sleepDayDateKey,
}: MainScreenSleepUiStateInput): MainScreenSleepUiState {
  const isTodaySelected = selectedDayType === 'today';
  const isPastSelected = selectedDayType === 'past';
  const isFutureSelected = selectedDayType === 'future';
  const hasActualSleepRecords = selectedSleepSessionCount > 0;
  const showPlanStartNoDataHint =
    hasActiveTargetPlan && isTodaySelected && !hasActualSleepRecords;
  const isTrackingOnlyWithoutPlan =
    onboardingMode === 'tracking_only' && !hasActiveTargetPlan;
  const canShowPlanBasedBlocks = hasActiveTargetPlan && !showPlanStartNoDataHint;
  const canShowCoachBlocks = hasActiveTargetPlan && isTodaySelected;
  const canShowTemporaryModeBadges = canShowCoachBlocks;
  const canShowEveningPlanPrompt = shouldShowEveningPlanPrompt({
    dismissedDateKey: eveningPlanPromptDismissedDateKey,
    hasActiveTargetDayPlan: hasActiveTargetPlan,
    isSelectedDateToday: isTodaySelected,
    nowMinutesFromMidnight,
    onboardingMode,
    sleepDayDateKey,
    sleepSessionCount: selectedSleepSessionCount,
  });

  return {
    canShowCoachBlocks,
    canShowEveningPlanPrompt,
    canShowPlanBasedBlocks,
    canShowTemporaryModeBadges,
    hasActualSleepRecords,
    hasActiveTargetPlan,
    isFutureSelected,
    isPastSelected,
    isTodaySelected,
    isTrackingOnlyWithoutPlan,
    onboardingMode,
    showActualRecordsTimeline: true,
    showManualSleepAction: true,
    showPlanStartNoDataHint,
    showPlanBasedPredictions: canShowPlanBasedBlocks,
    showStartStopSleepAction: isTodaySelected,
    showTrackingOnlyEmptyHint: !hasActiveTargetPlan && !hasActualSleepRecords,
  };
}
