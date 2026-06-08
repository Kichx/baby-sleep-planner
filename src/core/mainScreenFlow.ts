interface MainScreenSleepUiStateInput {
  hasActiveTargetPlan: boolean;
  isSelectedDateToday: boolean;
  selectedSleepSessionCount: number;
}

interface MainScreenSleepUiState {
  hasActualSleepRecords: boolean;
  showActualRecordsTimeline: boolean;
  showManualSleepAction: boolean;
  showPlanStartNoDataHint: boolean;
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
  const showPlanStartNoDataHint =
    hasActiveTargetPlan && isSelectedDateToday && !hasActualSleepRecords;

  return {
    hasActualSleepRecords,
    showActualRecordsTimeline: true,
    showManualSleepAction: true,
    showPlanStartNoDataHint,
    showPlanBasedPredictions: hasActiveTargetPlan && !showPlanStartNoDataHint,
    showStartStopSleepAction: isSelectedDateToday,
    showTrackingOnlyEmptyHint: !hasActiveTargetPlan && !hasActualSleepRecords,
  };
}
