import { describe, expect, it } from 'vitest';

import { deriveOnboardingState } from '@/core/onboarding';

describe('onboarding state derivation', () => {
  it('treats an empty first-run database as not started', () => {
    expect(
      deriveOnboardingState({
        appSettings: null,
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('not_started');
  });

  it('uses explicit tracking-only mode when no target plan is active', () => {
    expect(
      deriveOnboardingState({
        appSettings: { onboardingMode: 'tracking_only' },
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('tracking_only');
  });

  it('uses explicit plan-saved mode', () => {
    expect(
      deriveOnboardingState({
        appSettings: { onboardingMode: 'plan_saved' },
        hasActiveTargetDayPlan: false,
      }),
    ).toBe('plan_saved');
  });

  it('treats an existing active target plan as plan saved for old databases', () => {
    expect(
      deriveOnboardingState({
        appSettings: null,
        hasActiveTargetDayPlan: true,
      }),
    ).toBe('plan_saved');
  });
});
