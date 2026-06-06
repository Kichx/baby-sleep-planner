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
      showPlanBasedPredictions: false,
      showStartStopSleepAction: true,
      showTrackingOnlyEmptyHint: true,
    });
  });

  it('shows plan predictions when an active target plan exists', () => {
    expect(
      deriveMainScreenSleepUiState({
        hasActiveTargetPlan: true,
        isSelectedDateToday: true,
        selectedSleepSessionCount: 0,
      }).showPlanBasedPredictions,
    ).toBe(true);
  });
});
