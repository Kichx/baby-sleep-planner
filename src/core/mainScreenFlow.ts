interface MainScreenSleepUiStateInput {
  hasActiveTargetPlan: boolean;
  isSelectedDateToday: boolean;
  selectedSleepSessionCount: number;
}

interface MainScreenSleepUiState {
  hasActualSleepRecords: boolean;
  showActualRecordsTimeline: boolean;
  showManualSleepAction: boolean;
  showPlanBasedPredictions: boolean;
  showStartStopSleepAction: boolean;
  showTrackingOnlyEmptyHint: boolean;
}

export function deriveMainScreenSleepUiState({
  hasActiveTargetPlan,
  isSelectedDateToday,
  selectedSleepSessionCount,
}: MainScreenSleepUiStateInput): MainScreenSleepUiState {
  const hasActualSleepRecords = selectedSleepSessionCount > 0;

  return {
    hasActualSleepRecords,
    showActualRecordsTimeline: true,
    showManualSleepAction: true,
    showPlanBasedPredictions: hasActiveTargetPlan,
    showStartStopSleepAction: isSelectedDateToday,
    showTrackingOnlyEmptyHint: !hasActiveTargetPlan && !hasActualSleepRecords,
  };
}
