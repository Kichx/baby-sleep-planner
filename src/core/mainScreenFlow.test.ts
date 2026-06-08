import { describe, expect, it } from 'vitest';

import { deriveMainScreenSleepUiState } from '@/core/mainScreenFlow';

describe('main screen sleep UI state', () => {
  it('hides plan predictions but keeps sleep actions and actual records available without an active plan', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: false,
        isSelectedDateToday: true,
        selectedSleepSessionCount: 2,
      }),
    ).toMatchObject({
      hasActualSleepRecords: true,
      showActualRecordsTimeline: true,
      showManualSleepAction: true,
      showPlanStartNoDataHint: false,
      showPlanBasedPredictions: false,
      showStartStopSleepAction: true,
      showTrackingOnlyEmptyHint: false,
    });
  });

  it('keeps the empty tracking-only hint separate from actual records', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: false,
        isSelectedDateToday: true,
        selectedSleepSessionCount: 0,
      }),
    ).toMatchObject({
      hasActualSleepRecords: false,
      showActualRecordsTimeline: true,
      showManualSleepAction: true,
      showPlanStartNoDataHint: false,
      showPlanBasedPredictions: false,
      showStartStopSleepAction: true,
      showTrackingOnlyEmptyHint: true,
    });
  });

  it('shows a calm plan-start hint instead of predictions when today has no sleep records', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: true,
        isSelectedDateToday: true,
        selectedSleepSessionCount: 0,
      }),
    ).toMatchObject({
      hasActualSleepRecords: false,
      showPlanBasedPredictions: false,
      showPlanStartNoDataHint: true,
      showTrackingOnlyEmptyHint: false,
    });
  });

  it('shows plan predictions when an active target plan has actual records today', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: true,
        isSelectedDateToday: true,
        selectedSleepSessionCount: 1,
      }),
    ).toMatchObject({
      hasActualSleepRecords: true,
      showPlanBasedPredictions: true,
      showPlanStartNoDataHint: false,
    });
  });

  it('keeps plan predictions for non-today plan views even without records', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: true,
        isSelectedDateToday: false,
        selectedSleepSessionCount: 0,
      }),
    ).toMatchObject({
      hasActualSleepRecords: false,
      showPlanBasedPredictions: true,
      showPlanStartNoDataHint: false,
    });
  });
});
