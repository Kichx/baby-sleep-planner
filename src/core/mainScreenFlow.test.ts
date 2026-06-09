import { describe, expect, it } from 'vitest';

import { deriveMainScreenSleepUiState } from '@/core/mainScreenFlow';

describe('main screen sleep UI state', () => {
  const baseInput = {
    eveningPlanPromptDismissedDateKey: null,
    hasActiveTargetPlan: false,
    nowMinutesFromMidnight: 12 * 60,
    onboardingMode: 'tracking_only' as const,
    selectedDayType: 'today' as const,
    selectedSleepSessionCount: 0,
    sleepDayDateKey: '2026-06-05',
  };

  it('hides plan predictions but keeps sleep actions and actual records available without an active plan', () => {
    expect(
      deriveMainScreenSleepUiState({
        ...baseInput,
        selectedSleepSessionCount: 2,
      }),
    ).toMatchObject({
      canShowCoachBlocks: false,
      canShowPlanBasedBlocks: false,
      canShowTemporaryModeBadges: false,
      hasActualSleepRecords: true,
      isTodaySelected: true,
      isTrackingOnlyWithoutPlan: true,
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
        ...baseInput,
      }),
    ).toMatchObject({
      canShowCoachBlocks: false,
      canShowPlanBasedBlocks: false,
      canShowTemporaryModeBadges: false,
      hasActualSleepRecords: false,
      isTrackingOnlyWithoutPlan: true,
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
        ...baseInput,
        hasActiveTargetPlan: true,
        onboardingMode: 'plan_saved',
      }),
    ).toMatchObject({
      canShowCoachBlocks: true,
      canShowPlanBasedBlocks: false,
      canShowTemporaryModeBadges: true,
      hasActualSleepRecords: false,
      isTrackingOnlyWithoutPlan: false,
      showPlanBasedPredictions: false,
      showPlanStartNoDataHint: true,
      showTrackingOnlyEmptyHint: false,
    });
  });

  it('shows plan predictions when an active target plan has actual records today', () => {
    expect(
      deriveMainScreenSleepUiState({
        ...baseInput,
        hasActiveTargetPlan: true,
        onboardingMode: 'plan_saved',
        selectedSleepSessionCount: 1,
      }),
    ).toMatchObject({
      canShowCoachBlocks: true,
      canShowPlanBasedBlocks: true,
      canShowTemporaryModeBadges: true,
      hasActualSleepRecords: true,
      showPlanBasedPredictions: true,
      showPlanStartNoDataHint: false,
    });
  });

  it('keeps plan predictions for non-today plan views even without records', () => {
    expect(
      deriveMainScreenSleepUiState({
        ...baseInput,
        hasActiveTargetPlan: true,
        onboardingMode: 'plan_saved',
        selectedDayType: 'past',
      }),
    ).toMatchObject({
      canShowCoachBlocks: false,
      canShowPlanBasedBlocks: true,
      canShowTemporaryModeBadges: false,
      hasActualSleepRecords: false,
      isPastSelected: true,
      isTodaySelected: false,
      showPlanBasedPredictions: true,
      showPlanStartNoDataHint: false,
    });
  });

  it('hides current-moment coach blocks for a future selected day', () => {
    expect(
      deriveMainScreenSleepUiState({
        ...baseInput,
        hasActiveTargetPlan: true,
        onboardingMode: 'plan_saved',
        selectedDayType: 'future',
        selectedSleepSessionCount: 1,
      }),
    ).toMatchObject({
      canShowCoachBlocks: false,
      canShowPlanBasedBlocks: true,
      canShowTemporaryModeBadges: false,
      isFutureSelected: true,
      isTodaySelected: false,
    });
  });

  it('keeps the evening plan prompt available only through the shared view state', () => {
    expect(
      deriveMainScreenSleepUiState({
        ...baseInput,
        nowMinutesFromMidnight: 18 * 60,
        selectedSleepSessionCount: 1,
      }),
    ).toMatchObject({
      canShowEveningPlanPrompt: true,
      canShowPlanBasedBlocks: false,
      isTrackingOnlyWithoutPlan: true,
    });
  });
});
